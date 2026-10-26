/**
 * Token de revisión para detectar cambios en el saldo IVA (Balance IVA · `bal_iva`)
 * que afectan la comparación de proveedores en pedidos.
 */

import { calcularSaldoAcumuladoBalIva, huellaBalIva } from "@/services/balIva.service";

/** Huella estable: signo (>0 / ≤0) + saldo usado en pedidos + cambios del libro. */
export async function getPosicionIvaComparacionRevisionToken(): Promise<string> {
  const [saldo, huellaLibro] = await Promise.all([calcularSaldoAcumuladoBalIva(), huellaBalIva()]);
  const sign = saldo > 0 ? "P" : saldo < 0 ? "N" : "Z";
  return [sign, String(Math.round(saldo)), huellaLibro].join("|");
}
