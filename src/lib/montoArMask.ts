/**
 * Máscara AR para montos en pesos: entrada tipo POS (cada dígito agrega centavos a la derecha),
 * visualización con `.` miles y `,` decimales (es-AR), opcional prefijo `$`.
 * El valor persistido en estado de formulario es un string **normalizado** parseable con `Number()`
 * (punto solo como decimal ASCII, sin miles), p. ej. `"0"`, `"0.01"`, `"1234.56"`.
 */

export const MONTO_AR_MASK_MAX_CENTS = 99_999_999_999; // hasta 999.999.999,99

export function montoArNormalizedStringToCents(norm: string): number {
  const t = norm.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  const cents = Math.round(n * 100);
  return Math.min(Math.max(cents, 0), MONTO_AR_MASK_MAX_CENTS);
}

export function montoArCentsToNormalizedString(cents: number): string {
  const safe = Math.min(Math.max(Math.trunc(cents), 0), MONTO_AR_MASK_MAX_CENTS);
  const enteros = Math.floor(safe / 100);
  const decimales = safe % 100;
  if (decimales === 0) return String(enteros);
  return `${enteros}.${String(decimales).padStart(2, "0")}`;
}

/** Cobros y pagos se registran en pesos enteros (sin centavos). */
export function montoArCentsEsPesoEntero(cents: number): boolean {
  return Number.isInteger(cents) && cents % 100 === 0;
}

/**
 * Tope de un cobro/pago entero contra un saldo que puede tener centavos (comprobantes viejos o
 * de proveedor): el peso entero inmediato superior, para poder saldarlo.
 */
export function montoArCentsTopePesoEntero(saldoCents: number): number {
  return Math.ceil(Math.max(0, Math.round(saldoCents)) / 100) * 100;
}

/**
 * Visual de cobros en pesos enteros, sin `,00` (`$87.500`). Un saldo con centavos se muestra
 * llevado al peso superior, igual que el tope de cobro.
 */
export function montoArCentsToDisplayPesoEntero(
  cents: number,
  currencySymbol: string = "$"
): string {
  const pesos = montoArCentsTopePesoEntero(cents) / 100;
  const fmt = pesos.toLocaleString("es-AR", { useGrouping: true, maximumFractionDigits: 0 });
  return `${currencySymbol}${fmt}`;
}

/** Visual con miles `.` y decimales `,XX` (sin símbolo). */
export function montoArCentsToDisplayBody(cents: number): string {
  const safe = Math.min(Math.max(Math.trunc(cents), 0), MONTO_AR_MASK_MAX_CENTS);
  const enteros = Math.floor(safe / 100);
  const decimales = safe % 100;
  const enterosFmt = enteros.toLocaleString("es-AR", {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  return `${enterosFmt},${String(decimales).padStart(2, "0")}`;
}

export function montoArCentsToDisplayWithCurrency(
  cents: number,
  currencySymbol: string = "$"
): string {
  return `${currencySymbol}${montoArCentsToDisplayBody(cents)}`;
}

/** Centavos con signo desde normalizado (`"-12.34"` → -1234). Vacío / inválido → 0. */
export function montoArSignedNormalizedStringToCents(norm: string): number {
  const t = norm.trim();
  if (t === "" || t === "-") return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  const mag = Math.min(Math.abs(cents), MONTO_AR_MASK_MAX_CENTS);
  return cents < 0 ? -mag : mag;
}

export function montoArSignedCentsToNormalizedString(cents: number): string {
  const mag = Math.min(Math.abs(Math.trunc(cents)), MONTO_AR_MASK_MAX_CENTS);
  const magStr = montoArCentsToNormalizedString(mag);
  return cents < 0 && mag !== 0 ? `-${magStr}` : magStr;
}

/** Visual `$1.234,56` o `$-1.234,56`. */
export function montoArSignedCentsToDisplayWithCurrency(
  cents: number,
  currencySymbol: string = "$"
): string {
  const mag = Math.abs(Math.trunc(cents));
  const body = montoArCentsToDisplayBody(mag);
  return cents < 0 && mag !== 0
    ? `${currencySymbol}-${body}`
    : `${currencySymbol}${body}`;
}

/** Pesos enteros (p. ej. saldo) como en la máscara: siempre `$` + miles + `,00`. */
export function montoArPesosEnterosToDisplay(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos <= 0) {
    return montoArCentsToDisplayWithCurrency(0);
  }
  const ent = Math.trunc(pesos);
  const cents = Math.min(ent * 100, MONTO_AR_MASK_MAX_CENTS);
  return montoArCentsToDisplayWithCurrency(cents);
}

/** Toolbar / etiquetas compactas: `$-36.013` (sin `,00`). */
export function montoArPesosEnterosSignedToDisplayCompact(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos === 0) return "$0";
  const neg = pesos < 0;
  const entFmt = Math.abs(Math.trunc(pesos)).toLocaleString("es-AR", {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  return neg ? `$-${entFmt}` : `$${entFmt}`;
}

/** Magnitud y signo desde pesos enteros (p. ej. saldo IVA negativo). */
export function montoArPesosEnterosSignedToParts(pesos: number): {
  negativo: boolean;
  magnitudeNormalized: string;
} {
  if (!Number.isFinite(pesos) || pesos === 0) {
    return { negativo: false, magnitudeNormalized: "" };
  }
  const ent = Math.trunc(pesos);
  return {
    negativo: ent < 0,
    magnitudeNormalized: String(Math.abs(ent)),
  };
}

/** Pesos enteros con signo desde magnitud normalizada + flag negativo. */
export function montoArSaldoEnteroPartsToPesos(
  magnitudeNormalized: string,
  negativo: boolean
): number | null {
  const t = magnitudeNormalized.trim();
  if (t === "") return null;
  const mag = montoArNormalizedStringToPesosIntRounded(t);
  return negativo ? -mag : mag;
}

/** Pesos (2 decimales) desde string normalizado. */
export function montoArNormalizedStringToPesosNumber(norm: string): number {
  return montoArNormalizedStringToCents(norm) / 100;
}

/** Pesos enteros (redondeo) para columnas Int en DB. */
export function montoArNormalizedStringToPesosIntRounded(norm: string): number {
  return Math.round(montoArNormalizedStringToPesosNumber(norm));
}

/** Inicializar normalizado desde pesos enteros guardados en DB. */
export function montoArPesosEnterosToNormalizedString(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos <= 0) return "";
  return String(Math.trunc(pesos));
}

/** Inicializar normalizado desde monto con decimales (p. ej. `px_lista_proveedor`; incluye 0). */
export function montoArNumberToNormalizedString(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "0";
  const cents = Math.min(Math.round(value * 100), MONTO_AR_MASK_MAX_CENTS);
  return montoArCentsToNormalizedString(cents);
}
