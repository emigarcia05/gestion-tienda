/**
 * Token de revisión para detectar cambios en el saldo IVA (Balance IVA · `bal_iva`)
 * que afectan la comparación de proveedores en pedidos.
 */

import { huellaBalIva } from "@/services/balIva.service";
import { getEstadoIvaComparacionPedido } from "@/services/finBalPosicionIvaComparacionPedido.service";

function isoMaxUpdatedAt(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString();
}

/**
 * Huella estable: acumulado usado en pedidos + signo (>0 / ≤0) + config manual + cambios del libro.
 */
export async function getPosicionIvaComparacionRevisionToken(): Promise<string> {
  const [estadoComparacion, huellaLibro] = await Promise.all([
    getEstadoIvaComparacionPedido(),
    huellaBalIva(),
  ]);

  const acumulado = estadoComparacion.saldoEfectivoComparacion;
  const sign = acumulado > 0 ? "P" : acumulado < 0 ? "N" : "Z";
  const acumRounded = Math.round(acumulado);

  return [
    estadoComparacion.usarValorConfigurado ? "C" : "A",
    sign,
    String(acumRounded),
    isoMaxUpdatedAt(estadoComparacion.updatedAt),
    huellaLibro,
  ].join("|");
}
