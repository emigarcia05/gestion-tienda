/**
 * Saldo IVA usado al comparar proveedores en pedidos (urgente / reposición): saldo acumulado de
 * Balance IVA (`bal_iva`), ajustes manuales (AJUSTE SALDO) incluidos. Sin valor manual aparte.
 */

import {
  modoComparacionCostoDesdeSaldo,
  type ModoComparacionCostoIva,
} from "@/lib/precioComparacionPedidoUrgenteReposicion";
import { calcularSaldoAcumuladoBalIva } from "@/services/balIva.service";

export { modoComparacionCostoDesdeSaldo, type ModoComparacionCostoIva };

/** Saldo para ranking de proveedores en pedidos (>0 compara sin IVA; ≤0 con IVA). */
export async function sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido(): Promise<number> {
  return calcularSaldoAcumuladoBalIva();
}
