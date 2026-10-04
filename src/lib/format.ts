/** Opciones estándar: 0 decimales, punto como separador de miles (ej. 1.500). */
const OPCIONES_ENTERO = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;

/** Formatea un número como precio en pesos (sin símbolo, 0 decimales, punto para miles). */
export function fmtPrecio(n: number): string {
  return Math.round(n).toLocaleString("es-AR", OPCIONES_ENTERO);
}

/** Formatea un valor numérico para tabla: 0 decimales, punto miles. Vacío/null → "" (vacío). */
export function fmtNumero(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return Math.round(n).toLocaleString("es-AR", OPCIONES_ENTERO);
}

/**
 * Cantidad / stock: entero si no hay fracción; si no, un decimal (`0,5`).
 * No usar `fmtNumero` (redondea y oculta 0,5).
 */
export { fmtCantidad } from "@/lib/cantidadUnDecimal";

/** Valor para celda: si está vacío o es nulo, devuelve "" (vacío); si no, String(val). */
export function fmtCelda<T>(val: T | null | undefined): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" && val.trim() === "") return "";
  return String(val);
}

/** Redondea un porcentaje de negocio (0–100) a 2 decimales. */
export function roundPorcentaje0a100(value: number): number {
  const capped = Math.max(0, Math.min(100, value));
  return Math.round(capped * 100) / 100;
}

/** Porcentaje en tabla (es-AR, 2 decimales + sufijo `%`). */
export function fmtPorcentajeTabla(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  const v = roundPorcentaje0a100(Number(n));
  const s = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${s}%`;
}

/** Variación porcentual sin decimales (entero). Para listados que muestran % redondeado (Precios Competencia, Comparación Categorías). */
export function fmtPctEntero(n: number): string {
  const entero = Math.round(n);
  if (entero > 0)  return `+${entero}%`;
  if (entero < 0) return `${entero}%`;
  return "0%";
}

/**
 * Título de modal: primera letra de cada palabra en mayúscula (resto en minúsculas por palabra).
 * Útil cuando los datos vienen en mayúsculas de catálogo.
 */
export function fmtTituloPalabras(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("es") + w.slice(1).toLocaleLowerCase("es"))
    .join(" ");
}

/**
 * Porcentaje `numerador / denominador` con un decimal (es-AR).
 * Denominador ≤ 0 → "—"; numerador 0 → "0,0 %".
 */
export function fmtPctDeTotal(numerador: number, denominador: number): string {
  if (denominador <= 0) return "—";
  if (numerador === 0) return "0,0 %";
  const p = (numerador / denominador) * 100;
  return `${p.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Participación de un ítem sobre un total filtrado (es-AR, compacto).
 * 1 decimal si hace falta (`15%` / `15,4%`). Denominador ≤ 0 → "".
 * `conSufijo: false` cuando el `%` ya está en el encabezado de columna.
 */
export function fmtPctParticipacion(
  numerador: number,
  denominador: number,
  conSufijo = true
): string {
  if (
    denominador <= 0 ||
    !Number.isFinite(numerador) ||
    !Number.isFinite(denominador)
  ) {
    return "";
  }
  const rounded = Math.round((numerador / denominador) * 1000) / 10;
  const entero = Number.isInteger(rounded);
  const s = rounded.toLocaleString("es-AR", {
    minimumFractionDigits: entero ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return conSufijo ? `${s}%` : s;
}
