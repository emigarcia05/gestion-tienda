export type EstPorProdPosicionUnidad = "PREFIJO" | "SUFIJO" | "SUFIJO_SIN_ESPACIO";

/** Ítem del catálogo `prod_presentaciones_unidades`. */
export type EstPorProdUnPresentacionItem = {
  id: string;
  /** Unidad en MAYÚSCULAS (p. ej. LTS, Nº, ''). */
  unidad: string;
  posicionUnidad: EstPorProdPosicionUnidad;
  /** Si true, el valor numérico puede sumarse en estadísticas. */
  suma: boolean;
};

/** Etiqueta UI de la posición (MAYÚSCULAS, sin guiones bajos). */
export function etiquetaPosicionUnidad(posicion: EstPorProdPosicionUnidad): string {
  switch (posicion) {
    case "PREFIJO":
      return "PREFIJO";
    case "SUFIJO":
      return "SUFIJO";
    case "SUFIJO_SIN_ESPACIO":
      return "SUFIJO SIN ESPACIO";
  }
}

/**
 * Formatea número + unidad según posición:
 * - PREFIJO: `Nº 20`
 * - SUFIJO: `20 LTS`
 * - SUFIJO_SIN_ESPACIO: `3''`
 */
export function formatearPresentacionConUnidad(
  numerica: number,
  unidad: Pick<EstPorProdUnPresentacionItem, "unidad" | "posicionUnidad">
): string {
  const n = Number.isInteger(numerica)
    ? String(numerica)
    : numerica.toLocaleString("es-AR", { maximumFractionDigits: 4 });
  const u = unidad.unidad.trim().toLocaleUpperCase("es-AR");
  if (!u) return n;
  switch (unidad.posicionUnidad) {
    case "PREFIJO":
      return `${u} ${n}`;
    case "SUFIJO_SIN_ESPACIO":
      return `${n}${u}`;
    case "SUFIJO":
      return `${n} ${u}`;
  }
}
