/**
 * Cálculo de filas para **Flujo De Fondo** (`/finanzas/venc-por-fecha`).
 *
 * - **INGRESOS** = suma de `monto_acreditado` de movimientos INGRESO con
 *   `fecha_acreditacion` ese día (misma fuente que el modal VER).
 * - Fila 1: **SALDO** = vencimientos acumulados (previos + del día) − caja disponible − ingresos del día.
 * - Filas 2+: **CAJA** interna según fila 1 (si saldo₁ > caja₁ → 0; si no → caja₁ − saldo₁).
 * - Filas 2+: **SALDO** = saldo anterior + vencimiento del día − caja − ingresos del día.
 */

export interface FlujoDeFondoFilaEntrada {
  isoYmd: string;
  vencimientoDelDia: number;
}

export interface FilaFlujoDeFondoCalculada {
  isoYmd: string;
  vencimientoDelDia: number;
  /** Liquidez arrastrada (no se muestra; entra en SALDO). */
  cajaDisponible: number;
  /** Suma a acreditar ese día (`fecha_acreditacion`). Columna INGRESOS. */
  ingresosDelDia: number;
  saldo: number;
}

export interface CalcularFilasFlujoDeFondoParams {
  /** Suma de cajas de tesorería (y base de liquidez del primer día). */
  cajaDisponibleInicial: number;
  /** Pendiente vencido antes de hoy (compras + gastos). */
  saldoVencidoAntesDeHoy: number;
  /** Cheques diferidos acumulados hasta cada día (inclusive), por `isoYmd`. */
  liquidoChequesAcumuladoHasta?: Map<string, number>;
  /** Ingresos de caja acreditados por día (`fecha_acreditacion`). */
  ingresosAcreditadosPorDia?: Map<string, number>;
}

export function calcularFilasFlujoDeFondo(
  filasOrdenadas: FlujoDeFondoFilaEntrada[],
  params: CalcularFilasFlujoDeFondoParams
): FilaFlujoDeFondoCalculada[] {
  const {
    cajaDisponibleInicial,
    saldoVencidoAntesDeHoy,
    liquidoChequesAcumuladoHasta,
    ingresosAcreditadosPorDia,
  } = params;

  let vtosAcum = saldoVencidoAntesDeHoy;
  let saldoAnterior = 0;
  let cajaFilasSiguientes: number | null = null;

  return filasOrdenadas.map((fila, index) => {
    vtosAcum += fila.vencimientoDelDia;
    const ingresosDia = ingresosAcreditadosPorDia?.get(fila.isoYmd) ?? 0;

    if (index === 0) {
      const chequesHasta = liquidoChequesAcumuladoHasta?.get(fila.isoYmd) ?? 0;
      const cajaDisponible = cajaDisponibleInicial + chequesHasta;
      const saldo = vtosAcum - cajaDisponible - ingresosDia;
      cajaFilasSiguientes = saldo > cajaDisponible ? 0 : cajaDisponible - saldo;
      saldoAnterior = saldo;
      return {
        isoYmd: fila.isoYmd,
        vencimientoDelDia: fila.vencimientoDelDia,
        cajaDisponible,
        ingresosDelDia: ingresosDia,
        saldo,
      };
    }

    const cajaDisponible = cajaFilasSiguientes ?? 0;
    const saldo = saldoAnterior + fila.vencimientoDelDia - cajaDisponible - ingresosDia;
    saldoAnterior = saldo;
    return {
      isoYmd: fila.isoYmd,
      vencimientoDelDia: fila.vencimientoDelDia,
      cajaDisponible,
      ingresosDelDia: ingresosDia,
      saldo,
    };
  });
}
