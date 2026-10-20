import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { PAGE_SIZE } from "@/lib/pagination";
import type { ServiceResult } from "@/types";
import {
  mensajeViolaPisoReposicionCorp,
  valoresReposicionVendedor,
  type ReglaReposicionValores,
} from "@/lib/reposicionCorp";
import {
  getReposicionParamsSchema,
  type ReposicionFormaPedidoVendedor,
} from "@/lib/validations/reposicion";
import {
  listarNombresMarcasProdPropios,
  listarNombresRubrosProdPropios,
  whereCatalogoProdPropio,
} from "@/services/prodPropiosCatalogos.service";
import {
  bultoProdTiendaValido,
  buildMapBultosProdTienda,
  guardarBultoProdTienda,
} from "@/services/tiendaBultos.service";

export type ItemReposicionCorp = {
  codTienda: string;
  descripcionTienda: string | null;
  formaPedir: ReposicionFormaPedidoVendedor | "";
  puntoReposicion: number;
  cant: number;
  bulto: number | null;
  configurado: boolean;
};

export type ReposicionCorpData = {
  items: ItemReposicionCorp[];
  total: number;
  totalPaginas: number;
  marcas: string[];
  rubros: string[];
};

export async function listarReglasReposicionCorpPorCodigos(
  codigos: readonly string[]
): Promise<Map<string, ReglaReposicionValores>> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  const out = new Map<string, ReglaReposicionValores>();
  if (unicos.length === 0) return out;
  const rows = await prisma.prodPedReposicionCorp.findMany({
    where: { codTienda: { in: unicos } },
    select: {
      codTienda: true,
      formaPedido: true,
      puntoPedido: true,
      cantConf: true,
    },
  });
  for (const row of rows) {
    const valores = valoresReposicionVendedor(
      row.formaPedido,
      row.puntoPedido,
      row.cantConf
    );
    if (!valores) continue;
    out.set(row.codTienda.trim(), valores);
  }
  return out;
}

export async function obtenerReglaReposicionCorp(
  codTienda: string
): Promise<ReglaReposicionValores | null> {
  const map = await listarReglasReposicionCorpPorCodigos([codTienda]);
  return map.get(codTienda.trim()) ?? null;
}

export async function upsertReglaReposicionCorp(input: {
  codTienda: string;
  formaPedir: ReposicionFormaPedidoVendedor;
  puntoReposicion: number;
  cant: number;
  unidadesPorBulto?: number;
}): Promise<ServiceResult<void>> {
  const codT = input.codTienda.trim();
  if (!codT) return { success: false, error: "Código tienda requerido." };
  const tienda = await prisma.prodPropio.findUnique({
    where: { codTienda: codT },
    select: { codTienda: true },
  });
  if (!tienda) {
    return { success: false, error: "No se encontró el producto en prod_lista." };
  }
  if (input.formaPedir === "POR_BULTO") {
    if (input.unidadesPorBulto != null) {
      const saved = await guardarBultoProdTienda(codT, input.unidadesPorBulto);
      if (!saved.success) return { success: false, error: saved.error };
    }
    const bultosMap = await buildMapBultosProdTienda([codT]);
    const bulto = bultosMap.get(codT);
    if (bulto == null || bulto < 1) {
      return { success: false, error: "Completá Un. por bulto." };
    }
  }
  try {
    await prisma.prodPedReposicionCorp.upsert({
      where: { codTienda: codT },
      create: {
        codTienda: codT,
        formaPedido: input.formaPedir,
        puntoPedido: input.puntoReposicion,
        cantConf: input.cant,
      },
      update: {
        formaPedido: input.formaPedir,
        puntoPedido: input.puntoReposicion,
        cantConf: input.cant,
      },
    });
    await asegurarFilasReposicionSucursalDesdeCorp(codT, {
      forma: input.formaPedir,
      punto: input.puntoReposicion,
      cantConf: input.cant,
    });
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error al guardar la reposición corporativa.";
    console.error("[reposicionCorp] upsertReglaReposicionCorp:", e);
    return { success: false, error: message };
  }
}

export async function deleteReglaReposicionCorp(
  codTienda: string
): Promise<ServiceResult<void>> {
  const codT = codTienda.trim();
  if (!codT) return { success: false, error: "Código tienda requerido." };
  try {
    await prisma.prodPedReposicionCorp.deleteMany({ where: { codTienda: codT } });
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error al borrar la reposición corporativa.";
    console.error("[reposicionCorp] deleteReglaReposicionCorp:", e);
    return { success: false, error: message };
  }
}

