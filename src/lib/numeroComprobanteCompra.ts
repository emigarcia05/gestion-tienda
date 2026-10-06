/** `tipo_comp` de `fin_compras_comprobante` que escribe la recepción / NC. */
export const TIPO_COMP_COMPRA = {
  FISCAL: "FACTURA",
  NO_FISCAL: "COMPROBANTE_COMPRA",
  NOTA_CREDITO: "NOTA_CREDITO",
} as const;

/** N° de comprobante de compra cargado a mano: `PPPP-NNNNNNNN` (punto de venta - número). */
export const COMPROBANTE_COMPRA_PV_DIGITOS = 4;
export const COMPROBANTE_COMPRA_NRO_DIGITOS = 8;

export const NUMERO_COMPROBANTE_COMPRA_REGEX = /^\d{4}-\d{8}$/;

/** Dígitos "corridos" de un bloque: cada dígito nuevo entra por la derecha (`1` → `0001`, `12` → `0012`). */
export function digitosBloqueComprobante(raw: string, largo: number): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(-largo);
}

export function formatearNumeroComprobanteCompra(pv: string, nro: string): string {
  return `${pv.padStart(COMPROBANTE_COMPRA_PV_DIGITOS, "0")}-${nro.padStart(
    COMPROBANTE_COMPRA_NRO_DIGITOS,
    "0"
  )}`;
}

/** Ambos bloques con al menos un dígito distinto de cero. */
export function numeroComprobanteCompraCompleto(pv: string, nro: string): boolean {
  return Number(pv) > 0 && Number(nro) > 0;
}
