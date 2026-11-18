/**
 * Máscara POS para porcentajes con 2 decimales visibles (es-AR).
 * Cada dígito desplaza a la derecha en centésimas: 1 → 0,01; 12 → 0,12; 125 → 1,25.
 * Tope por defecto 99,99 % (`PORCENTAJE_CENT_MASK_MAX_CENTS`). Para persistir: `"12.26"`.
 */

import {
  montoArCentsToDisplayBody,
  montoArCentsToNormalizedString,
  montoArNormalizedStringToCents,
  montoArSignedNormalizedStringToCents,
} from "@/lib/montoArMask";
import { roundPorcentaje0a100 } from "@/lib/format";

/** Tope estándar (Costos Financieros, lista precios, etc.): 99,99 %. */
export const PORCENTAJE_CENT_MASK_MAX_CENTS = 9_999;

/** Tope de un porcentaje entero 0–100 (`100` → 10.000 centésimas). */
export const PORCENTAJE_ENTERO_MAX_CENTS = 10_000;

function clampPorcentajeCentCents(cents: number, maxCents: number): number {
  return Math.min(Math.max(Math.trunc(cents), 0), maxCents);
}

export function porcentajeCentNormalizedStringToCents(
  norm: string,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): number {
  const c = montoArNormalizedStringToCents(norm);
  return clampPorcentajeCentCents(c, maxCents);
}

export function porcentajeCentCentsToNormalizedString(
  cents: number,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): string {
  return montoArCentsToNormalizedString(clampPorcentajeCentCents(cents, maxCents));
}

/** Visual sin símbolo: `12,26` (con `%` en `PorcentajeCentInput`). */
export function porcentajeCentNormalizedToDisplay(
  norm: string,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): string {
  if (norm.trim() === "") return "";
  return montoArCentsToDisplayBody(porcentajeCentNormalizedStringToCents(norm, maxCents));
}

function clampPorcentajeCentSignedCents(cents: number, maxCents: number): number {
  const mag = Math.min(Math.abs(Math.trunc(cents)), maxCents);
  return cents < 0 ? -mag : mag;
}

/** Centésimas de % con signo (`"-4.00"` → -400). Vacío / `"-"` → 0. */
export function porcentajeCentSignedNormalizedStringToCents(
  norm: string,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): number {
  return clampPorcentajeCentSignedCents(montoArSignedNormalizedStringToCents(norm), maxCents);
}

export function porcentajeCentSignedCentsToNormalizedString(
  cents: number,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): string {
  const safe = clampPorcentajeCentSignedCents(cents, maxCents);
  const mag = montoArCentsToNormalizedString(Math.abs(safe));
  return safe < 0 && Math.abs(safe) !== 0 ? `-${mag}` : mag;
}

/** Visual con signo, sin `%`: `-4,00` / `4,00`. `"-"` pendiente se muestra como `-`. */
export function porcentajeCentSignedNormalizedToDisplay(
  norm: string,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): string {
  const t = norm.trim();
  if (t === "") return "";
  if (t === "-") return "-";
  const cents = porcentajeCentSignedNormalizedStringToCents(t, maxCents);
  const body = montoArCentsToDisplayBody(Math.abs(cents));
  return cents < 0 ? `-${body}` : body;
}

/** Valor inicial desde número en BD (incluye 0). Tope 0–100 % salvo `sinTope100`. */
export function porcentajeCentFromNumber(
  n: number,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS,
  sinTope100 = false
): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "0";
  const pct = sinTope100 ? Math.max(0, n) : roundPorcentaje0a100(n);
  const cents = Math.min(Math.round(pct * 100), maxCents);
  return montoArCentsToNormalizedString(cents);
}

/** Vacío → `undefined`. Válido de 0 inclusive hasta `maxCents / 100`. */
export function parsePorcentajeCentNormalized(
  norm: string,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): number | undefined {
  const t = norm.trim();
  if (t === "") return undefined;
  const rawCents = montoArNormalizedStringToCents(t);
  if (rawCents < 0 || rawCents > maxCents) return undefined;
  return rawCents / 100;
}

/** Vacío / `"-"` → `undefined`. Incluye negativos hasta ±`maxCents / 100`. */
export function parsePorcentajeCentSignedNormalized(
  norm: string,
  maxCents: number = PORCENTAJE_CENT_MASK_MAX_CENTS
): number | undefined {
  const t = norm.trim();
  if (t === "" || t === "-") return undefined;
  const cents = porcentajeCentSignedNormalizedStringToCents(t, maxCents);
  return cents / 100;
}
