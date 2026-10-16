import { parsePrecio } from "@/lib/parsearImport";

/** Presentaciones esperadas en la matriz del proveedor (orden de referencia). */
export const PRESENTACIONES_LISTA_PRECIOS_PDF = [
  "Un.",
  "¼",
  "½",
  "1 L",
  "4 L",
  "10 L",
  "20 L",
] as const;

export type PresentacionListaPreciosPdf = (typeof PRESENTACIONES_LISTA_PRECIOS_PDF)[number];

export interface FilaPdfMatrizNormalizada {
  descripcionBase: string;
  presentacion: string;
  descripcionExport: string;
  precio: number;
}

export interface MatrizListaPreciosPdf {
  presentaciones: string[];
  filas: Array<{
    descripcionBase: string;
    celdas: Record<string, string>;
  }>;
}

export interface AplanarMatrizMeta {
  filasOmitidasVacias: number;
  advertencias: string[];
}

const ALIAS_PRESENTACION: Record<string, string> = {
  un: "Un.",
  "un.": "Un.",
  unidad: "Un.",
  "1/4": "¼",
  "1/2": "½",
  "1l": "1 L",
  "4l": "4 L",
  "10l": "10 L",
  "20l": "20 L",
};

/** Normaliza encabezado de presentación para comparación y salida. */
export function normalizarPresentacion(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (ALIAS_PRESENTACION[lower]) return ALIAS_PRESENTACION[lower];
  const matchCanon = PRESENTACIONES_LISTA_PRECIOS_PDF.find(
    (p) => p.toLowerCase() === lower || p.replace(/\./g, "").toLowerCase() === lower.replace(/\./g, "")
  );
  if (matchCanon) return matchCanon;
  return t;
}

export function esPresentacionUnidad(presentacion: string): boolean {
  const n = normalizarPresentacion(presentacion).toLowerCase().replace(/\./g, "");
  return n === "un" || n === "unidad";
}

export function buildDescripcionExport(descripcionBase: string, presentacion: string): string {
  const base = descripcionBase.replace(/\s+/g, " ").trim();
  if (esPresentacionUnidad(presentacion)) return base;
  const pres = normalizarPresentacion(presentacion);
  return `${base} ${pres}`.replace(/\s+/g, " ").trim();
}

/** Marcador del proveedor en PDF (sin precio / no aplica); se ignora en celdas y descripciones. */
export const SIMBOLO_IGNORAR_PDF_MATRIZ = "▲";

/** Quita ▲ y normaliza espacios en texto extraído del PDF. */
export function limpiarTextoPdfMatriz(raw: string): string {
  return raw.replace(/▲/g, "").replace(/\s+/g, " ").trim();
}

/** Clave de upsert en `prod_precios_rex` (proveedor + descripción exportada del PDF). */
export function normalizarDescripcionPrecioRex(descripcionExport: string): string {
  return limpiarTextoPdfMatriz(descripcionExport);
}

/** Celda sin precio utilizable (vacía, guión, consultar, ▲, etc.). */
export function celdaPrecioEsVacia(raw: string | undefined | null): boolean {
  if (raw == null) return true;
  const t = limpiarTextoPdfMatriz(raw);
  if (!t) return true;
  const lower = t.toLowerCase();
  if (lower === "—" || lower === "-" || lower === "–" || lower === "n/a" || lower === "s/c") return true;
  if (lower.includes("consultar")) return true;
  return false;
}

export function parsePrecioMatriz(raw: string): number | null {
  if (celdaPrecioEsVacia(raw)) return null;
  const n = parsePrecio(limpiarTextoPdfMatriz(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Aplana matriz fila × presentación a filas unidimensionales.
 * Ignora cruces vacíos o sin precio válido.
 */
export function aplanarMatrizListaPrecios(
  matriz: MatrizListaPreciosPdf
): { filas: FilaPdfMatrizNormalizada[]; meta: AplanarMatrizMeta } {
  const advertencias: string[] = [];
  let filasOmitidasVacias = 0;
  const filas: FilaPdfMatrizNormalizada[] = [];

  const presentaciones = matriz.presentaciones.map(normalizarPresentacion).filter(Boolean);
  if (presentaciones.length === 0) {
    advertencias.push("No se detectaron columnas de presentación.");
    return { filas, meta: { filasOmitidasVacias, advertencias } };
  }

  for (const fila of matriz.filas) {
    const descripcionBase = limpiarTextoPdfMatriz(fila.descripcionBase);
    if (!descripcionBase) continue;

    for (const pres of presentaciones) {
      const raw = fila.celdas[pres] ?? fila.celdas[pres.toLowerCase()];
      const precio = parsePrecioMatriz(raw ?? "");
      if (precio == null) {
        filasOmitidasVacias++;
        continue;
      }
      filas.push({
        descripcionBase,
        presentacion: pres,
        descripcionExport: buildDescripcionExport(descripcionBase, pres),
        precio,
      });
    }
  }

  return { filas, meta: { filasOmitidasVacias, advertencias } };
}

/**
 * Normaliza una descripción para emparejar PDF ↔ `proveedores_prod_lista.descripcion_proveedor`:
 * MAYÚSCULAS sin tildes, coma decimal → punto, quita la unidad de litros pegada a un número
 * (`4 L`, `4LTS` → `4`) y colapsa espacios.
 */
export function normalizarDescripcionMatchPdf(raw: string): string {
  return limpiarTextoPdfMatriz(raw)
    .toLocaleUpperCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)\s*(LTRS?|LTS?|L)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Formas numéricas con que la lista del proveedor escribe cada presentación fraccionaria. */
const NUMEROS_PRESENTACION_FRACCION: Record<string, string[]> = {
  "¼": ["0.25", "1/4"],
  "½": ["0.5", "1/2"],
};

/**
 * Claves candidatas (normalizadas) de un ítem individualizado del PDF (descripción + presentación)
 * para buscarlo en la lista del proveedor. Ej.: `FIJADOR ALBA` + `4 L` → `FIJADOR ALBA 4`;
 * `FONDO BLANCO` + `½` → `FONDO BLANCO 0.5` / `FONDO BLANCO 1/2`; `Un.` → solo la descripción.
 */
export function clavesMatchItemPdf(descripcionBase: string, presentacion: string): string[] {
  const base = normalizarDescripcionMatchPdf(descripcionBase);
  if (!base) return [];
  if (esPresentacionUnidad(presentacion)) return [base];
  const pres = normalizarPresentacion(presentacion);
  const numeros = NUMEROS_PRESENTACION_FRACCION[pres] ?? [normalizarDescripcionMatchPdf(pres)];
  return numeros.filter(Boolean).map((n) => `${base} ${n}`);
}

/** Indica si una fila de celdas parece encabezado de presentaciones. */
export function filaPareceEncabezadoPresentaciones(celdas: string[]): boolean {
  const normalizadas = celdas.map(normalizarPresentacion);
  const tieneUn = normalizadas.some(esPresentacionUnidad);
  const tieneLitros = normalizadas.some((p) => /\d\s*L/i.test(p));
  return tieneUn && tieneLitros;
}
