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

/**
 * Punto de venta. Vacío se guarda `""` y se muestra `000_`.
 * Un solo `0` (el bloque queda en ceros) se guarda `"0"` y se muestra `0000`.
 */
export function digitosPuntoVentaComprobante(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-COMPROBANTE_COMPRA_PV_DIGITOS);
  const significativo = digits.replace(/^0+/, "");
  if (significativo.length > 0) return significativo;
  return digits.length === COMPROBANTE_COMPRA_PV_DIGITOS ? "0" : "";
}

/** Máscara del punto de venta: vacío `000_`, `"0"` → `0000`, `"13"` → `0013`. */
export function mascaraPuntoVentaComprobante(pv: string): string {
  const limpio = pv.replace(/\D/g, "");
  if (limpio === "") return "000_";
  return limpio.padStart(COMPROBANTE_COMPRA_PV_DIGITOS, "0").slice(-COMPROBANTE_COMPRA_PV_DIGITOS);
}

export function formatearNumeroComprobanteCompra(pv: string, nro: string): string {
  return `${pv.padStart(COMPROBANTE_COMPRA_PV_DIGITOS, "0")}-${nro.padStart(
    COMPROBANTE_COMPRA_NRO_DIGITOS,
    "0"
  )}`;
}

/** Punto de venta cargado (incluye `0000`) y número distinto de cero. */
export function numeroComprobanteCompraCompleto(pv: string, nro: string): boolean {
  return pv.replace(/\D/g, "") !== "" && Number(nro) > 0;
}
