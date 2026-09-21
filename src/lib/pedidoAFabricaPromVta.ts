/**
 * Cálculo de **PROM. VTA.** (Pedido A Fáb.).
 *
 * Ventas de los **2 meses calendario completos** anteriores al mes actual (AR),
 * divididas por **48** (24 días de venta × 2 meses) y redondeadas a **1 decimal**.
 */

import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  diasNumericosAcreditacionMenosHoyArgentina,
} from "@/lib/fechaArgentina";
import { etiquetaMesEstPorProd } from "@/lib/estPorProdPeriodo";
import type { ReposicionFormaPedidoFabrica } from "@/lib/validations/reposicion";

/** Días de venta contables (hábiles) por mes. */
export const PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES = 24;

/**
 * Días calendario de referencia por mes.
 * **TIEMPO STOCKEO** se carga en calendario: 30 calendario = 24 hábiles.
 */
export const PEDIDO_A_FABRICA_DIAS_CALENDARIO_POR_MES = 30;

/** Cantidad de meses previos completos que entran en el promedio. */
export const PEDIDO_A_FABRICA_MESES_PROM_VTA = 2;

/** Denominador fijo: 24 × 2 = 48. */
export const PEDIDO_A_FABRICA_DIAS_PROM_VTA =
  PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES * PEDIDO_A_FABRICA_MESES_PROM_VTA;

/** STOCK / UN. ACT.: sucursal con `sucursales.id_deposito`. */
export function sucursalPedidoAFabricaTieneDeposito(s: {
  idDeposito: number | null;
}): boolean {
  return s.idDeposito != null;
}

export type PeriodoMesAnio = { mes: number; anio: number };

export function mesAnioActualArgentinaPedidoAFabrica(
  ahora: Date = new Date()
): PeriodoMesAnio {
  const ymd = dateToIsoYmdArgentina(ahora);
  const [y, m] = ymd.split("-").map(Number);
  return { mes: m!, anio: y! };
}

export function mesAnteriorPeriodo(periodo: PeriodoMesAnio): PeriodoMesAnio {
  if (periodo.mes <= 1) return { mes: 12, anio: periodo.anio - 1 };
  return { mes: periodo.mes - 1, anio: periodo.anio };
}

/**
 * Los 2 meses completos previos al mes calendario actual (AR).
 * Ej.: en agosto → junio (anterior) y julio (reciente).
 */
export function periodosUltimosDosMesesCompletos(
  ahora: Date = new Date()
): { anterior: PeriodoMesAnio; reciente: PeriodoMesAnio; actual: PeriodoMesAnio } {
  const actual = mesAnioActualArgentinaPedidoAFabrica(ahora);
  const reciente = mesAnteriorPeriodo(actual);
  const anterior = mesAnteriorPeriodo(reciente);
  return { anterior, reciente, actual };
}

/** Etiqueta legible: «Junio 2026». */
export function etiquetaPeriodoMesAnio(p: PeriodoMesAnio): string {
  return `${etiquetaMesEstPorProd(p.mes)} ${p.anio}`;
}

/** Normaliza `YYYY-MM-DD` de FECHA PEDIDO; vacío/inválido → hoy (AR). */
export function normalizarFechaPedidoPedidoAFabrica(
  fechaPedidoIso: string | null | undefined,
  ahora: Date = new Date()
): string {
  const t = fechaPedidoIso?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return dateToIsoYmdArgentina(ahora);
}

/**
 * Fecha Llegada Pedido = FECHA PEDIDO + `tiempo_entrega_en_dias` (null → 0).
 * Devuelve `YYYY-MM-DD` (AR).
 */
export function calcularFechaLlegadaPedidoIso(
  fechaPedidoIso: string,
  tiempoEntregaEnDias: number | null | undefined
): string {
  const base = normalizarFechaPedidoPedidoAFabrica(fechaPedidoIso);
  const entrega =
    tiempoEntregaEnDias != null && Number.isFinite(tiempoEntregaEnDias)
      ? Math.max(0, Math.trunc(tiempoEntregaEnDias))
      : 0;
  return addDaysToIsoYmdArgentina(base, entrega);
}

/**
 * Días de provisión desde hoy (AR) hasta la fecha de llegada del pedido.
 * Si FECHA PEDIDO está vacía/inválida, usa hoy como base.
 * Nunca devuelve negativo.
 */
export function calcularDiasProvisionHastaLlegadaPedidoAFabrica(
  fechaPedidoIso: string | null | undefined,
  tiempoEntregaEnDias: number | null | undefined,
  ahora: Date = new Date()
): number {
  const fechaBase = normalizarFechaPedidoPedidoAFabrica(fechaPedidoIso, ahora);
  const llegadaIso = calcularFechaLlegadaPedidoIso(fechaBase, tiempoEntregaEnDias);
  const diasDesdeHoy = diasNumericosAcreditacionMenosHoyArgentina(llegadaIso);
  if (!Number.isFinite(diasDesdeHoy)) return 0;
  return Math.max(0, Math.trunc(diasDesdeHoy));
}

