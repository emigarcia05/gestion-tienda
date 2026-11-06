/** Titular al que conviene imputar el próximo cobro. No obliga a usarlo. */

export type FilaAliasPrioritario = {
  titular: string | null;
  cobro: number;
  ventasFiscales: number;
};

/**
 * Titular con mayor falta de cobro del mes (`vtas. fiscales − cobro` > 0).
 * Empate: el nombre que ordena primero. Sin falta de cobro, no hay sugerencia.
 */
export function titularPrioritarioCobro(filas: readonly FilaAliasPrioritario[]): string | null {
  let mejor: { titular: string; falta: number } | null = null;
  for (const fila of filas) {
    if (!fila.titular) continue;
    const falta = Math.round((fila.ventasFiscales - fila.cobro) * 100) / 100;
    if (falta <= 0) continue;
    const titular = fila.titular.toLocaleUpperCase("es-AR");
    if (
      !mejor ||
      falta > mejor.falta ||
      (falta === mejor.falta && titular.localeCompare(mejor.titular, "es") < 0)
    ) {
      mejor = { titular, falta };
    }
  }
  return mejor?.titular ?? null;
}
