import { z } from "zod";
import { roundToNearestHundred } from "@/lib/tiendaCalculosLts";

/** `prod_rubros.nombre` de los productos que llevan COD. COLOR (comparar sin distinguir mayúsculas). */
export const RUBRO_TINTOMETRICO = "Tintometrico";

export function esRubroTintometrico(nombreRubro: string | null | undefined): boolean {
  return (nombreRubro ?? "").trim().toLowerCase() === RUBRO_TINTOMETRICO.toLowerCase();
}

export const COD_COLOR_MAX_LEN = 40;

/** MAYÚSCULAS, espacios colapsados; vacío → `null`. */
export function normalizarCodColor(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  return t.length > 0 ? t : null;
}

/** `DESCRIPCIÓN (COD)`; idempotente si la descripción ya trae el sufijo. */
export function descripcionConCodColor(
  descripcion: string,
  codColor: string | null | undefined
): string {
  const base = descripcion.trim();
  const cod = normalizarCodColor(codColor);
  if (!cod) return base;
  const sufijo = ` (${cod})`;
  return base.toUpperCase().endsWith(sufijo) ? base : `${base}${sufijo}`;
}

export const codColorSchema = z
  .string()
  .trim()
  .max(COD_COLOR_MAX_LEN, `El COD. COLOR admite hasta ${COD_COLOR_MAX_LEN} caracteres.`)
  .nullable()
  .optional()
  .transform((v) => normalizarCodColor(v));

/**
 * Px Tintométrico: lista general = px. compra × coef. del proveedor (sin proveedor = ×1), redondeo a centenas;
 * mayorista = 70 % de la general.
 */
export function calcularPxTintometrico(
  pxCompraPesos: number,
  coeficiente: number | null
): { general: number; mayorista: number } {
  const base = Math.round(Number.isFinite(pxCompraPesos) ? pxCompraPesos : 0);
  const general = roundToNearestHundred(base * (coeficiente ?? 1));
  return { general, mayorista: Math.round(general * 0.7) };
}