/**
 * Convierte días **calendario** (input TIEMPO STOCKEO) a días **hábiles de venta**.
 * 30 calendario = 24 hábiles.
 */
export function diasHabilesVentaDesdeCalendarioPedidoAFabrica(
  diasCalendario: number
): number {
  if (!Number.isFinite(diasCalendario) || diasCalendario <= 0) return 0;
  return (
    (diasCalendario * PEDIDO_A_FABRICA_DIAS_VENTA_POR_MES) /
    PEDIDO_A_FABRICA_DIAS_CALENDARIO_POR_MES
  );
}

/**
 * Fecha Stockeo = Fecha Llegada + Tiempo Stockeo (días **calendario**).
 * `null` si no hay Tiempo Stockeo válido.
 */
export function calcularFechaStockeoPedidoIso(
  fechaPedidoIso: string,
  tiempoEntregaEnDias: number | null | undefined,
  tiempoStockeo: number | null | undefined
): string | null {
  if (
    tiempoStockeo == null ||
    !Number.isFinite(tiempoStockeo) ||
    tiempoStockeo < 0
  ) {
    return null;
  }
  const llegada = calcularFechaLlegadaPedidoIso(
    fechaPedidoIso,
    tiempoEntregaEnDias
  );
  return addDaysToIsoYmdArgentina(llegada, Math.trunc(tiempoStockeo));
}

/** Redondeo half-up a 1 decimal (1,35 → 1,4; 0,83 → 0,8). */
export function redondearPromVtaUnDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Promedio diario: total vendido en los 2 meses / 48, redondeo a **1 decimal**.
 * Ej.: 65/48 ≈ 1,35 → 1,4; 40/48 ≈ 0,83 → 0,8; 96/48 → 2.
 */
export function calcularPromVtaDiariaDesdeTotal(totalDosMeses: number): number {
  if (!Number.isFinite(totalDosMeses) || totalDosMeses <= 0) return 0;
  return redondearPromVtaUnDecimal(totalDosMeses / PEDIDO_A_FABRICA_DIAS_PROM_VTA);
}

/**
 * Stock actual expresado en días de venta: stock / prom. vta. diario.
 * `null` si no hay promedio positivo.
 */
export function calcularStockEnDiasPedidoAFabrica(
  stockActual: number | null | undefined,
  promVta: number | null | undefined
): number | null {
  if (
    stockActual == null ||
    promVta == null ||
    !Number.isFinite(stockActual) ||
    !Number.isFinite(promVta) ||
    promVta <= 0
  ) {
    return null;
  }
  return Math.round(stockActual / promVta);
}

/**
 * Stock proyectado al llegar el pedido: stock − (entrega × prom).
 * No requiere **TIEMPO STOCKEO**. `null` si no hay stock numérico.
 */
export function calcularStockAFechaLlegadaPedidoAFabrica(
  stockActual: number | null | undefined,
  promVta: number | null | undefined,
  tiempoEntregaEnDias: number | null | undefined
): number | null {
  if (stockActual == null || !Number.isFinite(stockActual)) return null;
  const prom =
    promVta != null && Number.isFinite(promVta) ? Math.max(0, promVta) : 0;
  const entrega =
    tiempoEntregaEnDias != null && Number.isFinite(tiempoEntregaEnDias)
      ? Math.max(0, tiempoEntregaEnDias)
      : 0;
  return Math.max(0, stockActual) - entrega * prom;
}

