"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import { PAGE_SIZE } from "@/lib/pagination";
import { revalidatePath } from "next/cache";
import {
  cantPedirReposicionMerc2,
  upsertPedidoMercaderiaReposicionConfig,
} from "@/services/pedidosEnvio.service";
import {
  buildMapStockeable,
  buildMapsStockSucursalesPrincipales,
  getStockeableFromMap,
  getStockSucursalPrincipal,
} from "@/services/prodTiendaStock.service";
import {
  cargarListaPrecioReposicionPorCodTiendas,
  elegirListaPrecioProveedorReposicion,
  listarProveedoresFiltroReposicion,
  sumarIvaSaldoParaReposicion,
  type ProveedorFiltroReposicion,
} from "@/services/pedidosReposicionProveedor.service";
import { prismaCuidSchema } from "@/lib/validations/common";
import { bultoProdTiendaValido, buildMapBultosProdTienda, guardarBultoProdTienda } from "@/services/tiendaBultos.service";
import { REVALIDATE_CX_COMPRA } from "@/lib/gestionProductosRoutes";
import {
  getReposicionParamsSchema,
  productosReposicionSelectorSchema,
  reposicionFormaPedidoVendedorSchema,
  sucursalReposicionSchema,
  normalizarReposicionFormaPedido,
  type ReposicionFormaPedido,
} from "@/lib/validations/reposicion";

export type SucursalReposicion = "guaymallen" | "maipu";

export type FormaPedirReposicionOption = ReposicionFormaPedido | "";

export interface ItemReposicion {
  /** Clave estable de fila tienda (= `prod_precios_tienda.cod_tienda`). El nombre conserva compatibilidad con la UI */
  idListaTienda: string;
  codExt: string;
  codTienda: string;
  descripcionTienda: string | null;
  stock: number;
  idProveedor: string | null;
  nombreProveedor: string | null;
  /** Id de fila `prod_ped_merc` (tipo REPOSICION). */
  idReposicion: string | null;
  formaPedir: FormaPedirReposicionOption;
  puntoReposicion: number;
  /** `reposicion_cant_conf` (regla: cant. fija / tope máximo). */
  cant: number;
  /** `reposicion_cant_pedir` en `prod_ped_merc2` (cantidad pedida del pedido Reposición). */
  cantPedidaReposicion: number;
  /** Cantidad a pedir recalculada (stock / forma); misma regla que Generar pedido. */
  cantPedir: number;
  /** Unidades por bulto (`prod_tienda.bulto`). `null` = vacío. */
  bulto: number | null;
}

export interface ReposicionData {
  items: ItemReposicion[];
  total: number;
  totalPaginas: number;
  marcas: string[];
  rubros: string[];
  subRubros: string[];
  /** Filtro PROVEEDOR (mercadería, no fábrica, lista habilitada). */
  proveedores: ProveedorFiltroReposicion[];
}

export interface GetReposicionParams {
  q?: string;
  marca?: string;
  rubro?: string;
  subRubro?: string;
  proveedor?: string;
  /** "si" = solo ítems con regla de reposición configurada. */
  configurado?: "" | "si";
  pagina?: number;
}

const emptyReposicionData: ReposicionData = {
  items: [],
  total: 0,
  totalPaginas: 1,
  marcas: [],
  rubros: [],
  subRubros: [],
  proveedores: [],
};

async function sucursalPedidoHabilitada(codigo: SucursalReposicion): Promise<boolean> {
  const row = await prisma.sucursal.findUnique({
    where: { codigo },
    select: { pedido: true },
  });
  return row?.pedido === true;
}

function proveedorFiltroId(raw: string | undefined): string {
  const parsed = prismaCuidSchema.safeParse((raw ?? "").trim());
  return parsed.success ? parsed.data : "";
}

/** Filtro PROVEEDOR: solo si hay id (vínculo habilitado a ese proveedor no fábrica). */
function whereVinculoProveedor(proveedorId: string): Prisma.ProdTiendaWhereInput | null {
  if (!proveedorId) return null;
  return {
    listaPreciosProveedores: {
      some: {
        habilitado: true,
        idProveedor: proveedorId,
        proveedor: { esFabrica: false },
      },
    },
  };
}

function baseWhere(
  params: GetReposicionParams,
  exclude?: "marca" | "rubro" | "subRubro"
): Prisma.ProdTiendaWhereInput[] {
  const { q = "", marca = "", rubro = "", subRubro = "" } = params;
  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);
  const parts: Prisma.ProdTiendaWhereInput[] = [];
  if (textFilter.AND?.length) parts.push(textFilter);
  if (exclude !== "marca" && marca) parts.push({ marca });
  if (exclude !== "rubro" && rubro) parts.push({ rubro });
  if (exclude !== "subRubro" && subRubro) parts.push({ subRubro });
  return parts;
}

