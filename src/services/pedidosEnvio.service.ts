/**
 * Pedidos de mercadería: lectura/escritura en `prod_ped_merc` (urgente, tintométrico, reposición).
 * Resolución de proveedor y textos vía `prod_precios_tienda` / `prod_precios_provee` según tipo.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import {
  buildCodExtTintometrico,
  parseCodTiendaFromCodExtTintometrico,
} from "@/lib/pedidosTintometrico";
import { SUCURSAL_LABEL_PEDIDO } from "@/lib/pedidos";
import {
  cargarListaPrecioReposicionPorCodTiendas,
  elegirListaPrecioProveedorReposicion,
  existeListaPrecioParaReposicionCodTienda,
  proveedorEtiquetaPedidoDesdeRow,
  resolverListaPrecioReposicionParaProveedor,
  sumarIvaSaldoParaReposicion,
} from "@/services/pedidosReposicionProveedor.service";
import {
  buildMapStockeable,
  buildMapsStockSucursalesPrincipales,
  getIdDepositoPorSucursalCodigo,
  getStockeableFromMap,
  getStockReal,
  getStockSucursalPrincipal,
  isStockeableCodTienda,
  type MapsStockSucursalesPrincipales,
} from "@/services/prodTiendaStock.service";
import {
  esFormaCantFijaReposicion,
  normalizarReposicionFormaPedido,
  type ReposicionFormaPedido,
  type ReposicionFormaPedidoFabrica,
  type ReposicionFormaPedidoVendedor,
} from "@/lib/validations/reposicion";
import { buildMapBultosProdTienda } from "@/services/tiendaBultos.service";

const TIPO_URGENTE = "URGENTE";
const TIPO_REPOSICION = "REPOSICION";
const TIPO_TINTOMETRICO = "TINTOMETRICO";
const TIPO_A_FABRICA = "A FÁBRICA";

export type SucursalPedidoEnvio = "guaymallen" | "maipu";

export interface ItemPedidoTintometricoPayload {
  sucursalCodigo: SucursalPedidoEnvio;
  proveedorId: string;
  codTienda: string;
  /** Código de fórmula (COD. …) — parte de `cod_ext` para no colisionar por misma base. */
  codTintometrico: string;
  cantidad: number;
  descripcion: string;
}

export interface ItemPedidoTintometricoPersistido {
  /** Id en `prod_ped_merc`. */
  id: string;
  sucursalCodigo: SucursalPedidoEnvio;
  proveedorId: string;
  codExt: string;
  codTienda: string;
  cantidad: number;
  descripcion: string;
}

/** Sucursal habilitada para flujos de pedido de mercadería (`sucursales.pedido`). */
export async function sucursalPedidoHabilitada(codigo: string): Promise<boolean> {
  const row = await prisma.sucursal.findUnique({
    where: { codigo: codigo.trim() },
    select: { pedido: true },
  });
  return row?.pedido === true;
}

async function getSucursalIdByCodigo(codigo: SucursalPedidoEnvio): Promise<string> {
  const sucursal = await prisma.sucursal.findUnique({
    where: { codigo },
    select: { id: true },
  });
  if (!sucursal) {
    throw new Error(`No se encontró la sucursal '${codigo}'.`);
  }
  return sucursal.id;
}

