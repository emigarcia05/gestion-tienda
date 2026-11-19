/**
 * Ítem descriptivo de Recepción de Compra.
 * No es el fallback `1503` (PRODUCTO VARIO de tienda) y no mueve stock.
 */
export const COD_TIENDA_PROD_VARIO_RECEPCION = "VARIO";

const PREFIJO_COD_EXT_PROD_VARIO = "VARIO-";

export function esItemProdVarioRecepcion(codTienda: string | null | undefined): boolean {
  return (codTienda ?? "").trim() === COD_TIENDA_PROD_VARIO_RECEPCION;
}

export function nuevoCodExtProdVario(): string {
  return `${PREFIJO_COD_EXT_PROD_VARIO}${crypto.randomUUID()}`;
}

/** Texto de la columna DESCRIPCIÓN. El código sentinel no se muestra. */
export function etiquetaDescripcionRecepcion(item: {
  codTienda: string;
  descripcionTienda: string;
}): string {
  const desc = item.descripcionTienda.trim();
  if (!esItemProdVarioRecepcion(item.codTienda)) return desc;
  return desc ? `PROD. VARIO — ${desc}` : "PROD. VARIO";
}