/**
 * Datos para Pedido Reposición: catálogo `prod_tienda` filtrado por marca, rubro, descripción
 * y, si hay filtro PROVEEDOR, por vínculo habilitado a ese proveedor no fábrica.
 * Cada ítem incluye la configuración REPOSICION desde `prod_ped_merc`.
 * **CANT. A PEDIR** se recalcula con la misma regla que Generar Pedido / `upsertPedidoMercaderiaReposicionConfig`.
 */
export async function getReposicionData(
  sucursal: SucursalReposicion | null,
  params: GetReposicionParams = {}
): Promise<ReposicionData> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return emptyReposicionData;
  }

  let proveedores: ProveedorFiltroReposicion[] = [];
  try {
    proveedores = await listarProveedoresFiltroReposicion();
  } catch (error: unknown) {
    console.error("[reposicion][getReposicionData] proveedores", error);
  }

  const emptyConProveedores = (): ReposicionData => ({
    ...emptyReposicionData,
    proveedores,
  });

  if (!sucursal) {
    return emptyConProveedores();
  }
  if (!sucursalReposicionSchema.safeParse(sucursal).success) {
    return emptyConProveedores();
  }
  if (!(await sucursalPedidoHabilitada(sucursal))) {
    return emptyConProveedores();
  }

  const parsedParams = getReposicionParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return emptyConProveedores();
  }
  const {
    configurado,
    pagina: paginaNum,
    q,
    marca,
    rubro,
    subRubro,
    proveedor: proveedorRaw,
  } = parsedParams.data;
  const proveedorId = proveedorFiltroId(proveedorRaw);
  const paramsNorm: GetReposicionParams = {
    q,
    marca,
    rubro,
    subRubro,
    proveedor: proveedorId,
    configurado: configurado as "" | "si",
    pagina: paginaNum,
  };
  const skip = (paginaNum - 1) * PAGE_SIZE;
  const vinculoProveedor = whereVinculoProveedor(proveedorId);

  const codTiendaMerc2 =
    configurado === "si"
      ? await prisma.prodPedMerc2.findMany({
          where: {
            sucursal: { codigo: sucursal },
            tipoDePedido: "REPOSICION",
            reposicionCodTienda: { not: null },
          },
          select: { reposicionCodTienda: true },
          distinct: ["reposicionCodTienda"],
        })
      : [];
  const codTiendaList =
    configurado === "si"
      ? [
          ...new Set(
            codTiendaMerc2
              .map((r) => (r.reposicionCodTienda ?? "").trim())
              .filter((v) => v.length > 0)
          ),
        ]
      : [];

  const baseParts = baseWhere(paramsNorm);
  const whereItems: Prisma.ProdTiendaWhereInput = (() => {
    const parts: Prisma.ProdTiendaWhereInput[] = [...baseParts];
    if (vinculoProveedor) parts.push(vinculoProveedor);
    if (configurado === "si") {
      // Si no hay configurados, devolvemos vacío rápido.
      if (codTiendaList.length === 0) return { codTienda: { in: ["__none__"] } };
      parts.push({ codTienda: { in: codTiendaList } });
    }
    return parts.length > 0 ? { AND: parts } : {};
  })();
  const toWhereWithNotNull = (
    exclude: "marca" | "rubro" | "subRubro"
  ): Prisma.ProdTiendaWhereInput => {
    const parts = baseWhere(paramsNorm, exclude);
    const key = exclude;
    const notNull = {
      [key]: { not: null },
    } as Prisma.ProdTiendaWhereInput;
    const extra: Prisma.ProdTiendaWhereInput[] = [];
    if (vinculoProveedor) extra.push(vinculoProveedor);
    if (configurado === "si") {
      if (codTiendaList.length === 0) return { codTienda: { in: ["__none__"] } };
      extra.push({ codTienda: { in: codTiendaList } });
    }
    return { AND: [...parts, ...extra, notNull] };
  };
  const whereMarcas = toWhereWithNotNull("marca");
  const whereRubros = toWhereWithNotNull("rubro");
  const whereSubRubros = toWhereWithNotNull("subRubro");

  const [rows, total, marcasDistinct, rubrosDistinct, subRubrosDistinct] =
    await Promise.all([
      prisma.prodTienda.findMany({
        where: whereItems,
        orderBy: { descripcionTienda: "asc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.prodTienda.count({ where: whereItems }),
      prisma.prodTienda.findMany({
        select: { marca: true },
        distinct: ["marca"],
        where: whereMarcas,
        orderBy: { marca: "asc" },
      }),
      prisma.prodTienda.findMany({
        select: { rubro: true },
        distinct: ["rubro"],
        where: whereRubros,
        orderBy: { rubro: "asc" },
      }),
      prisma.prodTienda.findMany({
        select: { subRubro: true },
        distinct: ["subRubro"],
        where: whereSubRubros,
        orderBy: { subRubro: "asc" },
      }),
    ]);

  const codTiendasRows = rows.map((r) => r.codTienda.trim()).filter(Boolean);
  const reglasMap = new Map<
    string,
    {
      id: string;
      idProveedor: string | null;
      nombreProveedor: string | null;
      codExt: string;
      formaPedir: FormaPedirReposicionOption;
      puntoReposicion: number;
      cant: number;
      cantPedidaReposicion: number;
    }
  >();
  if (codTiendasRows.length > 0) {
    const reglasMerc2 = await prisma.prodPedMerc2.findMany({
      where: {
        sucursal: { codigo: sucursal },
        tipoDePedido: "REPOSICION",
        reposicionCodTienda: { in: codTiendasRows },
      },
      orderBy: [{ id: "desc" }],
      select: {
        id: true,
        reposicionCodTienda: true,
        reposicionFormaPedido: true,
        reposicionPuntoPedido: true,
        reposicionCantConf: true,
        reposicionCantPedir: true,
      },
    });
    for (const r of reglasMerc2) {
      const key = (r.reposicionCodTienda ?? "").trim();
      if (!key || reglasMap.has(key)) continue;
      reglasMap.set(key, {
        id: r.id,
        idProveedor: null,
        nombreProveedor: null,
        codExt: "",
        formaPedir: normalizarReposicionFormaPedido(r.reposicionFormaPedido) ?? "",
        puntoReposicion: Math.max(0, Math.floor(Number(r.reposicionPuntoPedido ?? 0))),
        cant: Math.max(0, Math.floor(Number(r.reposicionCantConf ?? 0))),
        cantPedidaReposicion: Math.max(0, Math.floor(Number(r.reposicionCantPedir ?? 0))),
      });
    }

  }

  const codTiendasPage = rows.map((r) => r.codTienda.trim()).filter(Boolean);
  const [ivaSaldoReposicion, lpPorCodTienda, stockMaps, stockeableMap] =
    await Promise.all([
      sumarIvaSaldoParaReposicion(),
      cargarListaPrecioReposicionPorCodTiendas(codTiendasPage),
      buildMapsStockSucursalesPrincipales(codTiendasPage),
      buildMapStockeable(codTiendasPage),
    ]);

  const items: ItemReposicion[] = rows.map((r) => {
    const codTienda = r.codTienda.trim();
    const provResuelto = elegirListaPrecioProveedorReposicion({
      codTienda,
      lpPorCodTienda,
      ivaSaldoAcumulado: ivaSaldoReposicion,
    });
    const regla = reglasMap.get(codTienda) ?? null;
    const idProveedor = provResuelto?.idProveedor ?? null;
    const nombreProveedor = provResuelto?.proveedor?.nombre ?? null;
    const stock = getStockSucursalPrincipal(codTienda, sucursal, stockMaps);
    const forma = regla?.formaPedir ?? "";
    const punto = regla?.puntoReposicion ?? 0;
    const cantCfg = regla?.cant ?? 0;
    const cantPedidaDb = regla?.cantPedidaReposicion ?? 0;
    const bulto = bultoProdTiendaValido(r.bulto);
    const cantAPedir = cantPedirReposicionMerc2({
      forma,
      punto,
      cantConf: cantCfg,
      stock,
      stockeable: getStockeableFromMap(stockeableMap, codTienda),
      bulto,
    });
    return {
      idListaTienda: codTienda,
      codExt: provResuelto?.codExt ?? "",
      codTienda,
      descripcionTienda: r.descripcionTienda,
      stock,
      idProveedor,
      nombreProveedor,
      idReposicion: regla?.id ?? null,
      formaPedir: forma,
      puntoReposicion: punto,
      cant: cantCfg,
      cantPedidaReposicion: cantPedidaDb,
      cantPedir: cantAPedir,
      bulto,
    };
  });

  const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

  return {
    items,
    total,
    totalPaginas,
    marcas: marcasDistinct.filter((m) => m.marca != null).map((m) => m.marca!),
    rubros: rubrosDistinct.filter((r) => r.rubro != null).map((r) => r.rubro!),
    subRubros: subRubrosDistinct
      .filter((s) => s.subRubro != null)
      .map((s) => s.subRubro!),
    proveedores,
  };
}

export interface ItemSelectorReposicion {
  /** Igual que `ItemReposicion.idListaTienda` (= `cod_tienda`). */
  idListaTienda: string;
  codExt: string;
  codTienda: string;
  descripcionTienda: string | null;
}

const SELECTOR_LIMIT = 300;
const getProductosReposicionSelectorSchema = z.object({
  sucursal: sucursalReposicionSchema.nullable(),
  q: z.string().max(500).optional().default(""),
  bultoReferencia: z.preprocess(
    (v) => (v === undefined || v === "" ? null : v),
    z.coerce.number().int().min(1).nullable()
  ),
});

/**
 * Productos de lista_tienda con proveedor para el selector del modal "Agregar configuración".
 * Incluye ítems con `bulto` vacío o con el mismo `bultoReferencia` (al guardar se persiste ese valor).
 * Búsqueda por descripción; máximo SELECTOR_LIMIT resultados.
 */
export async function getProductosReposicionSelector(
  raw: unknown
): Promise<ItemSelectorReposicion[]> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) return [];
  const parsed = getProductosReposicionSelectorSchema.safeParse(raw);
  if (!parsed.success) return [];
  const { sucursal, bultoReferencia } = parsed.data;
  if (!sucursal) return [];
  if (!(await sucursalPedidoHabilitada(sucursal))) return [];
  if (bultoReferencia == null) return [];
  const parsedQ = productosReposicionSelectorSchema.safeParse({ q: parsed.data.q });
  const qNorm = parsedQ.success ? parsedQ.data.q : "";

  const textFilter = filtroTexto(qNorm, ["descripcionTienda", "codTienda"]);
  const whereParts: Prisma.ProdTiendaWhereInput[] = [
    {
      listaPreciosProveedores: {
        some: {
          habilitado: true,
          proveedor: { esFabrica: false },
        },
      },
    },
    {
      OR: [{ bulto: null }, { bulto: bultoReferencia }],
    },
  ];
  if (textFilter.AND?.length) whereParts.push(textFilter);
  const where: Prisma.ProdTiendaWhereInput = { AND: whereParts };

  const rows = await prisma.prodTienda.findMany({
    where,
    orderBy: { descripcionTienda: "asc" },
    take: SELECTOR_LIMIT,
  });

  return rows.map((r) => ({
      idListaTienda: r.codTienda,
      codExt: "",
      codTienda: r.codTienda,
      descripcionTienda: r.descripcionTienda,
    }));
}