/** Filtro **PEDIDO**: hay **CANT. PED.** (> 0). Vacío, no numérico o ≤ 0 = no. */
export function cantPedidaPedidoAFabricaEsPositiva(
  raw: string | number | null | undefined
): boolean {
  if (raw == null) return false;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0;
  const t = raw.trim();
  if (t === "") return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

/**
 * STOCK QUEBRADO: ya está en 0 (o menos), o el stock proyectado al llegar
 * el pedido es ≤ 0. Independiente de la fecha de pedido si UN. ACT. ≤ 0.
 */
export function esStockQuebradoPedidoAFabrica(
  stockHastaLlegada: number | null | undefined,
  stockActual?: number | null
): boolean {
  if (stockActual != null && Number.isFinite(stockActual) && stockActual <= 0) {
    return true;
  }
  return (
    stockHastaLlegada != null &&
    Number.isFinite(stockHastaLlegada) &&
    stockHastaLlegada <= 0
  );
}

/** Cant. sugerida calculada &gt; 0 (requiere TIEMPO STOCKEO). */
export function tienePedidoSugeridoPedidoAFabrica(
  cantSugerida: number | null | undefined
): boolean {
  return (
    cantSugerida != null &&
    Number.isFinite(cantSugerida) &&
    cantSugerida > 0
  );
}

export type InputsCantSugeridaPedidoAFabrica = {
  /** Stock actual total (suma sucursales `pedido`). */
  stockActual: number;
  /** Promedio de venta diario total (suma sucursales). */
  promVtaTotal: number;
  /** Días de entrega del proveedor (`tiempo_entrega_en_dias`); null/undefined → 0. */
  tiempoEntregaEnDias: number | null | undefined;
  /**
   * Días **calendario** del filtro **TIEMPO STOCKEO**.
   * En cantidad se convierten a hábiles (30 → 24). null/undefined/negativo → sin cálculo.
   */
  tiempoStockeo: number | null | undefined;
};

export type ResultadoCantSugeridaPedidoAFabrica = {
  /** Stock proyectado al llegar el pedido: stock − (entrega × prom). */
  stockAFechaLlegadaPedido: number;
  /** Cobertura deseada al stockear: días hábiles de stockeo × prom. */
  stockParaTiempoStockeo: number;
  /**
   * Cantidad cruda (≥ 0, sin redondeo de forma).
   * UNIDAD/BULTO se aplican con `redondearCantSugeridaPorFormaPedidoAFabrica`.
   */
  cantSugerida: number;
};

/**
 * Cant. sugerida Pedido A Fáb. (TOTAL).
 *
 * - Fecha Llegada Pedido = FECHA PEDIDO + `tiempo_entrega_en_dias`
 * - Fecha Stockeo = Fecha Llegada + Tiempo Stockeo (calendario)
 * - Stock a Fecha Llegada = Stock Actual − (entrega × prom vta. total)
 * - Stock Para Tiempo Stockeo = (Tiempo Stockeo × 24 / 30) × prom vta. total
 */
export function calcularCantSugeridaPedidoAFabrica(
  input: InputsCantSugeridaPedidoAFabrica
): ResultadoCantSugeridaPedidoAFabrica | null {
  const { stockActual, promVtaTotal, tiempoEntregaEnDias, tiempoStockeo } =
    input;

  if (
    tiempoStockeo == null ||
    !Number.isFinite(tiempoStockeo) ||
    tiempoStockeo < 0 ||
    !Number.isFinite(stockActual) ||
    !Number.isFinite(promVtaTotal)
  ) {
    return null;
  }

  const stockeoCalendario = Math.max(0, tiempoStockeo);
  const stockeoHabiles =
    diasHabilesVentaDesdeCalendarioPedidoAFabrica(stockeoCalendario);
  const prom = Math.max(0, promVtaTotal);
  const stockAFechaLlegadaPedido =
    calcularStockAFechaLlegadaPedidoAFabrica(
      stockActual,
      promVtaTotal,
      tiempoEntregaEnDias
    ) ?? 0;
  const stockParaTiempoStockeo = stockeoHabiles * prom;

  const crudo =
    stockAFechaLlegadaPedido <= 0
      ? stockParaTiempoStockeo
      : stockParaTiempoStockeo - stockAFechaLlegadaPedido;

  return {
    stockAFechaLlegadaPedido,
    stockParaTiempoStockeo,
    cantSugerida: Math.max(0, crudo),
  };
}

/**
 * Redondeo de CANT. SUGERIDA según FORMA:
 * - UNIDAD → techo al entero siguiente (6,7 → 7).
 * - BULTO → techo al próximo múltiplo de `prod_tienda.bulto` (6,7 y bulto 12 → 12).
 *   Sin bulto configurado → `null` (celda vacía).
 */
export function redondearCantSugeridaPorFormaPedidoAFabrica(
  crudo: number,
  forma: ReposicionFormaPedidoFabrica,
  bulto: number | null
): number | null {
  if (!Number.isFinite(crudo) || crudo < 0) return null;
  if (forma === "UNIDADES_FIJAS") {
    return Math.ceil(crudo);
  }
  if (bulto == null || !Number.isFinite(bulto) || bulto < 1) return null;
  if (crudo === 0) return 0;
  return Math.ceil(crudo / bulto) * bulto;
}

/** Crudo de la fórmula + redondeo UNIDAD/BULTO. `null` si no hay Tiempo Stockeo o no se puede redondear. */
export function resolverCantSugeridaPedidoAFabrica(
  input: InputsCantSugeridaPedidoAFabrica,
  forma: ReposicionFormaPedidoFabrica,
  bulto: number | null
): number | null {
  const calc = calcularCantSugeridaPedidoAFabrica(input);
  if (!calc) return null;
  return redondearCantSugeridaPorFormaPedidoAFabrica(
    calc.cantSugerida,
    forma,
    bulto
  );
}