/** Persiste reposición solo en `prod_ped_merc`. */
export async function upsertPedidoMercaderiaReposicionConfig(params: {
  sucursal: SucursalPedidoEnvio;
  codTienda: string;
  formaPedir: ReposicionFormaPedidoVendedor;
  puntoReposicion: number;
  cantConf: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { sucursal, codTienda, formaPedir, puntoReposicion, cantConf } = params;

  const punto = Math.max(0, Math.floor(Number(puntoReposicion) || 0));
  const cant = Math.max(0, Math.floor(Number(cantConf) || 0));
  if (!codTienda.trim()) return { ok: false, error: "Código tienda requerido." };
  if (!formaPedir) return { ok: false, error: "Seleccioná Forma Pedir." };
  if (punto < 0) return { ok: false, error: "Punto reposición inválido." };
  if (cant <= 0) return { ok: false, error: "Cant. reposición inválida." };

  try {
    const sucursalId = await getSucursalIdByCodigo(sucursal);
    const tienda = await prisma.prodTienda.findFirst({
      where: { codTienda: codTienda.trim() },
      select: {
        codTienda: true,
        descripcionTienda: true,
      },
    });
    if (!tienda) {
      return { ok: false, error: "No se encontró el producto en prod_precios_tienda." };
    }
    if (!(await isStockeableCodTienda(codTienda.trim()))) {
      return {
        ok: false,
        error:
          "Este producto no es stockeable (DUX: ctd_disponible nulo en algún depósito); no se configura reposición por stock.",
      };
    }
    const codT = codTienda.trim();
    const tieneListaProveedor = await existeListaPrecioParaReposicionCodTienda(codT);
    if (!tieneListaProveedor) {
      return {
        ok: false,
        error:
          "No hay proveedor vinculado al producto en prod_precios_provee. Vinculá al menos un proveedor desde Vínculos Con Proveedores.",
      };
    }

    const stock =
      (await getStockReal(
        codT,
        getIdDepositoPorSucursalCodigo(sucursal)
      )) ?? 0;
    const bultosMap = await buildMapBultosProdTienda([codT]);
    const cantPedir = cantPedirReposicionMerc2({
      forma: formaPedir,
      punto,
      cantConf: cant,
      stock,
      stockeable: true,
      bulto: bultosMap.get(codT) ?? null,
    });

    await prisma.$transaction(async (tx) => {
      await tx.prodPedMerc2.deleteMany({
        where: {
          sucursalId,
          tipoDePedido: TIPO_REPOSICION,
          reposicionCodTienda: codT,
        },
      });
      await tx.prodPedMerc2.create({
        data: {
          tipoDePedido: TIPO_REPOSICION,
          sucursalId,
          reposicionCodTienda: codT,
          reposicionFormaPedido: formaPedir,
          reposicionPuntoPedido: punto,
          reposicionCantConf: cant,
          reposicionCantPedir: cantPedir,
        },
      });
    });

    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al guardar la configuración.";
    return { ok: false, error: message };
  }
}

/** Persiste URGENTE en `prod_ped_merc`. */
export async function upsertPedidoMercaderiaUrgenteItem(params: {
  sucursal: SucursalPedidoEnvio;
  listaPrecioProveedorId: string;
  cant: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { sucursal, listaPrecioProveedorId, cant } = params;
  const cantNorm = Math.max(0, Math.floor(Number(cant) || 0));

  try {
    const sucursalId = await getSucursalIdByCodigo(sucursal);
    const item = await prisma.listaPrecioProveedor.findUnique({
      where: { codExt: listaPrecioProveedorId },
      select: {
        idProveedor: true,
        codExt: true,
        codProdProveedor: true,
        descripcionProveedor: true,
        prodTienda: {
          select: { codTienda: true, descripcionTienda: true },
        },
      },
    });

    if (!item) return { ok: false, error: "Producto no encontrado." };

    await prisma.$transaction(async (tx) => {
      if (cantNorm <= 0) {
        await tx.prodPedMerc2.deleteMany({
          where: {
            tipoDePedido: TIPO_URGENTE,
            sucursalId,
            urgenteCodExt: item.codExt,
          },
        });
        return;
      }

      await tx.prodPedMerc2.deleteMany({
        where: {
          tipoDePedido: TIPO_URGENTE,
          sucursalId,
          urgenteCodExt: item.codExt,
        },
      });
      await tx.prodPedMerc2.create({
        data: {
          tipoDePedido: TIPO_URGENTE,
          sucursalId,
          urgenteCodExt: item.codExt,
          urgenteCantPedir: cantNorm,
        },
      });
    });

    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al guardar el ítem.";
    return { ok: false, error: message };
  }
}

/**
 * Persiste **A FÁBRICA** en `prod_ped_merc` para todas las sucursales `pedido = true`.
 * Reutiliza `urgente_cod_ext` / `urgente_cant_pedir` (mismo patrón que URGENTE).
 * `reposicion_forma_pedido`: POR_BULTO | UNIDADES_FIJAS (no UNIDADES_MAX).
 */
export async function upsertPedidoMercaderiaAFabricaItem(params: {
  listaPrecioProveedorId: string;
  cant: number;
  formaPedir?: ReposicionFormaPedidoFabrica;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cantNorm = Math.max(0, Math.floor(Number(params.cant) || 0));

  try {
    const item = await prisma.listaPrecioProveedor.findUnique({
      where: { codExt: params.listaPrecioProveedorId },
      select: {
        codExt: true,
        idProveedor: true,
        proveedor: { select: { esFabrica: true } },
      },
    });
    if (!item) return { ok: false, error: "Producto no encontrado." };
    if (!item.proveedor.esFabrica) {
      return { ok: false, error: "El proveedor no está marcado como fábrica." };
    }

    const sucursales = await prisma.sucursal.findMany({
      where: { pedido: true },
      select: { id: true },
      orderBy: { nombre: "asc" },
    });
    if (sucursales.length === 0) {
      return { ok: false, error: "No hay sucursales con pedido habilitado." };
    }

    let forma: ReposicionFormaPedidoFabrica =
      params.formaPedir ?? "UNIDADES_FIJAS";
    if (!params.formaPedir) {
      const existente = await prisma.prodPedMerc2.findFirst({
        where: {
          tipoDePedido: TIPO_A_FABRICA,
          urgenteCodExt: item.codExt,
        },
        select: { reposicionFormaPedido: true },
      });
      const n = normalizarReposicionFormaPedido(existente?.reposicionFormaPedido);
      if (n === "POR_BULTO" || n === "UNIDADES_FIJAS") {
        forma = n;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const s of sucursales) {
        await tx.prodPedMerc2.deleteMany({
          where: {
            tipoDePedido: TIPO_A_FABRICA,
            sucursalId: s.id,
            urgenteCodExt: item.codExt,
          },
        });
        if (cantNorm <= 0) continue;
        await tx.prodPedMerc2.create({
          data: {
            tipoDePedido: TIPO_A_FABRICA,
            sucursalId: s.id,
            urgenteCodExt: item.codExt,
            urgenteCantPedir: cantNorm,
            reposicionFormaPedido: forma,
          },
        });
      }
    });

    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al guardar el ítem.";
    return { ok: false, error: message };
  }
}

export type EstadoPedidoAFabricaPorCodExt = {
  cantAPedirByCodExt: Record<string, number>;
  formaPedirByCodExt: Record<string, ReposicionFormaPedidoFabrica>;
};

/**
 * Mapa `cod_ext` → cant. pedir y forma para filas **A FÁBRICA** del proveedor (todas las sucursales).
 */
export async function buildMapCantAPedirAFabricaPorProveedor(
  proveedorId: string
): Promise<EstadoPedidoAFabricaPorCodExt> {
  const vacio: EstadoPedidoAFabricaPorCodExt = {
    cantAPedirByCodExt: {},
    formaPedirByCodExt: {},
  };
  const pid = proveedorId.trim();
  if (!pid) return vacio;

  const lps = await prisma.listaPrecioProveedor.findMany({
    where: { idProveedor: pid, habilitado: true },
    select: { codExt: true },
  });
  const codExts = [
    ...new Set(
      lps.map((r) => r.codExt?.trim()).filter((c): c is string => Boolean(c))
    ),
  ];
  if (codExts.length === 0) return vacio;

  const rows = await prisma.prodPedMerc2.findMany({
    where: {
      tipoDePedido: TIPO_A_FABRICA,
      urgenteCodExt: { in: codExts },
      urgenteCantPedir: { gt: 0 },
    },
    select: {
      urgenteCodExt: true,
      urgenteCantPedir: true,
      reposicionFormaPedido: true,
    },
  });

  const cantAPedirByCodExt: Record<string, number> = {};
  const formaPedirByCodExt: Record<string, ReposicionFormaPedidoFabrica> = {};
  for (const r of rows) {
    const cod = r.urgenteCodExt?.trim();
    if (!cod) continue;
    const cant = Math.max(0, Math.floor(Number(r.urgenteCantPedir) || 0));
    if (cant <= 0) continue;
    cantAPedirByCodExt[cod] = cant;
    const n = normalizarReposicionFormaPedido(r.reposicionFormaPedido);
    if (n === "POR_BULTO" || n === "UNIDADES_FIJAS") {
      formaPedirByCodExt[cod] = n;
    }
  }
  return { cantAPedirByCodExt, formaPedirByCodExt };
}

export async function upsertPedidoTintometricoItems(
  sucursal: SucursalPedidoEnvio,
  items: ItemPedidoTintometricoPayload[]
): Promise<{ actualizados: number; error?: string }> {
  if (items.length === 0) return { actualizados: 0 };

  let actualizados = 0;

  try {
    const sucursalId = await getSucursalIdByCodigo(sucursal);
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const codTiendaTrim = item.codTienda.trim();
        const codExt = buildCodExtTintometrico(codTiendaTrim, item.codTintometrico);

        const mercTint = await tx.prodPedMerc2.findFirst({
          where: {
            tipoDePedido: TIPO_TINTOMETRICO,
            sucursalId,
            tintometricoProveedor: item.proveedorId.trim(),
            urgenteCodExt: codExt,
          },
          select: { id: true },
        });
        if (mercTint) {
          await tx.prodPedMerc2.update({
            where: { id: mercTint.id },
            data: {
              tintometricoDescripcion: item.descripcion,
              tintometrioCantPedir: item.cantidad,
            },
          });
        } else {
          await tx.prodPedMerc2.create({
            data: {
              tipoDePedido: TIPO_TINTOMETRICO,
              sucursalId,
              tintometricoProveedor: item.proveedorId.trim(),
              tintometricoDescripcion: item.descripcion,
              tintometrioCantPedir: item.cantidad,
              urgenteCodExt: codExt,
            },
          });
        }

        actualizados += 1;
      }
    });

    return { actualizados };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar ítems tintométricos.";
    return { actualizados: 0, error: msg };
  }
}