/** Crea la fila REPOSICION de sucursal si no existe (mismo valor que el piso). No pisa overrides. */
export async function asegurarFilasReposicionSucursalDesdeCorp(
  codTienda: string,
  corp: ReglaReposicionValores
): Promise<void> {
  const sucursales = await prisma.sucursal.findMany({
    where: { pedido: true },
    select: { id: true },
  });
  if (sucursales.length === 0) return;
  const existentes = await prisma.prodPedMerc2.findMany({
    where: {
      tipoDePedido: "REPOSICION",
      reposicionCodTienda: codTienda,
      sucursalId: { in: sucursales.map((s) => s.id) },
    },
    select: { sucursalId: true },
  });
  const ya = new Set(existentes.map((e) => e.sucursalId));
  const faltan = sucursales.filter((s) => !ya.has(s.id));
  if (faltan.length === 0) return;
  await prisma.prodPedMerc2.createMany({
    data: faltan.map((s) => ({
      tipoDePedido: "REPOSICION",
      sucursalId: s.id,
      reposicionCodTienda: codTienda,
      reposicionFormaPedido: corp.forma,
      reposicionPuntoPedido: corp.punto,
      reposicionCantConf: corp.cantConf,
    })),
  });
}

export async function validarPisoReposicionCorp(params: {
  codTienda: string;
  formaPedir: ReposicionFormaPedidoVendedor;
  puntoReposicion: number;
  cant: number;
  bulto: number | null | undefined;
}): Promise<string | null> {
  const piso = await obtenerReglaReposicionCorp(params.codTienda);
  if (!piso) return null;
  return mensajeViolaPisoReposicionCorp(
    piso,
    {
      forma: params.formaPedir,
      punto: params.puntoReposicion,
      cantConf: params.cant,
    },
    params.bulto
  );
}

export async function listarReposicionCorpData(raw: {
  q?: string;
  marca?: string;
  rubro?: string;
  configurado?: "" | "si";
  pagina?: number;
}): Promise<ReposicionCorpData> {
  const parsed = getReposicionParamsSchema.safeParse({
    q: raw.q ?? "",
    marca: raw.marca ?? "",
    rubro: raw.rubro ?? "",
    configurado: raw.configurado ?? "",
    pagina: raw.pagina ?? 1,
  });
  const q = parsed.success ? parsed.data.q : "";
  const marca = parsed.success ? parsed.data.marca : "";
  const rubro = parsed.success ? parsed.data.rubro : "";
  const configurado = parsed.success ? parsed.data.configurado : "";
  const paginaNum = parsed.success ? parsed.data.pagina : 1;
  const skip = (paginaNum - 1) * PAGE_SIZE;

  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);
  const parts: Prisma.ProdPropioWhereInput[] = [];
  if (textFilter.AND?.length) parts.push(textFilter);
  parts.push(...whereCatalogoProdPropio({ marca, rubro, subRubro: "" }));
  if (configurado === "si") {
    parts.push({ reposicionCorp: { isNot: null } });
  }
  const whereItems: Prisma.ProdPropioWhereInput =
    parts.length > 0 ? { AND: parts } : {};

  const whereOpciones = (
    exclude: "marca" | "rubro"
  ): Prisma.ProdPropioWhereInput => {
    const op: Prisma.ProdPropioWhereInput[] = [];
    if (textFilter.AND?.length) op.push(textFilter);
    op.push(
      ...whereCatalogoProdPropio({
        marca: exclude === "marca" ? "" : marca,
        rubro: exclude === "rubro" ? "" : rubro,
        subRubro: "",
      })
    );
    if (configurado === "si") op.push({ reposicionCorp: { isNot: null } });
    return { AND: op };
  };

  try {
    const [rows, total, marcas, rubros] = await Promise.all([
      prisma.prodPropio.findMany({
        where: whereItems,
        orderBy: { descripcionTienda: "asc" },
        skip,
        take: PAGE_SIZE,
        select: {
          codTienda: true,
          descripcionTienda: true,
          bulto: true,
          reposicionCorp: {
            select: {
              formaPedido: true,
              puntoPedido: true,
              cantConf: true,
            },
          },
        },
      }),
      prisma.prodPropio.count({ where: whereItems }),
      listarNombresMarcasProdPropios(whereOpciones("marca")),
      listarNombresRubrosProdPropios(whereOpciones("rubro")),
    ]);

    const items: ItemReposicionCorp[] = rows.map((r) => {
      const corp = r.reposicionCorp
        ? valoresReposicionVendedor(
            r.reposicionCorp.formaPedido,
            r.reposicionCorp.puntoPedido,
            r.reposicionCorp.cantConf
          )
        : null;
      return {
        codTienda: r.codTienda,
        descripcionTienda: r.descripcionTienda,
        formaPedir: corp?.forma ?? "",
        puntoReposicion: corp?.punto ?? 0,
        cant: corp?.cantConf ?? 0,
        bulto: bultoProdTiendaValido(r.bulto),
        configurado: corp != null,
      };
    });

    return {
      items,
      total,
      totalPaginas: total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE),
      marcas,
      rubros,
    };
  } catch (e: unknown) {
    console.error("[reposicionCorp] listarReposicionCorpData:", e);
    return {
      items: [],
      total: 0,
      totalPaginas: 1,
      marcas: [],
      rubros: [],
    };
  }
}
