import { escaparRegexLiteral } from "@/lib/estPorProdColores";
import type { EstPorProdUnPresentacionItem } from "@/lib/estPorProdUnPresentacion";
import { formatearPresentacionConUnidad } from "@/lib/estPorProdUnPresentacion";

/** Ítem del catálogo `prod_presentaciones`. */
export type EstPorProdPresentacionItem = {
  id: string;
  /** Texto en MAYÚSCULAS a buscar en la descripción (derivado de numérica + unidad). */
  texto: string;
  unidadMedidaId: string;
  presentacionNumerica: number;
  /** Null si no hay conversión. */
  conversionAUnidadId: string | null;
  conversionAUnidadPresentacion: number | null;
  unidadMedida: EstPorProdUnPresentacionItem;
  conversionAUnidad: EstPorProdUnPresentacionItem | null;
};

/** Etiqueta de la presentación medida (unidad + número). */
export function etiquetaPresentacionMedida(item: EstPorProdPresentacionItem): string {
  return formatearPresentacionConUnidad(item.presentacionNumerica, item.unidadMedida);
}

/** Etiqueta de la conversión a otra unidad; vacío si no hay conversión. */
export function etiquetaPresentacionConversion(item: EstPorProdPresentacionItem): string {
  if (
    item.conversionAUnidad == null ||
    item.conversionAUnidadPresentacion == null
  ) {
    return "";
  }
  return formatearPresentacionConUnidad(
    item.conversionAUnidadPresentacion,
    item.conversionAUnidad
  );
}

/**
 * Unifica marcas de pulgada para el match en descripciones.
 * Catálogo suele usar `''`; DUX/listas suelen traer `"` (o ″ / “ ”).
 * Ejemplo: `3''` y `3"` pasan a la misma forma canónica.
 */
function normalizarMarcasPulgadaParaMatch(valor: string): string {
  return valor
    .replace(/\u2033/g, '"') // ″ double prime
    .replace(/\u2036/g, '"') // ‶
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // “ ” „ ‟
    .replace(/(?:'|′|´|ʼ){2}/g, '"'); // '' / dos primes como pulgadas
}

/**
 * Busca el primer (texto más largo) match del catálogo en la descripción.
 * Compara en MAYÚSCULAS con límite de palabra (no letra/dígito alrededor).
 * Normaliza marcas de pulgada (`3''` ↔ `3"`) antes del regex.
 */
export function matchPresentacionEnDescripcion(
  descripcion: string | null | undefined,
  presentaciones: EstPorProdPresentacionItem[]
): EstPorProdPresentacionItem | null {
  const haystack = normalizarMarcasPulgadaParaMatch(
    (descripcion ?? "").toLocaleUpperCase("es-AR").trim()
  );
  if (!haystack || presentaciones.length === 0) return null;

  const ordenados = [...presentaciones].sort((a, b) => b.texto.length - a.texto.length);

  for (const item of ordenados) {
    const texto = normalizarMarcasPulgadaParaMatch(item.texto.trim());
    if (!texto) continue;
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaparRegexLiteral(texto)}(?![\\p{L}\\p{N}])`,
      "iu"
    );
    if (pattern.test(haystack)) {
      return item;
    }
  }

  return null;
}
