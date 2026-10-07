"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { z } from "zod";
import { PAGE_SIZE } from "@/lib/pagination";
import { getControlStockParamsSchema } from "@/lib/validations/stock";
import { whereProdTiendaStockeable } from "@/services/prodTiendaStock.service";
import {
  buildMapSaldoStockPorSucursal,
  obtenerSucursalIdPorCodigo,
} from "@/services/stockMovimientos.service";

export type Sucursal = "guaymallen" | "maipu";

export interface ItemStock {
  /** `cod_tienda` (`prod_propios`); clave estable para tabla. */
  id: string;
  codItem: string;
  descripcion: string;
  marca: string | null;
  rubro: string | null;
  stock: number;
}

export interface ControlStockData {
  items: ItemStock[];
  total: number;
  totalPaginas: number;
  marcas: string[];
  rubros: string[];
}

export interface GetControlStockParams {
  q?: string;
  marca?: string;
  rubro?: string;
  soloNegativo?: boolean;
  pagina?: number;
}

const emptyControlStock: ControlStockData = {
  items: [],
  total: 0,
  totalPaginas: 0,
  marcas: [],
  rubros: [],
};

/**
 * Datos para Control Stock desde prod_propios.
 * STOCK: saldo de `stock_movimientos` (ingresos − egresos) por sucursal.
 * Requiere permiso PERMISOS.stock.acceso.
 */
export async function getControlStock(
  sucursal: Sucursal | null,
  params: GetControlStockParams = {}
): Promise<ControlStockData> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return emptyControlStock;
  }
  if (!sucursal) {
    return emptyControlStock;
  }
  if (!z.enum(["guaymallen", "maipu"]).safeParse(sucursal).success) {
    return emptyControlStock;
  }

  const parsedParams = getControlStockParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return emptyControlStock;
  }
  const {
    q = "",
    marca = "",
    rubro = "",
    soloNegativo: _soloNegativo = false,
    pagina: paginaNum = 1,
  } = parsedParams.data;
  const skip = (paginaNum - 1) * PAGE_SIZE;

  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);

  function baseWhere(exclude?: "marca" | "rubro"): Prisma.ProdPropioWhereInput[] {
    const parts: Prisma.ProdPropioWhereInput[] = [whereProdTiendaStockeable()];
    if (textFilter.AND?.length) parts.push(textFilter);
    if (exclude !== "marca" && marca) parts.push({ marca });
    if (exclude !== "rubro" && rubro) parts.push({ rubro });
    return parts;
  }

  const toWhereWithNotNull = (
    exclude: "marca" | "rubro"
  ): Prisma.ProdPropioWhereInput => {
    const parts = baseWhere(exclude);
    const key = exclude;
    const notNull = { [key]: { not: null } } as Prisma.ProdPropioWhereInput;
    return parts.length > 0 ? { AND: [...parts, notNull] } : notNull;
  };

  const whereItems: Prisma.ProdPropioWhereInput =
    baseWhere().length > 0 ? { AND: baseWhere() } : {};
  const whereMarcas = toWhereWithNotNull("marca");
  const whereRubros = toWhereWithNotNull("rubro");

  try {
    const [rows, total, marcasDistinct, rubrosDistinct] = await Promise.all([
      prisma.prodPropio.findMany({
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
      prisma.prodPropio.count({ where: whereItems }),
      prisma.prodPropio.findMany({
        select: { marca: true },
        distinct: ["marca"],
        where: whereMarcas,
        orderBy: { marca: "asc" },
      }),
      prisma.prodPropio.findMany({
        select: { rubro: true },
        distinct: ["rubro"],
        where: whereRubros,
        orderBy: { rubro: "asc" },
      }),
    ]);

    const sucursalId = await obtenerSucursalIdPorCodigo(sucursal);
    const saldos = sucursalId
      ? await buildMapSaldoStockPorSucursal(
          rows.map((r) => r.codTienda),
          sucursalId
        )
      : new Map<string, number>();

    const items: ItemStock[] = rows.map((r) => ({
      id: r.codTienda,
      codItem: r.codTienda,
      descripcion: r.descripcionTienda ?? "",
      marca: r.marca,
      rubro: r.rubro,
      stock: saldos.get(r.codTienda) ?? 0,
    }));

    const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

    return {
      items,
      total,
      totalPaginas,
      marcas: marcasDistinct.filter((m) => m.marca != null).map((m) => m.marca!),
      rubros: rubrosDistinct.filter((r) => r.rubro != null).map((r) => r.rubro!),
    };
  } catch (e) {
    console.error("[getControlStock]", e);
    return emptyControlStock;
  }
}
