/** Valor del Select “sin referencia” en Px Listas · 1 - GENERAL. */
export const PX_LISTAS_COMP_REF_NINGUNO = "-";

/**
 * Query `pxVinculado`: ítem sin competidor de referencia, sin precio de competencia
 * y sin vínculo de proveedor. No usar `PX_LISTAS_COMP_REF_NINGUNO` (`"-"`).
 */
export const PX_LISTAS_PX_VINCULADO_SIN_VINCULAR = "sin-vincular";

export type OpcionCompetenciaRefPxListas = {
  competenciaId: string;
  /** Nombre completo (tooltip / fallback). */
  nombre: string;
  /**
   * Etiqueta corta para UI: prefijo del proveedor vinculado (≤3)
   * o abreviatura de 3 letras del nombre.
   */
  etiqueta: string;
  /** Precio de referencia (sugerido o scraping), entero en pesos. */
  px: number;
};

/** Opción del filtro **PX VINCULADO** (misma etiqueta corta). */
export type OpcionFiltroPxVinculado = {
  competenciaId: string;
  etiqueta: string;
  nombre: string;
};

/**
 * Prefijo de proveedor (hasta 3) o abreviatura de 3 letras del nombre del competidor.
 */
export function etiquetaAbrevCompetenciaPxListas(
  prefijoProveedor: string | null | undefined,
  nombre: string
): string {
  const pref = (prefijoProveedor ?? "").trim().toUpperCase();
  if (pref) return pref.slice(0, 3);
  const letters = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  if (letters.length > 0) return letters.padEnd(3, "X");
  return "???";
}
