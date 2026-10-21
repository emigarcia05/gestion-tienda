import { CANTIDAD_UN_DECIMAL_MAX, redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";

/** `prod_lista_compuestos.cantidad` es `DECIMAL(14,4)`: fracciones chicas como 0,005 de un tambor. */
export const CANTIDAD_COMPONENTE_DECIMALES = 4;
const FACTOR_COMPONENTE = 10 ** CANTIDAD_COMPONENTE_DECIMALES;

export function redondearCantidadComponente(n: number): number {
  return Math.round(n * FACTOR_COMPONENTE) / FACTOR_COMPONENTE;
}

export function cantidadComponenteDesdePrisma(
  value: { toNumber: () => number } | number | null | undefined
): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : value.toNumber();
  return Number.isFinite(n) ? redondearCantidadComponente(n) : 0;
}

export function esCantidadComponenteValida(n: number): boolean {
  return (
    Number.isFinite(n) &&
    n > 0 &&
    n <= CANTIDAD_UN_DECIMAL_MAX &&
    Math.abs(redondearCantidadComponente(n) - n) < 1e-9
  );
}

/** Input `0,005` / `2` → número; null si vacío, ≤ 0 o con más de 4 decimales. */
export function parseCantidadComponente(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return null;
  const n = Number(t);
  return esCantidadComponenteValida(n) ? n : null;
}

/** Valor de input es-AR sin ceros de más (`0,005`, `2`). */
export function formatCantidadComponenteInput(n: number): string {
  return redondearCantidadComponente(n).toLocaleString("es-AR", {
    useGrouping: false,
    maximumFractionDigits: CANTIDAD_COMPONENTE_DECIMALES,
  });
}

/** Componente de un producto compuesto (`prod_lista_compuestos`) con su costo resuelto. */
export interface ComponenteCompuestoItem {
  codTienda: string;
  descripcion: string;
  /** Unidades del componente por 1 unidad del compuesto (hasta 4 decimales). */
  cantidad: number;
  /** Costo de compra resuelto del componente (`resolverCostoCompraTienda`). */
  costoUnitario: number;
}

export interface ComposicionProductoTienda {
  esProductoCompuesto: boolean;
  /** Este ítem es componente de otros compuestos (no puede ser compuesto). */
  esComponenteDe: number;
  componentes: ComponenteCompuestoItem[];
}

/** Opción del buscador de componentes (ítems de `prod_lista` que no son compuestos). */
export interface ComponenteCandidatoItem {
  codTienda: string;
  descripcion: string;
  costoUnitario: number;
}

/** Costo del compuesto = Σ (cantidad × costo unitario de cada componente). */
export function costoProductoCompuesto(
  componentes: Pick<ComponenteCompuestoItem, "cantidad" | "costoUnitario">[]
): number {
  return componentes.reduce((acc, c) => acc + c.cantidad * c.costoUnitario, 0);
}

/**
 * Stock del compuesto = kits que se pueden armar: mínimo de ⌊stock / cantidad⌋ entre componentes.
 * Sin componentes o con algún componente sin stock → 0.
 */
export function stockProductoCompuesto(
  componentes: { cantidad: number; stock: number }[]
): number {
  if (componentes.length === 0) return 0;
  let kits = Number.POSITIVE_INFINITY;
  for (const c of componentes) {
    if (c.cantidad <= 0) continue;
    const stock = redondearCantidadUnDecimal(c.stock);
    kits = Math.min(kits, Math.floor(stock / c.cantidad + 1e-9));
  }
  return Number.isFinite(kits) ? Math.max(0, kits) : 0;
}
