"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { requireStockAcceso } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  getControlStockParamsSchema,
  registrarControlStockExportacionSchema,
} from "@/lib/validations/stock";
import {
  listarHistorialTransfDepositosProductoSchema,
  parSucursalesTransfDepositosSchema,
  registrarTransferenciasDepositosSchema,
} from "@/lib/validations/transfDepositos";
import { GP_INTERNAL, GP_ROUTES } from "@/lib/gestionProductosRoutes";
import {
  getIdDepositoPorSucursalCodigo,
  whereProdTiendaStockeable,
} from "@/services/prodTiendaStock.service";

export type Sucursal = "guaymallen" | "maipu";

export interface ItemStock {
  /** `cod_tienda` (`prod_tienda`); clave estable para tabla y export Excel. */
  id:              string;
  codItem:         string;
  descripcion:     string;
  marca:           string | null;
  rubro:           string | null;
  stock:           number;
  /** ISO 8601 (serializable RSC → cliente). */
  ultimaExportacionExcel: string | null;
}

export interface ControlStockData {
  items:         ItemStock[];
  total:         number;
  totalPaginas:  number;
  marcas:        string[];
  rubros:        string[];
}

export interface GetControlStockParams {
  q?: string;
  marca?: string;
  rubro?: string;
  soloNegativo?: boolean;
  orden?: string;
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
 * Datos para Control Stock desde prod_tienda.
 * Filtros: MARCA → marca, RUBRO → rubro, SUB-RUBRO → sub_rubro.
 * Opciones de cada desplegable según docs/FILTROS_DINAMICOS.md (valores que existen con los demás filtros).
 * STOCK = `prod_tienda_stock.stock_real` del depósito DUX de la sucursal (Maipú / Guaymallén).
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
    soloNegativo = false,
    orden = "",
    pagina: paginaNum = 1,
  } = parsedParams.data;
  const skip = (paginaNum - 1) * PAGE_SIZE;

  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);
  const idDepositoSucursal = getIdDepositoPorSucursalCodigo(sucursal);

  function baseWhere(exclude?: "marca" | "rubro"): Prisma.ProdTiendaWhereInput[] {
    const parts: Prisma.ProdTiendaWhereInput[] = [whereProdTiendaStockeable()];
    if (textFilter.AND?.length) parts.push(textFilter);
    if (exclude !== "marca" && marca) parts.push({ marca });
    if (exclude !== "rubro" && rubro) parts.push({ rubro });
    if (soloNegativo) {
      parts.push({
        stocks: {
          some: {
            idDeposito: idDepositoSucursal,
            stockReal: { lt: 0 },
          },
        },
      });
    }
    return parts;
  }

  const toWhereWithNotNull = (
    exclude: "marca" | "rubro"
  ): Prisma.ProdTiendaWhereInput => {
    const parts = baseWhere(exclude);
    const key = exclude;
    const notNull = { [key]: { not: null } } as Prisma.ProdTiendaWhereInput;
    return parts.length > 0 ? { AND: [...parts, notNull] } : notNull;
  };

  const whereItems: Prisma.ProdTiendaWhereInput =
    baseWhere().length > 0 ? { AND: baseWhere() } : {};
  const whereMarcas = toWhereWithNotNull("marca");
  const whereRubros = toWhereWithNotNull("rubro");

  try {
    const [rows, total, marcasDistinct, rubrosDistinct] = await Promise.all([
      prisma.prodTienda.findMany({
        where: whereItems,
        orderBy:
          orden === "segunTiempoControl"
            ? [
                { ultimaExportacionExcel: { sort: "asc", nulls: "first" } },
                { descripcionTienda: "asc" },
              ]
            : { descripcionTienda: "asc" },
        skip,
        take: PAGE_SIZE,
        include: {
          stocks: {
            where: { idDeposito: idDepositoSucursal },
            select: { stockReal: true },
          },
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

    const items: ItemStock[] = rows.map((r) => ({
      id: r.codTienda,
      codItem: r.codTienda,
      descripcion: r.descripcionTienda ?? "",
      marca: r.marca,
      rubro: r.rubro,
      stock: r.stocks[0]?.stockReal ?? 0,
      ultimaExportacionExcel: r.ultimaExportacionExcel?.toISOString() ?? null,
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

export interface ItemTransfDepositos {
  /** `cod_tienda` (`prod_tienda`); clave estable para tabla. */
  id: string;
  codItem: string;
  descripcion: string;
  marca: string | null;
  rubro: string | null;
}

export type ControlTransfDepositosRecienteDto = {
  codTienda: string;
  cantidad: number;
  createdAtIso: string;
};

export type PendienteTransfDepositoItemDto = {
  codTienda: string;
  descripcionTienda: string;
  cantidad: number;
};

export type HistorialTransfDepositosItemDto = {
  createdAtIso: string;
  cantidad: number;
};

export type HistorialTransfDepositosSeccionDto = {
  origenCodigo: Sucursal;
  destinoCodigo: Sucursal;
  titulo: string;
  items: HistorialTransfDepositosItemDto[];
};

export interface TransfDepositosData {
  items: ItemTransfDepositos[];
  total: number;
  totalPaginas: number;
  marcas: string[];
  rubros: string[];
  /** Controles del par origen→destino en la ventana anti-duplicado. */
  controlesRecientes: ControlTransfDepositosRecienteDto[];
  /** Lote pendiente (antes de Transferido) para hidratar la grilla. */
  pendientes: PendienteTransfDepositoItemDto[];
}

export interface GetTransfDepositosParams {
  q?: string;
  marca?: string;
  rubro?: string;
  pagina?: number;
}

const emptyTransfDepositos: TransfDepositosData = {
  items: [],
  total: 0,
  totalPaginas: 0,
  marcas: [],
  rubros: [],
  controlesRecientes: [],
  pendientes: [],
};

/**
 * Listado para **Trans. Depósitos**: catálogo stockeable (descripción / filtros).
 * **No** expone `stock_real`: la UI solo captura cantidades a transferir.
 * Con origen+destino distintos, adjunta controles recientes (anti-duplicado).
 * Requiere permiso `PERMISOS.stock.acceso` y sucursal origen.
 */
export async function getTransfDepositos(
  origen: Sucursal | null,
  destino: Sucursal | null = null,
  params: GetTransfDepositosParams = {}
): Promise<TransfDepositosData> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return emptyTransfDepositos;
  }
  if (!origen || !z.enum(["guaymallen", "maipu"]).safeParse(origen).success) {
    return emptyTransfDepositos;
  }
  const destinoOk =
    destino !== null &&
    z.enum(["guaymallen", "maipu"]).safeParse(destino).success &&
    destino !== origen
      ? destino
      : null;

  const parsedParams = getControlStockParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return emptyTransfDepositos;
  }
  const {
    q = "",
    marca = "",
    rubro = "",
    pagina: paginaNum = 1,
  } = parsedParams.data;
  const skip = (paginaNum - 1) * PAGE_SIZE;

  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);

  function baseWhere(exclude?: "marca" | "rubro"): Prisma.ProdTiendaWhereInput[] {
    const parts: Prisma.ProdTiendaWhereInput[] = [whereProdTiendaStockeable()];
    if (textFilter.AND?.length) parts.push(textFilter);
    if (exclude !== "marca" && marca) parts.push({ marca });
    if (exclude !== "rubro" && rubro) parts.push({ rubro });
    return parts;
  }

  const toWhereWithNotNull = (
    exclude: "marca" | "rubro"
  ): Prisma.ProdTiendaWhereInput => {
    const parts = baseWhere(exclude);
    const key = exclude;
    const notNull = { [key]: { not: null } } as Prisma.ProdTiendaWhereInput;
    return parts.length > 0 ? { AND: [...parts, notNull] } : notNull;
  };

  const whereItems: Prisma.ProdTiendaWhereInput =
    baseWhere().length > 0 ? { AND: baseWhere() } : {};
  const whereMarcas = toWhereWithNotNull("marca");
  const whereRubros = toWhereWithNotNull("rubro");

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

    const items: ItemTransfDepositos[] = rows.map((r) => ({
      id: r.codTienda,
      codItem: r.codTienda,
      descripcion: r.descripcionTienda ?? "",
      marca: r.marca,
      rubro: r.rubro,
    }));

    const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

    let controlesRecientes: ControlTransfDepositosRecienteDto[] = [];
    let pendientes: PendienteTransfDepositoItemDto[] = [];
    if (destinoOk) {
      const {
        listarControlesRecientesTransfDepositos,
        listarPendientesTransfDepositosPorCodigos,
      } = await import("@/services/transfDepositos.service");
      pendientes = await listarPendientesTransfDepositosPorCodigos(
        origen,
        destinoOk
      );
      if (items.length > 0) {
        controlesRecientes = await listarControlesRecientesTransfDepositos(
          origen,
          destinoOk,
          items.map((i) => i.id)
        );
      }
    }

    return {
      items,
      total,
      totalPaginas,
      marcas: marcasDistinct.filter((m) => m.marca != null).map((m) => m.marca!),
      rubros: rubrosDistinct.filter((r) => r.rubro != null).map((r) => r.rubro!),
      controlesRecientes,
      pendientes,
    };
  } catch (e) {
    console.error("[getTransfDepositos]", e);
    return emptyTransfDepositos;
  }
}

/**
 * Historial de transferencias de un producto (últimos 14 días),
 * agrupado por par origen → destino.
 */
export async function listarHistorialTransfDepositosProductoAction(
  raw: unknown
): Promise<ActionResult<HistorialTransfDepositosSeccionDto[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  const parsed = listarHistorialTransfDepositosProductoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  try {
    const { listarHistorialTransfDepositosPorProducto } = await import(
      "@/services/transfDepositos.service"
    );
    const secciones = await listarHistorialTransfDepositosPorProducto(
      parsed.data.codTienda
    );
    return { ok: true, data: secciones };
  } catch (e) {
    console.error("[listarHistorialTransfDepositosProductoAction]", e);
    return { ok: false, error: "Error al cargar historial." };
  }
}

/**
 * Persiste cantidades de la grilla en `stock_trasn_depositos` (reemplaza el lote del par).
 */
export async function registrarTransferenciasDepositosAction(
  raw: unknown
): Promise<ActionResult<{ creados: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  const parsed = registrarTransferenciasDepositosSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  const { registrarTransferenciasDepositos } = await import(
    "@/services/transfDepositos.service"
  );
  const result = await registrarTransferenciasDepositos(parsed.data);
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  revalidatePath(GP_ROUTES.ayudaVendedor.transfDepositos);
  revalidatePath(GP_INTERNAL.ayudaVendedor.transfDepositos);
  return { ok: true, data: result.data };
}

export type SucursalTransfDepositoOptionDto = {
  id: string;
  codigo: string;
  nombre: string;
  tieneDeposito: boolean;
};

export async function listarSucursalesTransfDepositosAction(): Promise<
  ActionResult<SucursalTransfDepositoOptionDto[]>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  try {
    const { listarSucursalesTransfDepositos } = await import(
      "@/services/transfDepositos.service"
    );
    const data = await listarSucursalesTransfDepositos();
    return { ok: true, data };
  } catch (e) {
    console.error("[listarSucursalesTransfDepositosAction]", e);
    return { ok: false, error: "Error al cargar sucursales." };
  }
}

export async function listarPendientesTransfDepositosAction(
  raw: unknown
): Promise<ActionResult<PendienteTransfDepositoItemDto[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  const parsed = parSucursalesTransfDepositosSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  try {
    const { listarPendientesTransfDepositos } = await import(
      "@/services/transfDepositos.service"
    );
    const data = await listarPendientesTransfDepositos(parsed.data);
    return { ok: true, data };
  } catch (e) {
    console.error("[listarPendientesTransfDepositosAction]", e);
    return { ok: false, error: "Error al cargar transferencias." };
  }
}

/**
 * Borra el lote origen→destino de `stock_trasn_depositos` (marcado Transferido).
 */
export async function marcarTransferidoTransfDepositosAction(
  raw: unknown
): Promise<ActionResult<{ borrados: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  const parsed = parSucursalesTransfDepositosSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  const { marcarTransferidoTransfDepositos } = await import(
    "@/services/transfDepositos.service"
  );
  const result = await marcarTransferidoTransfDepositos(parsed.data);
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  revalidatePath(GP_ROUTES.ayudaVendedor.transfDepositos);
  revalidatePath(GP_INTERNAL.ayudaVendedor.transfDepositos);
  return { ok: true, data: result.data };
}

export type {
  IndicadorSlidenavDto,
  IndicadorSlidenavProveedorPedidoDto,
} from "@/lib/indicadorSlidenav";

/**
 * Exportar Excel: ÚLT. CONTROL + stock local del depósito de la sucursal.
 * No escribe DUX. Flujo vendedor (`stock.acceso`).
 */
export async function registrarExportacionExcelStock(
  raw: unknown
): Promise<ActionResult<{ stockActualizados: number }>> {
  const gate = await requireStockAcceso();
  if (gate) return gate;
  const parsed = registrarControlStockExportacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  const { registrarControlStockExportacion } = await import(
    "@/services/prodTiendaStock.service"
  );
  const result = await registrarControlStockExportacion(parsed.data);
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  revalidatePath(GP_ROUTES.ayudaVendedor.controlStock);
  revalidatePath(GP_INTERNAL.ayudaVendedor.controlStock);
  return { ok: true, data: result.data };
}