const upsertReglaSchema = z.object({
  sucursalCodigo: z.enum(["guaymallen", "maipu"]),
  codTienda: z.string().min(1, "Código tienda requerido"),
  formaPedir: reposicionFormaPedidoVendedorSchema,
  puntoReposicion: z.number().int().min(0, "Punto reposición inválido"),
  cant: z.number().int().min(1, "Cant. reposición requerida"),
  unidadesPorBulto: z.number().int().min(1).max(1_000_000).optional(),
});

/**
 * Crea o actualiza la regla de reposición para (sucursal, cod_tienda),
 * resolviendo proveedor/cod_ext vigentes desde `prod_precios_tienda`.
 * Validación estricta: no guarda nada si falta Forma/Punto/Cant.
 */
export async function upsertReglaReposicion(raw: unknown): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  const parsed = upsertReglaSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat().find(Boolean);
    return { ok: false, error: (first as string) ?? "Datos inválidos." };
  }
  const { sucursalCodigo, codTienda, formaPedir, puntoReposicion, cant, unidadesPorBulto } =
    parsed.data;
  if (!(await sucursalPedidoHabilitada(sucursalCodigo))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }
  if (formaPedir === "POR_BULTO") {
    if (unidadesPorBulto != null) {
      const saved = await guardarBultoProdTienda(codTienda, unidadesPorBulto);
      if (!saved.success) {
        return { ok: false, error: saved.error };
      }
    }
    const bultosMap = await buildMapBultosProdTienda([codTienda]);
    const bulto = bultosMap.get(codTienda);
    if (bulto == null || bulto < 1) {
      return {
        ok: false,
        error: "Completá Un. por bulto.",
      };
    }
  }

  try {
    const result = await upsertPedidoMercaderiaReposicionConfig({
      sucursal: sucursalCodigo,
      codTienda,
      formaPedir,
      puntoReposicion,
      cantConf: cant,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/pedidos/reposicion");
    if (formaPedir === "POR_BULTO" && unidadesPorBulto != null) {
      for (const path of REVALIDATE_CX_COMPRA) {
        revalidatePath(path);
      }
    }
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al guardar la regla.";
    return { ok: false, error: message };
  }
}

const deleteReglaSchema = z.object({
  id: z.string().uuid("ID de regla inválido"),
});

/**
 * Elimina la regla de reposición por ID.
 */
export async function deleteReglaReposicion(raw: unknown): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  const parsed = deleteReglaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "ID inválido." };
  }
  try {
    await prisma.prodPedMerc2.deleteMany({
      where: { id: parsed.data.id, tipoDePedido: "REPOSICION" },
    });
    revalidatePath("/pedidos/reposicion");
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al eliminar la regla.";
    return { ok: false, error: message };
  }
}
