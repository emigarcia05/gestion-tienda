/** Ítem del catálogo `prod_colores`. */
export type EstPorProdColorItem = {
  id: string;
  /** Nombre en MAYÚSCULAS (valor usado en el match sobre descripciones). */
  nombre: string;
};

/** Escapa literales para armar un RegExp seguro. */
export function escaparRegexLiteral(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detecta qué colores del catálogo aparecen en la descripción del producto.
 * Compara en MAYÚSCULAS con límite de palabra (no letra/dígito alrededor).
 * Prioriza nombres más largos (p. ej. «AZUL MARINO» antes que «AZUL») y evita
 * doble match en el mismo tramo.
 */
export function matchColoresEnDescripcion(
  descripcion: string | null | undefined,
  colores: EstPorProdColorItem[]
): EstPorProdColorItem[] {
  const haystack = (descripcion ?? "").toLocaleUpperCase("es-AR").trim();
  if (!haystack || colores.length === 0) return [];

  const ordenados = [...colores].sort((a, b) => b.nombre.length - a.nombre.length);
  const matched: EstPorProdColorItem[] = [];
  let restante = haystack;

  for (const color of ordenados) {
    const nombre = color.nombre.trim();
    if (!nombre) continue;
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaparRegexLiteral(nombre)}(?![\\p{L}\\p{N}])`,
      "iu"
    );
    if (!pattern.test(restante)) continue;
    matched.push({ id: color.id, nombre: color.nombre });
    restante = restante.replace(pattern, (m) => " ".repeat(m.length));
  }

  return matched;
}
