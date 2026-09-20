import { Prisma } from "@prisma/client";
import {
  computeStockeableDesdeStocks,
  getIdDepositoGuaymallen,
  getIdDepositoMaipu,
} from "@/lib/duxApi";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export {
  computeStockeableDesdeStocks,
  getIdDepositoMaipu,
  getIdDepositoGuaymallen,
};

/**
 * Fallback env (`DUX_ID_STOCK_*`) para filtros sync/stockeable.
 * El mapeo de negocio es `sucursales.id_deposito` → `obtenerIdDepositoPorCodigoSucursal`.
 */
export function getIdDepositoPorSucursalCodigo(codigo: string): number {
  return codigo.trim().toLowerCase() === "maipu"
    ? getIdDepositoMaipu()
    : getIdDepositoGuaymallen();
}

/** Depósito DUX de la sucursal (`sucursales.id_deposito`). Null si no hay FK (p. ej. corporativo). */
export async function obtenerIdDepositoPorCodigoSucursal(
  codigo: string
): Promise<number | null> {
  const row = await prisma.sucursal.findUnique({
    where: { codigo: codigo.trim().toLowerCase() },
    select: { idDeposito: true },
  });
  return row?.idDeposito ?? null;
}

/** Filtro Prisma: ítem stockeable (ctd_disponible informado en Maipú y Guaymallén). */
export function whereProdTiendaStockeable(): Prisma.ProdTiendaWhereInput {
  const idMaipu = getIdDepositoMaipu();
  const idGuay = getIdDepositoGuaymallen();
  return {
    AND: [
      { stocks: { some: { idDeposito: idMaipu, ctdDisponible: { not: null } } } },
      { stocks: { some: { idDeposito: idGuay, ctdDisponible: { not: null } } } },
    ],
  };
}

/** Mapa cod_tienda → stockeable según `prod_tienda_stock.ctd_disponible` en depósitos principales. */
export async function buildMapStockeable(
  codTiendas: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (codTiendas.length === 0) return map;
  const idMaipu = getIdDepositoMaipu();
  const idGuay = getIdDepositoGuaymallen();
  const rows = await prisma.prodTiendaStock.findMany({
    where: {
      codTienda: { in: codTiendas },
      idDeposito: { in: [idMaipu, idGuay] },
    },
    select: { codTienda: true, idDeposito: true, ctdDisponible: true },
  });
  const maipuOk = new Set<string>();
  const guayOk = new Set<string>();
  for (const r of rows) {
    if (r.ctdDisponible == null) continue;
    if (r.idDeposito === idMaipu) maipuOk.add(r.codTienda);
    if (r.idDeposito === idGuay) guayOk.add(r.codTienda);
  }
  for (const ct of codTiendas) {
    const k = ct.trim();
    map.set(k, maipuOk.has(k) && guayOk.has(k));
  }
  return map;
}

export function getStockeableFromMap(
  map: Map<string, boolean>,
  codTienda: string
): boolean {
  return map.get(codTienda.trim()) ?? false;
}

export async function isStockeableCodTienda(codTienda: string): Promise<boolean> {
  const map = await buildMapStockeable([codTienda]);
  return getStockeableFromMap(map, codTienda);
}

/** Stock real de un depósito DUX para un producto, o null si no existe fila. */
export async function getStockReal(
  codTienda: string,
  idDeposito: number
): Promise<number | null> {
  const row = await prisma.prodTiendaStock.findUnique({
    where: { codTienda_idDeposito: { codTienda, idDeposito } },
    select: { stockReal: true },
  });
  return row != null ? row.stockReal : null;
}

/** Mapa cod_tienda → stock_real para un depósito (0 si no hay fila). */
export async function buildMapStockPorDeposito(
  codTiendas: string[],
  idDeposito: number
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codTiendas.length === 0) return map;
  const rows = await prisma.prodTiendaStock.findMany({
    where: { codTienda: { in: codTiendas }, idDeposito },
    select: { codTienda: true, stockReal: true },
  });
  for (const r of rows) {
    map.set(r.codTienda, r.stockReal);
  }
  return map;
}

export interface MapsStockSucursalesPrincipales {
  maipu: Map<string, number>;
  guaymallen: Map<string, number>;
}

/** Mapas Maipú y Guaymallén en una sola ronda (lecturas UI / pedidos). */
export async function buildMapsStockSucursalesPrincipales(
  codTiendas: string[]
): Promise<MapsStockSucursalesPrincipales> {
  const [maipu, guaymallen] = await Promise.all([
    buildMapStockPorDeposito(codTiendas, getIdDepositoMaipu()),
    buildMapStockPorDeposito(codTiendas, getIdDepositoGuaymallen()),
  ]);
  return { maipu, guaymallen };
}

export function getStockSucursalPrincipal(
  codTienda: string,
  sucursalCodigo: string,
  maps: MapsStockSucursalesPrincipales
): number {
  const m =
    sucursalCodigo.trim().toLowerCase() === "maipu" ? maps.maipu : maps.guaymallen;
  return m.get(codTienda.trim()) ?? 0;
}

export type RegistrarControlStockExportacionInput = {
  sucursal: "guaymallen" | "maipu";
  idsControl: string[];
  ajustes: { codTienda: string; cantidad: number }[];
};

export type RegistrarControlStockExportacionResult = {
  stockActualizados: number;
};

/**
 * ÚLT. CONTROL (`prod_tienda.ultima_exportacion_excel`) + stock local del depósito
 * de la sucursal (`prod_tienda_stock.stock_real` / `ctd_disponible`).
 * No toca el depósito de la otra sucursal ni DUX.
 */
export async function registrarControlStockExportacion(
  input: RegistrarControlStockExportacionInput
): Promise<ServiceResult<RegistrarControlStockExportacionResult>> {
  try {
    const idDeposito =
      (await obtenerIdDepositoPorCodigoSucursal(input.sucursal)) ??
      getIdDepositoPorSucursalCodigo(input.sucursal);

    const idsUnicos = [...new Set(input.idsControl.map((id) => id.trim()))];
    const existentes = await prisma.prodTienda.findMany({
      where: { codTienda: { in: idsUnicos } },
      select: { codTienda: true },
    });
    if (existentes.length !== idsUnicos.length) {
      return {
        success: false,
        error: "Hay códigos de tienda que no existen.",
      };
    }

    const ahora = new Date();
    const ajustesPorCod = new Map<string, number>();
    for (const a of input.ajustes) {
      ajustesPorCod.set(a.codTienda.trim(), a.cantidad);
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.prodTienda.updateMany({
          where: { codTienda: { in: idsUnicos } },
          data: { ultimaExportacionExcel: ahora },
        });
        for (const [codTienda, cantidad] of ajustesPorCod) {
          const stockReal = Math.round(cantidad);
          const ctdDisponible = new Prisma.Decimal(cantidad);
          await tx.prodTiendaStock.upsert({
            where: {
              codTienda_idDeposito: { codTienda, idDeposito },
            },
            create: {
              codTienda,
              idDeposito,
              stockReal,
              ctdDisponible,
            },
            update: {
              stockReal,
              ctdDisponible,
            },
          });
        }
      },
      { timeout: 60_000, maxWait: 10_000 }
    );

    return {
      success: true,
      data: { stockActualizados: ajustesPorCod.size },
    };
  } catch (e) {
    console.error("[registrarControlStockExportacion]", e);
    return { success: false, error: "Error al registrar el control de stock." };
  }
}
