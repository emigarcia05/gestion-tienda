import { redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";

/** Componente de un producto compuesto (`prod_lista_compuestos`) con su costo resuelto. */
export interface ComponenteCompuestoItem {
  codTienda: string;
  descripcion: string;
  /** Unidades del componente por 1 unidad del compuesto (hasta 1 decimal). */
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
