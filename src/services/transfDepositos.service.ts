import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { PAGE_SIZE } from "@/lib/pagination";
import { whereProdTiendaStockeable } from "@/services/prodTiendaStock.service";
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
 * Catálogo de **Trans. Depósitos** (`prod_tienda`) con saldo del ledger
 * (`stock_movimientos`) en origen y destino para la página actual.
 */
export async function listarCatalogoTransfDepositos(
  input: ListarCatalogoTransfDepositosInput
): Promise<TransfDepositosData> {
  const { origen, destino, q, marca, rubro, pagina } = input;
  const skip = (Math.max(1, pagina) - 1) * PAGE_SIZE;
  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);

  function baseWhere(exclude?: "marca" | "rubro"): Prisma.ProdTiendaWhereInput[] {
    const parts: Prisma.ProdTiendaWhereInput[] = [whereProdTiendaStockeable()];
    if (textFilter.AND?.length) parts.push(textFilter);
    if (exclude !== "marca" && marca) parts.push({ marca });
    if (exclude !== "rubro" && rubro) parts.push({ rubro });
    return parts;
  }

  const whereItems: Prisma.ProdTiendaWhereInput = { AND: baseWhere() };
  const whereMarcas: Prisma.ProdTiendaWhereInput = {
    AND: [...baseWhere("marca"), { marca: { not: null } }],
  };
  const whereRubros: Prisma.ProdTiendaWhereInput = {
    AND: [...baseWhere("rubro"), { rubro: { not: null } }],
  };

  try {
    const [rows, total, marcasDistinct, rubrosDistinct] = await Promise.all([
      prisma.prodTienda.findMany({
        where: whereItems,
        orderBy: { descripcionTienda: "asc" },
        skip,
        take: PAGE_SIZE,
        select: {
          codTienda: true,
          descripcionTienda: true,
          marca: true,
          rubro: true,
        },
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
      marca: r.marca,
      rubro: r.rubro,
      stockOrigen: saldosOrigen ? (saldosOrigen.get(r.codTienda) ?? 0) : null,
      stockDestino: saldosDestino ? (saldosDestino.get(r.codTienda) ?? 0) : null,
    }));

    return {
      ...TRANSF_DEPOSITOS_DATA_VACIO,
      items,
      total,
      totalPaginas: total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE),
      marcas: marcasDistinct.flatMap((m) => (m.marca ? [m.marca] : [])),
      rubros: rubrosDistinct.flatMap((r) => (r.rubro ? [r.rubro] : [])),
    };
  } catch (e) {
    console.error("[listarCatalogoTransfDepositos]", e);
    return TRANSF_DEPOSITOS_DATA_VACIO;
  }
}