export async function getPedidoTintometricoItems(): Promise<ItemPedidoTintometricoPersistido[]> {
  const merc2 = await prisma.prodPedMerc2.findMany({
    where: {
      tipoDePedido: TIPO_TINTOMETRICO,
      tintometrioCantPedir: { gt: 0 },
    },
    orderBy: [{ id: "desc" }],
    select: {
      id: true,
      sucursalId: true,
      sucursal: { select: { codigo: true } },
      tintometricoProveedor: true,
      tintometrioCantPedir: true,
      tintometricoDescripcion: true,
      urgenteCodExt: true,
    },
  });

  const desdeMerc2: ItemPedidoTintometricoPersistido[] = merc2
    .filter((r) => (r.tintometricoProveedor ?? "").trim().length > 0)
    .map((r) => ({
      id: r.id,
      sucursalCodigo: r.sucursal.codigo as SucursalPedidoEnvio,
      proveedorId: r.tintometricoProveedor!.trim(),
      codExt: (r.urgenteCodExt ?? "").trim(),
      codTienda: "",
      cantidad: Math.max(0, Math.floor(Number(r.tintometrioCantPedir ?? 0))),
      descripcion: (r.tintometricoDescripcion ?? "").trim(),
    }));

  return desdeMerc2;
}

export async function deletePedidoTintometricoItem(
  params:
    | { id: string }
    | {
        sucursalCodigo: SucursalPedidoEnvio;
        proveedorId: string;
        /** Valor persistido en `urgente_cod_ext` (tintométrico: base + código fórmula). */
        codExt: string;
      }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if ("id" in params) {
      await prisma.prodPedMerc2.deleteMany({
        where: { id: params.id.trim(), tipoDePedido: TIPO_TINTOMETRICO },
      });
      return { ok: true };
    }
    const codExt = params.codExt.trim();
    const sucursalId = await getSucursalIdByCodigo(params.sucursalCodigo);
    await prisma.prodPedMerc2.deleteMany({
      where: {
        tipoDePedido: TIPO_TINTOMETRICO,
        sucursalId,
        tintometricoProveedor: params.proveedorId.trim(),
        urgenteCodExt: codExt,
      },
    });
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al borrar ítem tintométrico.";
    return { ok: false, error: message };
  }
}

/** Ítem para PDF de envío (descripción y cantidad). */
export interface ItemPedidoParaPdf {
  codExt: string;
  codProveedor: string;
  descripcion: string;
  cantPedir: number;
}

/** Proveedor con datos para envío por WhatsApp. */
export interface ProveedorParaEnvio {
  id: string;
  nombre: string;
  prefijo: string;
  whatsapp: string | null;
}

/** Fila de la tabla Generar Pedido (cantidad, proveedor y descripción). */
export interface ItemTablaEnviarPedido {
  cantPedir: number;
  descripcion: string;
  tipoPedido: string;
  sucursal: string;
  proveedor: string;
  proveedorId: string;
}

export type ProveedorPedidoActivoOpcion = {
  id: string;
  nombre: string;
  prefijo: string;
};

/**
 * Proveedores con al menos un ítem en `prod_ped_merc` con cantidad a pedir > 0
 * (misma resolución que `getItemsTablaEnviarPedido`).
 */
