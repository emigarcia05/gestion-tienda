import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { PAGE_SIZE } from "@/lib/pagination";
import { whereProdTiendaStockeable } from "@/services/prodTiendaStock.service";
import {
  listarNombresMarcasProdPropios,
  listarNombresRubrosProdPropios,
  SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
  whereCatalogoProdPropio,
} from "@/services/prodPropiosCatalogos.service";
import {
  buildMapSaldoStockPorSucursal,
  obtenerSucursalIdPorCodigo,
} from "@/services/stockMovimientos.service";
import {
  TRANSF_DEPOSITOS_DATA_VACIO,
  type ItemTransfDepositos,
  type SucursalTransf,
  type TransfDepositosData,
} from "@/lib/transfDepositosTypes";

export interface ListarCatalogoTransfDepositosInput {
  origen: SucursalTransf;
  destino: SucursalTransf | null;
  q: string;
  marca: string;
  rubro: string;
  pagina: number;
}

async function saldosPorCodigo(
  codigoSucursal: SucursalTransf | null,
  codItems: string[]
): Promise<Map<string, number> | null> {
  if (!codigoSucursal) return null;
  const sucursalId = await obtenerSucursalIdPorCodigo(codigoSucursal);
  if (!sucursalId) return null;
  return buildMapSaldoStockPorSucursal(codItems, sucursalId);
}

/**
 * Catálogo de **Trans. Depósitos** (`prod_lista`) con saldo del ledger
 * (`stock_movimientos`) en origen y destino para la página actual.
 */
export async function listarCatalogoTransfDepositos(
  input: ListarCatalogoTransfDepositosInput
): Promise<TransfDepositosData> {
  const { origen, destino, q, marca, rubro, pagina } = input;
  const skip = (Math.max(1, pagina) - 1) * PAGE_SIZE;
  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);

  function baseWhere(exclude?: "marca" | "rubro"): Prisma.ProdPropioWhereInput[] {
    const parts: Prisma.ProdPropioWhereInput[] = [whereProdTiendaStockeable()];
    if (textFilter.AND?.length) parts.push(textFilter);
    parts.push(
      ...whereCatalogoProdPropio({
        marca: exclude !== "marca" ? marca : "",
        rubro: exclude !== "rubro" ? rubro : "",
      })
    );
    return parts;
  }

  const whereItems: Prisma.ProdPropioWhereInput = { AND: baseWhere() };

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
          ...SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
        },
      }),
      prisma.prodPropio.count({ where: whereItems }),
      listarNombresMarcasProdPropios({ AND: baseWhere("marca") }),
      listarNombresRubrosProdPropios({ AND: baseWhere("rubro") }),
    ]);

    const codigos = rows.map((r) => r.codTienda);
    const [saldosOrigen, saldosDestino] = await Promise.all([
      saldosPorCodigo(origen, codigos),
      saldosPorCodigo(destino, codigos),
    ]);

    const items: ItemTransfDepositos[] = rows.map((r) => ({
      id: r.codTienda,
      codItem: r.codTienda,
      descripcion: r.descripcionTienda ?? "",
      marca: r.marcaRelation?.nombre ?? null,
      rubro: r.rubroRelation?.nombre ?? null,
      stockOrigen: saldosOrigen ? (saldosOrigen.get(r.codTienda) ?? 0) : null,
      stockDestino: saldosDestino ? (saldosDestino.get(r.codTienda) ?? 0) : null,
    }));

    return {
      ...TRANSF_DEPOSITOS_DATA_VACIO,
      items,
      total,
      totalPaginas: total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE),
      marcas,
      rubros,
    };
  } catch (e) {
    console.error("[listarCatalogoTransfDepositos]", e);
    return TRANSF_DEPOSITOS_DATA_VACIO;
  }
}
