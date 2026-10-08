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
  listarNombresMarcasProdPropios,
  listarNombresRubrosProdPropios,
  nombresCatalogoProdPropio,
  SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
  whereCatalogoProdPropio,
} from "@/services/prodPropiosCatalogos.service";
import {
  buildMapSaldoStockPorSucursal,
  obtenerSucursalIdPorCodigo,
} from "@/services/stockMovimientos.service";

export type Sucursal = "guaymallen" | "maipu";

export interface ItemStock {
  /** `cod_tienda` (`prod_lista`); clave estable para tabla. */
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
 * Datos para Control Stock desde prod_lista.
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
    parts.push(
      ...whereCatalogoProdPropio({
        marca: exclude !== "marca" ? marca : "",
        rubro: exclude !== "rubro" ? rubro : "",
      })
    );
    return parts;
  }

  const whereItems: Prisma.ProdPropioWhereInput =
    baseWhere().length > 0 ? { AND: baseWhere() } : {};

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

    const sucursalId = await obtenerSucursalIdPorCodigo(sucursal);
    const saldos = sucursalId
      ? await buildMapSaldoStockPorSucursal(
          rows.map((r) => r.codTienda),
          sucursalId
        )
      : new Map<string, number>();

    const items: ItemStock[] = rows.map((r) => {
      const { marca: marcaItem, rubro: rubroItem } = nombresCatalogoProdPropio(r);
      return {
        id: r.codTienda,
        codItem: r.codTienda,
        descripcion: r.descripcionTienda ?? "",
        marca: marcaItem,
        rubro: rubroItem,
        stock: saldos.get(r.codTienda) ?? 0,
      };
    });

    const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

    return {
      items,
      total,
      totalPaginas,
      marcas,
      rubros,
    };
  } catch (e) {
    console.error("[getControlStock]", e);
    return emptyControlStock;
  }
}
