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
 * Número tal como lo escribió el usuario (conserva ceros a la izquierda: `080`), sin espacios
 * y con coma decimal.
 */
export function literalNumeroPresentacion(raw: string): string {
  return raw.trim().replace(/\s+/g, "").replace(".", ",");
}

/**
 * Inversa de `formatearPresentacionConUnidad` sobre el `texto` guardado: devuelve solo el número
 * literal (p. ej. `Nº 080` → `080`). Vacío si el texto no tiene la unidad en la posición esperada.
 */
export function extraerLiteralNumeroPresentacion(
  texto: string,
  unidad: Pick<EstPorProdUnPresentacionItem, "unidad" | "posicionUnidad">
): string {
  const t = texto.trim();
  const u = unidad.unidad.trim().toLocaleUpperCase("es-AR");
  if (!u) return t;
  const upper = t.toLocaleUpperCase("es-AR");
  if (unidad.posicionUnidad === "PREFIJO") {
    return upper.startsWith(u) ? t.slice(u.length).trim() : "";
  }
  return upper.endsWith(u) ? t.slice(0, t.length - u.length).trim() : "";
}

/**
 * Formatea número + unidad según posición:
 * - PREFIJO: `Nº 20`
 * - SUFIJO: `20 LTS`
 * - SUFIJO_SIN_ESPACIO: `3''`
 * Con `string` se usa el literal escrito (`Nº 080`); con `number`, el número normalizado.
 */
export function formatearPresentacionConUnidad(
  numerica: number | string,
  unidad: Pick<EstPorProdUnPresentacionItem, "unidad" | "posicionUnidad">
): string {
  const n =
    typeof numerica === "string"
      ? literalNumeroPresentacion(numerica)
      : Number.isInteger(numerica)
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
