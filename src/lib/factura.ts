/**
 * Constantes del módulo Factura (área Facturación).
 * Sin persistencia de comprobante aún: UI de alta (Crear) + búsqueda de ítems.
 */

export const FACTURA_TIPOS = [
  "presupuesto",
  "factura",
  "factura_fiscal",
  "nota_credito",
] as const;

export type FacturaTipo = (typeof FACTURA_TIPOS)[number];

export const FACTURA_TIPO_LABELS: Record<FacturaTipo, string> = {
  presupuesto: "Presupuesto",
  factura: "Factura",
  factura_fiscal: "Factura Fiscal",
  nota_credito: "Nota de Crédito",
};

/** Valor inicial del select en Crear. */
export const FACTURA_TIPO_DEFAULT: FacturaTipo = "presupuesto";

export function esFacturaTipo(value: string): value is FacturaTipo {
  return (FACTURA_TIPOS as readonly string[]).includes(value);
}

/** Máximo de sugerencias en el typeahead de productos (Crear). */
export const FACTURA_BUSQUEDA_PRODUCTOS_TAKE = 10;

/** Línea local del remito en Crear (aún sin persistencia). */
export type FacturaLineaLocal = {
  /** Clave estable en la grilla (permite duplicar el mismo cod en el futuro). */
  key: string;
  codTienda: string;
  descripcion: string;
  cantidad: number;
  pxLista: number;
};

export function totalLineaFactura(
  linea: Pick<FacturaLineaLocal, "cantidad" | "pxLista">
): number {
  return linea.cantidad * linea.pxLista;
}
