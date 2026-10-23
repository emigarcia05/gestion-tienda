import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import { listarIvaDebitoFinBalPorAnio } from "@/services/finBalIvaDeb.service";
import { sumarIvaCreditoPorMesAnio } from "@/services/finBalPosicionIva.service";
/** Inicio del acumulado «IVA SALDO» usado en `pxComparablePedidoUrgenteReposicion` (Pedido Urgente / reposición). */
const ACUM_PEDIDO_COMPARE_IVA_ANIO = 2026;
const ACUM_PEDIDO_COMPARE_IVA_MES = 4;

/**
 * Suma de «IVA SALDO» mensual (débito − crédito como en Posición IVA) desde abril 2026
 * inclusive hasta el mes calendario actual en Argentina (inclusive). Meses futuros no entran.
 */
export async function calcularIvaSaldoAcumuladoDesdePosicionIva(): Promise<number> {
  try {
    const { mes: mesActual, anio: anioActual } = mesAnioCalendarioArgentina();
    let total = 0;

    for (let anio = ACUM_PEDIDO_COMPARE_IVA_ANIO; anio <= anioActual; anio++) {
      const mesInicio = anio === ACUM_PEDIDO_COMPARE_IVA_ANIO ? ACUM_PEDIDO_COMPARE_IVA_MES : 1;
      const mesFin = anio === anioActual ? mesActual : 12;
      if (mesInicio > mesFin) continue;

      const [debitoPorMes, creditoPorMes] = await Promise.all([
        listarIvaDebitoFinBalPorAnio(anio),
        sumarIvaCreditoPorMesAnio(anio),
      ]);

      for (let mes = mesInicio; mes <= mesFin; mes++) {
        const ix = mes - 1;
        total += (debitoPorMes[ix] ?? 0) - (creditoPorMes[ix] ?? 0);
      }
    }

    return total;
  } catch (e) {
    console.error("calcularIvaSaldoAcumuladoDesdePosicionIva", e);
    return 0;
  }
}

export { sumarIvaSaldoAcumuladoParaComparacionProveedoresPedido } from "@/services/finBalPosicionIvaComparacionPedido.service";