export async function getProveedoresConPedidoActivo(params?: {
  sucursalCodigo?: string;
  tipos?: string[];
  soloNoFabrica?: boolean;
}): Promise<ProveedorPedidoActivoOpcion[]> {
  const sucursalCodigo = params?.sucursalCodigo?.trim() || "";
  const tipos = params?.tipos ?? [];
  const soloNoFabrica = params?.soloNoFabrica === true;
  if (!sucursalCodigo || tipos.length === 0) return [];

  const { items } = await getItemsTablaEnviarPedido({
    sucursalCodigo,
    tipos,
  });
  const ids = [...new Set(items.map((i) => i.proveedorId).filter((id) => id.length > 0))];
  if (ids.length === 0) return [];

  const rows = await prisma.proveedor.findMany({
    where: {
      id: { in: ids },
      proveedorMercaderia: true,
      ...(soloNoFabrica ? { esFabrica: false } : {}),
    },
    select: { id: true, nombre: true, prefijo: true },
    orderBy: [{ prefijo: "asc" }, { nombre: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    prefijo: p.prefijo ?? "",
  }));
}

function stockTiendaParaSucursalCodigo(
  codigoSucursal: string,
  codTienda: string,
  stockMaps: MapsStockSucursalesPrincipales
): number {
  return getStockSucursalPrincipal(codTienda, codigoSucursal, stockMaps);
}

function proveedorEtiquetaDesdeRow(p: {
  prefijo: string | null;
  nombre: string | null;
}): string {
  const pref = (p.prefijo ?? "").trim();
  const nom = (p.nombre ?? "").trim();
  return pref.length > 0 ? `[${pref}] ${nom}`.trim().toUpperCase() : nom.toUpperCase();
}

/**
 * Convierte `reposicion_cant_conf` a unidades a pedir.
 * POR_BULTO: `cantConf` es cantidad de bultos; se multiplica por unidades de `prod_tienda.bulto`.
 * Sin bulto válido (≥ 1) → 0. El resto de formas deja `cantConf` en unidades.
 */
export function cantConfReposicionAUnidades(
  forma: ReposicionFormaPedido,
  cantConf: number,
  bulto: number | null | undefined
): number {
  if (forma !== "POR_BULTO") return cantConf;
  const unPorBulto = Math.max(0, Math.floor(Number(bulto ?? 0)));
  if (unPorBulto < 1) return 0;
  return cantConf * unPorBulto;
}

/**
 * Misma regla que `upsertPedidoMercaderiaReposicionConfig`: pedir solo si `stock <= punto`.
 * UNIDADES_MAX → `max(0, cantConf - stock)` (unidades).
 * UNIDADES_FIJAS → `cantConf` (unidades).
 * POR_BULTO → `cantConf × bulto` (`cantConf` = bultos; `bulto` = unidades por bulto).
 */
export function cantPedirReposicionMerc2(params: {
  forma: string | null | undefined;
  punto: number | null | undefined;
  cantConf: number | null | undefined;
  stock: number;
  stockeable: boolean;
  /** Unidades por bulto (`prod_tienda.bulto`). Obligatorio para POR_BULTO. */
  bulto: number | null | undefined;
}): number {
  if (!params.stockeable) return 0;
  const forma = normalizarReposicionFormaPedido(params.forma);
  if (!forma) return 0;
  const punto = Math.max(0, Math.floor(Number(params.punto ?? 0)));
  const cant = Math.max(0, Math.floor(Number(params.cantConf ?? 0)));
  const cantEnUnidades = cantConfReposicionAUnidades(forma, cant, params.bulto);
  if (params.stock > punto) return 0;
  return esFormaCantFijaReposicion(forma)
    ? cantEnUnidades
    : Math.max(0, cantEnUnidades - params.stock);
}

export type LpRowPick = {
  idProveedor: string;
  descripcionProveedor: string;
  codProdProveedor?: string | null;
  codTiendaVinculo: string | null;
  prodTienda?: { codTienda: string } | null;
  proveedor: { prefijo: string | null; nombre: string | null };
};

function pickListaPrecioProveedorUrgente(
  lista: LpRowPick[],
  proveedorIdFiltro?: string
): LpRowPick | null {
  if (lista.length === 0) return null;
  if (proveedorIdFiltro?.trim()) {
    const f = lista.filter((r) => r.idProveedor === proveedorIdFiltro.trim());
    if (f.length > 0) return f[0]!;
  }
  return lista[0] ?? null;
}

/**
 * Ítems con cantidad a pedir > 0 para la tabla **Generar Pedido**.
 * Fuente: `prod_ped_merc` (`ProdPedMerc2`). Sin filtros en URL: todos los tipos y sucursales;
 * cada filtro activo reduce el resultado (post-resolución para proveedor y texto `q`).
 */
export async function getItemsTablaEnviarPedido(params: {
  sucursalCodigo?: string;
  proveedorId?: string;
  tipos?: string[];
  q?: string;
}): Promise<{ items: ItemTablaEnviarPedido[] }> {
  const { sucursalCodigo, proveedorId, tipos, q } = params;
  const qNorm = q?.trim() ? q.trim().toLowerCase() : "";
  const pidFiltro = proveedorId?.trim() || undefined;

  const whereParts: Prisma.ProdPedMerc2WhereInput[] = [];

  if (sucursalCodigo?.trim()) {
    const sucursalRow = await prisma.sucursal.findUnique({
      where: { codigo: sucursalCodigo.trim() },
      select: { id: true },
    });
    if (!sucursalRow) return { items: [] };
    whereParts.push({ sucursalId: sucursalRow.id });
  }

  if (tipos && tipos.length > 0) {
    whereParts.push({ tipoDePedido: { in: tipos } });
  }

  const whereMerc2: Prisma.ProdPedMerc2WhereInput =
    whereParts.length === 0 ? {} : whereParts.length === 1 ? whereParts[0]! : { AND: whereParts };

  const rows = await prisma.prodPedMerc2.findMany({
    where: whereMerc2,
    orderBy: [{ sucursalId: "asc" }, { tipoDePedido: "asc" }, { id: "asc" }],
    select: {
      id: true,
      tipoDePedido: true,
      sucursalId: true,
      urgenteCodExt: true,
      urgenteCantPedir: true,
      tintometricoDescripcion: true,
      tintometrioCantPedir: true,
      tintometricoProveedor: true,
      reposicionFormaPedido: true,
      reposicionPuntoPedido: true,
      reposicionCantConf: true,
      reposicionCantPedir: true,
      reposicionCodTienda: true,
      sucursal: { select: { codigo: true, nombre: true } },
    },
  });

  const codTiendasRepos = new Set<string>();
  const codTiendasTintometrico = new Set<string>();
  const codExts = new Set<string>();
  const idsTintometricoProveedor = new Set<string>();

  for (const r of rows) {
    if (r.tipoDePedido === TIPO_REPOSICION && r.reposicionCodTienda?.trim()) {
      codTiendasRepos.add(r.reposicionCodTienda.trim());
    }
    if (r.tipoDePedido === TIPO_URGENTE && r.urgenteCodExt?.trim()) {
      codExts.add(r.urgenteCodExt.trim());
    }
    if (r.tipoDePedido === TIPO_A_FABRICA && r.urgenteCodExt?.trim()) {
      codExts.add(r.urgenteCodExt.trim());
    }
    if (r.tipoDePedido === TIPO_TINTOMETRICO && r.urgenteCodExt?.trim()) {
      const codTiendaTint = parseCodTiendaFromCodExtTintometrico(r.urgenteCodExt);
      if (codTiendaTint) codTiendasTintometrico.add(codTiendaTint);
    }
    if (r.tipoDePedido === TIPO_TINTOMETRICO && r.tintometricoProveedor?.trim()) {
      idsTintometricoProveedor.add(r.tintometricoProveedor.trim());
    }
  }

  const codTiendasLookup = new Set<string>([
    ...Array.from(codTiendasRepos),
    ...Array.from(codTiendasTintometrico),
  ]);
  const tiendas =
    codTiendasLookup.size > 0
      ? await prisma.prodTienda.findMany({
          where: { codTienda: { in: Array.from(codTiendasLookup) } },
          select: {
            codTienda: true,
            descripcionTienda: true,
          },
        })
      : [];

  const tiendaByCodTienda = new Map<string, (typeof tiendas)[number]>();
  for (const t of tiendas) {
    const ct = (t.codTienda ?? "").trim();
    if (!ct) continue;
    if (!tiendaByCodTienda.has(ct)) tiendaByCodTienda.set(ct, t);
  }

  const codTiendasArr = [...codTiendasLookup];
  const [ivaSaldoReposicion, lpPorCodTiendaRepos, lpRows, stockMaps, stockeableMap, bultosMap] =
    await Promise.all([
    sumarIvaSaldoParaReposicion(),
    cargarListaPrecioReposicionPorCodTiendas([...codTiendasRepos]),
    codExts.size > 0
      ? prisma.listaPrecioProveedor.findMany({
          where: { codExt: { in: Array.from(codExts) }, habilitado: true },
          select: {
            codExt: true,
            idProveedor: true,
            codProdProveedor: true,
            descripcionProveedor: true,
            codTiendaVinculo: true,
            prodTienda: { select: { codTienda: true } },
            proveedor: { select: { prefijo: true, nombre: true } },
          },
          orderBy: [{ idProveedor: "asc" }],
        })
      : Promise.resolve([]),
    buildMapsStockSucursalesPrincipales(codTiendasArr),
    buildMapStockeable(codTiendasArr),
    buildMapBultosProdTienda([...codTiendasRepos]),
  ]);

  const lpPorCodExt = new Map<string, LpRowPick[]>();
  for (const row of lpRows) {
    const k = (row.codExt ?? "").trim();
    if (!k) continue;
    const arr = lpPorCodExt.get(k) ?? [];
    arr.push(row as LpRowPick);
    lpPorCodExt.set(k, arr);
  }

  const proveedoresTintometrico =
    idsTintometricoProveedor.size > 0
      ? await prisma.proveedor.findMany({
          where: { id: { in: Array.from(idsTintometricoProveedor) } },
          select: { id: true, nombre: true, prefijo: true },
        })
      : [];
  const proveedorPorId = new Map(proveedoresTintometrico.map((p) => [p.id, p]));

  const out: ItemTablaEnviarPedido[] = [];

  for (const r of rows) {
    const codigoSuc = (r.sucursal?.codigo ?? "").trim();
    const sucursalLabel =
      codigoSuc && (SUCURSAL_LABEL_PEDIDO as Partial<Record<string, string>>)[codigoSuc]
        ? (SUCURSAL_LABEL_PEDIDO as Partial<Record<string, string>>)[codigoSuc]!
        : r.sucursal?.nombre?.trim() || "";

    let idProveedorResuelto: string | null = null;
    let proveedorEtiqueta = "";
    let descripcion = "";
    let cantPedir = 0;

    if (r.tipoDePedido === TIPO_REPOSICION) {
      const codTi = (r.reposicionCodTienda ?? "").trim();
      const tienda = codTi ? tiendaByCodTienda.get(codTi) : undefined;
      if (!tienda) {
        continue;
      }
      const provRow = elegirListaPrecioProveedorReposicion({
        codTienda: codTi,
        lpPorCodTienda: lpPorCodTiendaRepos,
        ivaSaldoAcumulado: ivaSaldoReposicion,
      });
      if (!provRow) {
        continue;
      }
      idProveedorResuelto = provRow.idProveedor;
      proveedorEtiqueta = proveedorEtiquetaPedidoDesdeRow(provRow.proveedor);
      descripcion = (tienda.descripcionTienda ?? "").trim();
      const stock = stockTiendaParaSucursalCodigo(codigoSuc || "guaymallen", codTi, stockMaps);
      const computedRepos = cantPedirReposicionMerc2({
        forma: r.reposicionFormaPedido,
        punto: r.reposicionPuntoPedido,
        cantConf: r.reposicionCantConf,
        stock,
        stockeable: getStockeableFromMap(stockeableMap, codTi),
        bulto: bultosMap.get(codTi) ?? null,
      });
      // Reposición debe reflejar siempre stock/regla vigentes.
      // No usar `reposicionCantPedir` persistido porque puede quedar desfasado
      // cuando cambia stock tras sincronización.
      cantPedir = computedRepos;
    } else if (r.tipoDePedido === TIPO_URGENTE || r.tipoDePedido === TIPO_A_FABRICA) {
      const codExtU = (r.urgenteCodExt ?? "").trim();
      if (!codExtU) continue;
      const listaLp = lpPorCodExt.get(codExtU) ?? [];
      const provRow = pickListaPrecioProveedorUrgente(listaLp, pidFiltro);
      if (!provRow) continue;
      idProveedorResuelto = provRow.idProveedor;
      proveedorEtiqueta = proveedorEtiquetaDesdeRow(provRow.proveedor);
      descripcion = (provRow.descripcionProveedor ?? "").trim();
      cantPedir = Math.max(0, Math.floor(Number(r.urgenteCantPedir) || 0));
    } else if (r.tipoDePedido === TIPO_TINTOMETRICO) {
      const idProv = (r.tintometricoProveedor ?? "").trim();
      if (!idProv) continue;
      const p = proveedorPorId.get(idProv);
      if (!p) continue;
      const codTiendaTint =
        parseCodTiendaFromCodExtTintometrico(r.urgenteCodExt ?? "") ?? "";
      const codTiendaExisteEnTienda =
        codTiendaTint.length > 0 && tiendaByCodTienda.has(codTiendaTint);
      idProveedorResuelto = p.id;
      proveedorEtiqueta = proveedorEtiquetaDesdeRow(p);
      descripcion = (r.tintometricoDescripcion ?? "").trim();
      cantPedir = Math.max(0, Math.floor(Number(r.tintometrioCantPedir) || 0));
      if (!descripcion && codTiendaExisteEnTienda) {
        descripcion =
          (tiendaByCodTienda.get(codTiendaTint)?.descripcionTienda ?? "").trim();
      }
    } else {
      continue;
    }

    if (pidFiltro && idProveedorResuelto !== pidFiltro) {
      continue;
    }

    if (cantPedir <= 0) continue;

    if (qNorm) {
      const blob = `${descripcion} ${proveedorEtiqueta} ${r.tipoDePedido}`.toLowerCase();
      if (!blob.includes(qNorm)) continue;
    }

    out.push({
      cantPedir,
      tipoPedido: r.tipoDePedido,
      sucursal: sucursalLabel,
      proveedor: proveedorEtiqueta,
      proveedorId: idProveedorResuelto ?? "",
      descripcion,
    });
  }

  return { items: out };
}

export type ConteosPedidoProveedorSlidenav = {
  proveedorId: string;
  proveedor: string;
  urgente: number;
  tintometrico: number;
  reposicion: number;
};

export type ConteosPedidoSlidenav = {
  urgente: number;
  tintometrico: number;
  reposicion: number;
  /** Solo proveedores con al menos un ítem pendiente (cant. pedir > 0). */
  proveedores: ConteosPedidoProveedorSlidenav[];
};

function conteosVaciosProveedorSlidenav(
  proveedorId: string,
  proveedor: string
): ConteosPedidoProveedorSlidenav {
  return {
    proveedorId,
    proveedor,
    urgente: 0,
    tintometrico: 0,
    reposicion: 0,
  };
}

/**
 * Conteos de ítems con cant. pedir > 0 (misma resolución que Generar Pedido)
 * para el indicador de slidenav, filtrados por sucursal y agrupados por proveedor.
 */
export async function contarItemsPedidoPorTipoParaSlidenav(
  sucursalCodigo: string
): Promise<ConteosPedidoSlidenav> {
  const { items } = await getItemsTablaEnviarPedido({
    sucursalCodigo,
    tipos: [TIPO_URGENTE, TIPO_TINTOMETRICO, TIPO_REPOSICION],
  });
  const out: ConteosPedidoSlidenav = {
    urgente: 0,
    tintometrico: 0,
    reposicion: 0,
    proveedores: [],
  };
  const proveedorIds = [...new Set(items.map((it) => it.proveedorId.trim()).filter(Boolean))];
  const proveedoresNoFabrica =
    proveedorIds.length > 0
      ? await prisma.proveedor.findMany({
          where: {
            id: { in: proveedorIds },
            esFabrica: false,
          },
          select: { id: true },
        })
      : [];
  const proveedoresNoFabricaSet = new Set(proveedoresNoFabrica.map((p) => p.id));
  const porProv = new Map<string, ConteosPedidoProveedorSlidenav>();
  for (const it of items) {
    const pid = it.proveedorId.trim();
    if (!pid) continue;
    if (!proveedoresNoFabricaSet.has(pid)) continue;
    let bucket = porProv.get(pid);
    if (!bucket) {
      bucket = conteosVaciosProveedorSlidenav(pid, it.proveedor);
      porProv.set(pid, bucket);
    }
    if (it.tipoPedido === TIPO_URGENTE) {
      bucket.urgente += 1;
      out.urgente += 1;
    } else if (it.tipoPedido === TIPO_TINTOMETRICO) {
      bucket.tintometrico += 1;
      out.tintometrico += 1;
    } else if (it.tipoPedido === TIPO_REPOSICION) {
      bucket.reposicion += 1;
      out.reposicion += 1;
    }
  }
  out.proveedores = [...porProv.values()].sort((a, b) =>
    a.proveedor.localeCompare(b.proveedor, "es")
  );
  return out;
}

/**
 * Fila desde `prod_ped_merc` para PDF y sobrestock (`id` = PK de la fila).
 */
export interface ItemPedidoEnvioRowParaEnviar {
  id: string;
  tipoPedido: string;
  codExt: string;
  codProveedor: string | null;
  tintometricoDescripcion: string | null;
  descripcionProveedor: string | null;
  descripcionTienda: string | null;
  cantPedir: number;
  codTienda: string | null;
  reposicionCantConf: number | null;
}

export interface AjusteCantPedirSobreStockInput {
  idItemPedidoEnvio: string;
  cantPedir: number;
}

/**
 * Obtiene ítems de `prod_ped_merc` para el proveedor, sucursal y tipos dados,
 * y los datos del proveedor (para PDF y WhatsApp).
 * Incluye `rows` para reutilizar en `getSobreStockOtraSucursalParaPedidoEnviar` (mismas filas que el PDF).
 */
export async function getItemsYProveedorParaEnviar(
  proveedorId: string,
  sucursal: string,
  tipos: string[],
  q?: string,
  opts?: {
    incluirFilasConCantCero?: boolean;
    soloIdsMerc?: Set<string>;
    /** Reposición: incluir filas aunque el proveedor ganador sea otro; usa LP del proveedor del pedido. */
    forzarIdsReposicionAlProveedor?: Set<string>;
  }
): Promise<{
  rows: ItemPedidoEnvioRowParaEnviar[];
  items: ItemPedidoParaPdf[];
  proveedor: ProveedorParaEnvio | null;
}> {
  const pid = proveedorId.trim();
  if (!pid || !sucursal.trim() || tipos.length === 0) {
    return { rows: [], items: [], proveedor: null };
  }

  const sucursalRow = await prisma.sucursal.findUnique({
    where: { codigo: sucursal.trim() },
    select: { id: true, codigo: true },
  });
  if (!sucursalRow?.codigo) return { rows: [], items: [], proveedor: null };

  const qNorm = q?.trim() ? q.trim().toLowerCase() : "";

  const [mercRows, proveedor] = await Promise.all([
    prisma.prodPedMerc2.findMany({
      where: {
        sucursalId: sucursalRow.id,
        tipoDePedido: { in: tipos },
      },
      orderBy: [{ id: "asc" }],
      select: {
        id: true,
        tipoDePedido: true,
        sucursalId: true,
        urgenteCodExt: true,
        urgenteCantPedir: true,
        tintometricoDescripcion: true,
        tintometrioCantPedir: true,
        tintometricoProveedor: true,
        reposicionFormaPedido: true,
        reposicionPuntoPedido: true,
        reposicionCantConf: true,
        reposicionCantPedir: true,
        reposicionCodTienda: true,
        sucursal: { select: { codigo: true } },
      },
    }),
    prisma.proveedor.findUnique({
      where: { id: pid },
      select: { id: true, nombre: true, prefijo: true, whatsapp: true },
    }),
  ]);

  const codigoSucursal = (sucursalRow.codigo ?? "").trim();

  const codTiendasRepos = new Set<string>();
  const codTiendasTintometrico = new Set<string>();
  const codExts = new Set<string>();
  const idsTintometricoProveedor = new Set<string>();

  for (const r of mercRows) {
    if (r.tipoDePedido === TIPO_REPOSICION && r.reposicionCodTienda?.trim()) {
      codTiendasRepos.add(r.reposicionCodTienda.trim());
    }
    if (r.tipoDePedido === TIPO_URGENTE && r.urgenteCodExt?.trim()) {
      codExts.add(r.urgenteCodExt.trim());
    }
    if (r.tipoDePedido === TIPO_A_FABRICA && r.urgenteCodExt?.trim()) {
      codExts.add(r.urgenteCodExt.trim());
    }
    if (r.tipoDePedido === TIPO_TINTOMETRICO && r.urgenteCodExt?.trim()) {
      const codTiendaTint = parseCodTiendaFromCodExtTintometrico(r.urgenteCodExt);
      if (codTiendaTint) codTiendasTintometrico.add(codTiendaTint);
    }
    if (r.tipoDePedido === TIPO_TINTOMETRICO && r.tintometricoProveedor?.trim()) {
      idsTintometricoProveedor.add(r.tintometricoProveedor.trim());
    }
  }

  const codTiendasLookup = new Set<string>([
    ...Array.from(codTiendasRepos),
    ...Array.from(codTiendasTintometrico),
  ]);
  const tiendas =
    codTiendasLookup.size > 0
      ? await prisma.prodTienda.findMany({
          where: { codTienda: { in: Array.from(codTiendasLookup) } },
          select: {
            codTienda: true,
            descripcionTienda: true,
          },
        })
      : [];

  const tiendaByCodTienda = new Map<string, (typeof tiendas)[number]>();
  for (const t of tiendas) {
    const ct = (t.codTienda ?? "").trim();
    if (!ct) continue;
    if (!tiendaByCodTienda.has(ct)) tiendaByCodTienda.set(ct, t);
  }

  const codTiendasArrPdf = [...codTiendasLookup];
  const [
    ivaSaldoReposicionPdf,
    lpPorCodTiendaReposPdf,
    lpRowsPdf,
    stockMapsPdf,
    stockeableMapPdf,
    bultosMapPdf,
  ] =
    await Promise.all([
    sumarIvaSaldoParaReposicion(),
    cargarListaPrecioReposicionPorCodTiendas([...codTiendasRepos]),
    codExts.size > 0
      ? prisma.listaPrecioProveedor.findMany({
          where: { codExt: { in: Array.from(codExts) }, habilitado: true },
          select: {
            codExt: true,
            idProveedor: true,
            codProdProveedor: true,
            descripcionProveedor: true,
            codTiendaVinculo: true,
            prodTienda: { select: { codTienda: true } },
            proveedor: { select: { prefijo: true, nombre: true } },
          },
          orderBy: [{ idProveedor: "asc" }],
        })
      : Promise.resolve([]),
    buildMapsStockSucursalesPrincipales(codTiendasArrPdf),
    buildMapStockeable(codTiendasArrPdf),
    buildMapBultosProdTienda([...codTiendasRepos]),
  ]);

  const lpPorCodExt = new Map<string, LpRowPick[]>();
  for (const row of lpRowsPdf) {
    const k = (row.codExt ?? "").trim();
    if (!k) continue;
    const arr = lpPorCodExt.get(k) ?? [];
    arr.push(row as LpRowPick);
    lpPorCodExt.set(k, arr);
  }

  const proveedoresTintometrico =
    idsTintometricoProveedor.size > 0
      ? await prisma.proveedor.findMany({
          where: { id: { in: Array.from(idsTintometricoProveedor) } },
          select: { id: true, nombre: true, prefijo: true },
        })
      : [];
  const proveedorPorId = new Map(proveedoresTintometrico.map((p) => [p.id, p]));

  const rowsOut: ItemPedidoEnvioRowParaEnviar[] = [];

  for (const r of mercRows) {
    if (opts?.soloIdsMerc && !opts.soloIdsMerc.has(r.id)) continue;

    let codExtOut = "";
    let codProveedor: string | null = null;
    let tintometricoDescripcion: string | null = null;
    let descripcionProveedor: string | null = null;
    let descripcionTienda: string | null = null;
    let cantPedir = 0;
    let codTienda: string | null = null;

    if (r.tipoDePedido === TIPO_REPOSICION) {
      const codTi = (r.reposicionCodTienda ?? "").trim();
      const tienda = codTi ? tiendaByCodTienda.get(codTi) : undefined;
      if (!tienda) continue;
      const forzarAlProveedorPedido =
        opts?.forzarIdsReposicionAlProveedor?.has(r.id) === true;
      const provRow = forzarAlProveedorPedido
        ? resolverListaPrecioReposicionParaProveedor({
            codTienda: codTi,
            proveedorId: pid,
            lpPorCodTienda: lpPorCodTiendaReposPdf,
          })
        : elegirListaPrecioProveedorReposicion({
            codTienda: codTi,
            lpPorCodTienda: lpPorCodTiendaReposPdf,
            ivaSaldoAcumulado: ivaSaldoReposicionPdf,
          });
      if (!provRow) continue;
      if (!forzarAlProveedorPedido && provRow.idProveedor !== pid) continue;
      codExtOut = provRow.codExt.trim();
      codProveedor = (provRow.codProdProveedor ?? "").trim() || null;
      tintometricoDescripcion = null;
      descripcionProveedor = (provRow.descripcionProveedor ?? "").trim() || null;
      descripcionTienda = (tienda.descripcionTienda ?? "").trim() || null;
      codTienda = codTi;
      const stock = stockTiendaParaSucursalCodigo(
        codigoSucursal || "guaymallen",
        codTi,
        stockMapsPdf
      );
      const computedRepos = cantPedirReposicionMerc2({
        forma: r.reposicionFormaPedido,
        punto: r.reposicionPuntoPedido,
        cantConf: r.reposicionCantConf,
        stock,
        stockeable: getStockeableFromMap(stockeableMapPdf, codTi),
        bulto: bultosMapPdf.get(codTi) ?? null,
      });
      // Reposición debe reflejar siempre stock/regla vigentes.
      // No usar `reposicionCantPedir` persistido porque puede quedar desfasado
      // cuando cambia stock tras sincronización.
      cantPedir = computedRepos;
    } else if (r.tipoDePedido === TIPO_URGENTE || r.tipoDePedido === TIPO_A_FABRICA) {
      const codExtU = (r.urgenteCodExt ?? "").trim();
      if (!codExtU) continue;
      const listaLp = lpPorCodExt.get(codExtU) ?? [];
      const provRow = pickListaPrecioProveedorUrgente(listaLp, pid);
      if (!provRow || provRow.idProveedor !== pid) continue;
      codExtOut = codExtU;
      codProveedor = (provRow.codProdProveedor ?? "").trim() || null;
      tintometricoDescripcion = null;
      descripcionProveedor = (provRow.descripcionProveedor ?? "").trim() || null;
      descripcionTienda = null;
      codTienda =
        (provRow.prodTienda?.codTienda ?? provRow.codTiendaVinculo ?? "").trim() || null;
      cantPedir = Math.max(0, Math.floor(Number(r.urgenteCantPedir) || 0));
    } else if (r.tipoDePedido === TIPO_TINTOMETRICO) {
      const idProv = (r.tintometricoProveedor ?? "").trim();
      if (!idProv || idProv !== pid) continue;
      const pRow = proveedorPorId.get(idProv);
      if (!pRow) continue;
      const codTiendaTint =
        parseCodTiendaFromCodExtTintometrico(r.urgenteCodExt ?? "") ?? "";
      const codTiendaExisteEnTienda =
        codTiendaTint.length > 0 && tiendaByCodTienda.has(codTiendaTint);
      codExtOut = (r.urgenteCodExt ?? "").trim();
      codProveedor = "";
      tintometricoDescripcion = r.tintometricoDescripcion;
      descripcionProveedor = (r.tintometricoDescripcion ?? "").trim() || null;
      descripcionTienda = codTiendaExisteEnTienda
        ? (tiendaByCodTienda.get(codTiendaTint)?.descripcionTienda ?? "").trim() || null
        : null;
      codTienda = codTiendaExisteEnTienda ? codTiendaTint : null;
      cantPedir = Math.max(0, Math.floor(Number(r.tintometrioCantPedir) || 0));
    } else {
      continue;
    }

    if (!opts?.incluirFilasConCantCero && cantPedir <= 0) continue;

    if (qNorm) {
      const blob = (
        (descripcionProveedor ?? "") +
        " " +
        (descripcionTienda ?? "") +
        " " +
        codExtOut +
        " " +
        r.tipoDePedido
      ).toLowerCase();
      if (!blob.includes(qNorm)) continue;
    }

    rowsOut.push({
      id: r.id,
      tipoPedido: r.tipoDePedido,
      codExt: codExtOut,
      codProveedor,
      tintometricoDescripcion,
      descripcionProveedor,
      descripcionTienda,
      cantPedir,
      codTienda,
      reposicionCantConf: r.reposicionCantConf,
    });
  }

  rowsOut.sort((a, b) => a.codExt.localeCompare(b.codExt));

  const itemsPdf = rowsOut.map((i) => ({
    codExt: i.codExt,
    codProveedor: (i.codProveedor ?? "").trim(),
    descripcion:
      (i.descripcionProveedor ?? "").trim() ||
      (i.tintometricoDescripcion ?? "").trim() ||
      (i.descripcionTienda ?? "").trim(),
    cantPedir: i.cantPedir,
  }));

  const prov = proveedor
    ? {
        id: proveedor.id,
        nombre: proveedor.nombre,
        prefijo: proveedor.prefijo ?? "",
        whatsapp: proveedor.whatsapp ?? null,
      }
    : null;

  return { rows: rowsOut, items: itemsPdf, proveedor: prov };
}

/** Ítem de reposición con proveedor prioritario distinto al seleccionado en Generar Pedido. */
export interface ReposicionProveedorPrioritarioItem {
  idItemPedidoEnvio: string;
  codTienda: string;
  descripcion: string;
  cantPedir: number;
  proveedorPrioritarioId: string;
  proveedorPrioritarioNombre: string;
  proveedorPrioritarioPrefijo: string;
}

/**
 * Reposición con cantidad a pedir > 0 cuyo proveedor ganador (menor costo comparable) no es el
 * proveedor elegido en el modal Generar Pedido, pero el producto **sí** tiene vínculo habilitado
 * con ese proveedor en `prod_precios_provee.cod_tienda`.
 */
export async function getReposicionItemsProveedorPrioritarioAlternativo(params: {
  proveedorSeleccionadoId: string;
  sucursalCodigo: SucursalPedidoEnvio;
}): Promise<ReposicionProveedorPrioritarioItem[]> {
  const pid = params.proveedorSeleccionadoId.trim();
  if (!pid) return [];

  const sucursalRow = await prisma.sucursal.findUnique({
    where: { codigo: params.sucursalCodigo },
    select: { id: true, codigo: true },
  });
  if (!sucursalRow?.codigo) return [];

  const mercRows = await prisma.prodPedMerc2.findMany({
    where: {
      sucursalId: sucursalRow.id,
      tipoDePedido: TIPO_REPOSICION,
    },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      reposicionFormaPedido: true,
      reposicionPuntoPedido: true,
      reposicionCantConf: true,
      reposicionCodTienda: true,
      sucursal: { select: { codigo: true } },
    },
  });

  const codTiendasRepos = new Set<string>();
  for (const r of mercRows) {
    const codTi = r.reposicionCodTienda?.trim();
    if (codTi) codTiendasRepos.add(codTi);
  }
  if (codTiendasRepos.size === 0) return [];

  const codTiendasArr = [...codTiendasRepos];
  const tiendaRows = await prisma.prodTienda.findMany({
    where: { codTienda: { in: codTiendasArr } },
    select: { codTienda: true, descripcionTienda: true },
  });
  const tiendaByCodTienda = new Map(
    tiendaRows.map((t) => {
      const ct = (t.codTienda ?? "").trim();
      return [ct, t] as const;
    })
  );

  const [ivaSaldoReposicion, lpPorCodTiendaRepos, stockMaps, stockeableMap, bultosMap] =
    await Promise.all([
    sumarIvaSaldoParaReposicion(),
    cargarListaPrecioReposicionPorCodTiendas([...codTiendasRepos]),
    buildMapsStockSucursalesPrincipales(codTiendasArr),
    buildMapStockeable(codTiendasArr),
    buildMapBultosProdTienda(codTiendasArr),
  ]);

  const codigoSucursal = (sucursalRow.codigo ?? "").trim();
  const out: ReposicionProveedorPrioritarioItem[] = [];

  for (const r of mercRows) {
    const codTi = (r.reposicionCodTienda ?? "").trim();
    const tienda = codTi ? tiendaByCodTienda.get(codTi) : undefined;
    if (!tienda) continue;

    const vinculados = lpPorCodTiendaRepos.get(codTi) ?? [];
    const vinculadoAlProveedorSeleccionado = vinculados.some((v) => v.idProveedor === pid);
    if (!vinculadoAlProveedorSeleccionado) continue;

    const provRow = elegirListaPrecioProveedorReposicion({
      codTienda: codTi,
      lpPorCodTienda: lpPorCodTiendaRepos,
      ivaSaldoAcumulado: ivaSaldoReposicion,
    });
    if (!provRow || provRow.idProveedor === pid) continue;

    const stock = stockTiendaParaSucursalCodigo(
      codigoSucursal || "guaymallen",
      codTi,
      stockMaps
    );
    const cantPedir = cantPedirReposicionMerc2({
      forma: r.reposicionFormaPedido,
      punto: r.reposicionPuntoPedido,
      cantConf: r.reposicionCantConf,
      stock,
      stockeable: getStockeableFromMap(stockeableMap, codTi),
      bulto: bultosMap.get(codTi) ?? null,
    });
    if (cantPedir <= 0) continue;

    out.push({
      idItemPedidoEnvio: r.id,
      codTienda: codTi,
      descripcion: (tienda.descripcionTienda ?? "").trim(),
      cantPedir,
      proveedorPrioritarioId: provRow.idProveedor,
      proveedorPrioritarioNombre: (provRow.proveedor?.nombre ?? "").trim(),
      proveedorPrioritarioPrefijo: (provRow.proveedor?.prefijo ?? "").trim(),
    });
  }

  out.sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));
  return out;
}

