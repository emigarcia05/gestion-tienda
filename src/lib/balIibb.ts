/** Alícuota de Ingresos Brutos sobre la venta neta de IVA. */
export const IIBB_ALICUOTA = 0.04;
/** La venta se toma con IVA 21 % incluido: neto = total / 1,21. */
export const IIBB_DIVISOR_IVA = 1.21;

/** IIBB = (venta / 1,21) × 4 %, redondeado a centavos. Conserva el signo (NC en negativo). */
export function iibbDesdeTotalVenta(totalConIva: number): number {
  return Math.round((totalConIva / IIBB_DIVISOR_IVA) * IIBB_ALICUOTA * 100) / 100;
}
