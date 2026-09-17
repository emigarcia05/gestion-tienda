/**
 * Utilidades de búsqueda reutilizables (DRY).
 * filtroTexto: para Prisma where. matchByMultiTerm: para filtrado en cliente.
 */

/** Normaliza texto para búsqueda: minúsculas y sin acentos. */
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token.trim());
}

function hasWholeNumericToken(text: string, token: string): boolean {
  const parts = normalizeForSearch(text).split(/[^a-z0-9]+/).filter(Boolean);
  const tokenNorm = normalizeForSearch(token);
  return parts.includes(tokenNorm);
}

export type MatchByMultiTermOptions = {
  /**
   * Dígitos como substring (`2663` en un CEL). Default: token numérico entero
   * (lista-precios y catálogos).
   */
  numericAsContains?: boolean;
};

/**
 * Búsqueda por términos múltiples: el texto combinado debe contener TODOS los términos.
 * Insensible a mayúsculas y acentos. Reutilizable en lista-precios y otros filtros.
 */
export function matchByMultiTerm(
  textParts: (string | null | undefined)[],
  query: string,
  options?: MatchByMultiTermOptions
): boolean {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return true;
  const combined = textParts.filter(Boolean).join(" ");
  const combinedNorm = normalizeForSearch(combined);
  return terms.every((term) => {
    if (!options?.numericAsContains && isNumericToken(term)) {
      return hasWholeNumericToken(combined, term);
    }
    return combinedNorm.includes(normalizeForSearch(term));
  });
}

/** Para Prisma: where con AND de términos sobre varios campos. */
export function filtroTexto(q: string, campos: string[]) {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};

  return {
    AND: tokens.map((token) => ({
      OR: isNumericToken(token)
        ? campos.flatMap((campo: string) => [
            { [campo]: { equals: token, mode: "insensitive" as const } },
            { [campo]: { startsWith: `${token} `, mode: "insensitive" as const } },
            { [campo]: { endsWith: ` ${token}`, mode: "insensitive" as const } },
            { [campo]: { contains: ` ${token} `, mode: "insensitive" as const } },
          ])
        : campos.map((campo: string) => ({
            [campo]: { contains: token, mode: "insensitive" as const },
          })),
    })),
  };
}
