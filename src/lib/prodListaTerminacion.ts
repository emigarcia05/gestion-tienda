/** Valores de `prod_lista.terminacion`. Vacío = `null` en base. */
export const TERMINACIONES_PROD_LISTA = ["BRILLANTE", "SATINADO", "MATE"] as const;

export type TerminacionProdListaValor = (typeof TERMINACIONES_PROD_LISTA)[number];

export function esTerminacionProdLista(value: string): value is TerminacionProdListaValor {
  return (TERMINACIONES_PROD_LISTA as readonly string[]).includes(value);
}
