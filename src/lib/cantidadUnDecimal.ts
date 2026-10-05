import { z } from "zod";

export const CANTIDAD_UN_DECIMAL_MAX = 1_000_000;

function esMultiploDeUnDecimo(n: number): boolean {
  return Math.abs(Math.round(n * 10) / 10 - n) < 1e-8;
}

/** Redondea a 1 decimal (0,5). Evita basura de float. */
export function redondearCantidadUnDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

export function cantidadDesdePrisma(
  value: { toNumber: () => number } | number | null | undefined
): number {
  if (value == null) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? redondearCantidadUnDecimal(value) : 0;
  }
  const n = value.toNumber();
  return Number.isFinite(n) ? redondearCantidadUnDecimal(n) : 0;
}

/**
 * Borrador de input: dígitos + opcional una coma/punto y un decimal.
 * Acepta `0,` mientras se escribe.
 */
export function esBorradorCantidadUnDecimal(raw: string): boolean {
  const t = raw.trim().replace(",", ".");
  return t === "" || /^\d+\.?$/.test(t) || /^\d+\.\d{0,1}$/.test(t);
}

/**
 * Parsea cantidad con hasta 1 decimal. `min` default 0,1 (factura / movimiento).
 * Stock físico puede usar `min: 0`.
 */
export function parseCantidadUnDecimal(
  raw: string,
  opts?: { min?: number }
): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "" || t === ".") return null;
  if (!/^\d+(\.\d{1})?$/.test(t) && !/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const rounded = redondearCantidadUnDecimal(n);
  const min = opts?.min ?? 0.1;
  if (rounded < min || rounded > CANTIDAD_UN_DECIMAL_MAX) return null;
  if (!esMultiploDeUnDecimo(rounded)) return null;
  return rounded;
}

/** Pantalla: entero si no hay decimal; si no, un decimal es-AR (`0,5`). */
export function fmtCantidad(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  const v = redondearCantidadUnDecimal(n);
  const entero = Math.abs(v - Math.round(v)) < 1e-8;
  return v.toLocaleString("es-AR", {
    minimumFractionDigits: entero ? 0 : 1,
    maximumFractionDigits: entero ? 0 : 1,
  });
}

/** CANT. de ledger: `cantidad` positiva; `+` ingreso, `-` egreso. */
export function fmtCantidadMovimiento(
  cantidad: number,
  tipoMovimiento: "INGRESO" | "EGRESO"
): string {
  const n = fmtCantidad(cantidad);
  if (n === "") return "";
  return `${tipoMovimiento === "EGRESO" ? "-" : "+"}${n}`;
}

/** Valor de input: `5` o `0,5`. */
export function formatCantidadInputValor(n: number): string {
  return fmtCantidad(n);
}

export const cantidadUnDecimalPositivaSchema = z
  .number()
  .gt(0, "La cantidad debe ser mayor a 0.")
  .max(CANTIDAD_UN_DECIMAL_MAX)
  .refine(esMultiploDeUnDecimo, "La cantidad admite como máximo un decimal.");

export const cantidadUnDecimalNoNegativaSchema = z
  .number()
  .min(0, "La cantidad no puede ser negativa.")
  .max(CANTIDAD_UN_DECIMAL_MAX)
  .refine(esMultiploDeUnDecimo, "La cantidad admite como máximo un decimal.");