/**
 * Ajusta `cant_pedir` para un subconjunto de ítems del pedido antes de generar snapshot/PDF.
 * Solo permite actualizar filas que pertenezcan al mismo proveedor + sucursal + tipos solicitados.
 */
export async function ajustarCantidadesParaGenerarPedido(params: {
  proveedorId: string;
  sucursalCodigo: SucursalPedidoEnvio;
  tipos: string[];
  ajustes: AjusteCantPedirSobreStockInput[];
}): Promise<ServiceResult<{ actualizados: number }>> {
  const proveedorId = params.proveedorId.trim();
  const tipos = Array.from(new Set(params.tipos.map((t) => t.trim()).filter(Boolean)));
  const ajustes = params.ajustes
    .map((a) => ({
      idItemPedidoEnvio: a.idItemPedidoEnvio.trim(),
      cantPedir: Math.max(0, Math.floor(Number(a.cantPedir) || 0)),
    }))
    .filter((a) => a.idItemPedidoEnvio.length > 0);

  if (!proveedorId) return { success: false, error: "Proveedor inválido." };
  if (!params.sucursalCodigo.trim()) return { success: false, error: "Sucursal inválida." };
  if (tipos.length === 0) return { success: false, error: "Tipos inválidos." };
  if (ajustes.length === 0) return { success: true, data: { actualizados: 0 } };

  try {
    const ids = [...new Set(ajustes.map((a) => a.idItemPedidoEnvio))];
    const cantById = new Map(ajustes.map((a) => [a.idItemPedidoEnvio, a.cantPedir]));

    const { rows: filasPermitidas } = await getItemsYProveedorParaEnviar(
      proveedorId,
      params.sucursalCodigo,
      tipos,
      undefined,
      { incluirFilasConCantCero: true }
    );
    const permitido = new Set(filasPermitidas.map((r) => r.id));
    for (const id of ids) {
      if (!permitido.has(id)) {
        return {
          success: false,
          error:
            "No se pudieron validar todos los ítems de sobrestock para aplicar ajustes.",
        };
      }
    }

    const tipoById = new Map(filasPermitidas.map((r) => [r.id, r.tipoPedido]));

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const cant = cantById.get(id);
        if (cant == null) continue;
        const tipo = tipoById.get(id);
        if (!tipo) continue;

        await tx.prodPedMerc2.update({
          where: { id },
          data: {
            ...(tipo === TIPO_URGENTE || tipo === TIPO_A_FABRICA
              ? { urgenteCantPedir: cant }
              : {}),
            ...(tipo === TIPO_TINTOMETRICO ? { tintometrioCantPedir: cant } : {}),
            ...(tipo === TIPO_REPOSICION ? { reposicionCantPedir: cant } : {}),
          },
        });
      }
    });

    return { success: true, data: { actualizados: ids.length } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al ajustar cantidades del pedido.";
    return { success: false, error: msg };
  }
}

