import type { Prisma } from "@prisma/client";
import {
  buildMapSaldoStockPorSucursal,
  obtenerSucursalIdPorCodigo,
} from "@/services/stockMovimientos.service";

export const ID_STOCK_GUAYMALLEN = 4565;
export const ID_STOCK_MAIPU = 16923;

/** ID DUX del depósito Guaymallén (recepción POST `/v2/compras`). Override: `DUX_ID_STOCK_GUAYMALLEN`. */
export function getIdDepositoGuaymallen(): number {
  const raw = process.env.DUX_ID_STOCK_GUAYMALLEN;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return ID_STOCK_GUAYMALLEN;
}

/** ID DUX del depósito Maipú (recepción POST `/v2/compras`). Override: `DUX_ID_STOCK_MAIPU`. */
export function getIdDepositoMaipu(): number {
  const raw = process.env.DUX_ID_STOCK_MAIPU;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return ID_STOCK_MAIPU;
}

/** ID DUX de depósito para recepción. Cada sucursal es depósito; el ledger local no usa este número. */
export function getIdDepositoPorSucursalCodigo(codigo: string): number {
  return codigo.trim().toLowerCase() === "maipu"
    ? getIdDepositoMaipu()
    : getIdDepositoGuaymallen();
}

function codigoSucursalDesdeIdDepositoDux(idDeposito: number): string {
  return idDeposito === getIdDepositoMaipu() ? "maipu" : "guaymallen";
}

/** ID DUX de depósito para recepción. Cada sucursal es depósito. */
export async function obtenerIdDepositoPorCodigoSucursal(
  codigo: string
): Promise<number> {
  return getIdDepositoPorSucursalCodigo(codigo);
}

/** `prod_tienda_stock` eliminada: no hay filtro stockeable persistido. */
export function whereProdTiendaStockeable(): Prisma.ProdPropioWhereInput {
  return {};
}

/** `prod_tienda_stock` eliminada: stockeable queda en false hasta definir regla. */
export async function buildMapStockeable(
  codTiendas: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  for (const ct of codTiendas) {
    map.set(ct.trim(), false);
  }
  return map;
}

export function getStockeableFromMap(
  map: Map<string, boolean>,
  codTienda: string
): boolean {
  return map.get(codTienda.trim()) ?? false;
}

export async function isStockeableCodTienda(_codTienda: string): Promise<boolean> {
  return false;
}

/** Saldo del ledger `stock_movimientos` en la sucursal del depósito DUX. */
export async function getStockReal(
  codTienda: string,
  idDeposito: number
): Promise<number | null> {
  const sucursalId = await obtenerSucursalIdPorCodigo(
    codigoSucursalDesdeIdDepositoDux(idDeposito)
  );
  if (!sucursalId) return 0;
  return buildMapSaldoStockPorSucursal([codTienda], sucursalId).then(
    (m) => m.get(codTienda.trim()) ?? 0
  );
}

/** Saldos del ledger `stock_movimientos` para la sucursal del depósito DUX. */
export async function buildMapStockPorDeposito(
  codTiendas: string[],
  idDeposito: number
): Promise<Map<string, number>> {
  const sucursalId = await obtenerSucursalIdPorCodigo(
    codigoSucursalDesdeIdDepositoDux(idDeposito)
  );
  if (!sucursalId) return new Map();
  return buildMapSaldoStockPorSucursal(codTiendas, sucursalId);
}

export interface MapsStockSucursalesPrincipales {
  maipu: Map<string, number>;
  guaymallen: Map<string, number>;
}

export async function buildMapsStockSucursalesPrincipales(
  codTiendas: string[]
): Promise<MapsStockSucursalesPrincipales> {
  const [maipuId, guayId] = await Promise.all([
    obtenerSucursalIdPorCodigo("maipu"),
    obtenerSucursalIdPorCodigo("guaymallen"),
  ]);
  const [maipu, guaymallen] = await Promise.all([
    maipuId
      ? buildMapSaldoStockPorSucursal(codTiendas, maipuId)
      : Promise.resolve(new Map<string, number>()),
    guayId
      ? buildMapSaldoStockPorSucursal(codTiendas, guayId)
      : Promise.resolve(new Map<string, number>()),
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