/**
 * Tras generar el PDF de un proveedor, borra sus ítems URGENTE / TINTOMÉTRICO / A FÁBRICA
 * en la sucursal (A FÁBRICA también en el resto de sucursales `pedido`, misma cant. total).
 * No debe afectar pedidos del mismo tipo de otros proveedores.
 */
export async function limpiarPedidoMercaderiaTrasGenerarPdf(params: {
  sucursalId: string;
  proveedorId: string;
  tipos: string[];
}): Promise<void> {
  const pid = params.proveedorId.trim();
  if (!pid || !params.sucursalId) return;

  const tiposBorrar = params.tipos.filter(
    (t) =>
      t === TIPO_URGENTE || t === TIPO_TINTOMETRICO || t === TIPO_A_FABRICA
  );
  if (tiposBorrar.length === 0) return;

  if (tiposBorrar.includes(TIPO_TINTOMETRICO)) {
    await prisma.prodPedMerc2.deleteMany({
      where: {
        sucursalId: params.sucursalId,
        tipoDePedido: TIPO_TINTOMETRICO,
        tintometricoProveedor: pid,
      },
    });
  }

  const necesitaCodExts =
    tiposBorrar.includes(TIPO_URGENTE) || tiposBorrar.includes(TIPO_A_FABRICA);
  const filasLp = necesitaCodExts
    ? await prisma.listaPrecioProveedor.findMany({
        where: { idProveedor: pid },
        select: { codExt: true },
      })
    : [];
  const codExts = filasLp
    .map((r) => r.codExt?.trim())
    .filter((c): c is string => !!c);

  if (tiposBorrar.includes(TIPO_URGENTE) && codExts.length > 0) {
    await prisma.prodPedMerc2.deleteMany({
      where: {
        sucursalId: params.sucursalId,
        tipoDePedido: TIPO_URGENTE,
        urgenteCodExt: { in: codExts },
      },
    });
  }

  if (tiposBorrar.includes(TIPO_A_FABRICA) && codExts.length > 0) {
    await prisma.prodPedMerc2.deleteMany({
      where: {
        tipoDePedido: TIPO_A_FABRICA,
        urgenteCodExt: { in: codExts },
      },
    });
  }
}
