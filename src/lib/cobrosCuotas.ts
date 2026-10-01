/** Ítem del catálogo `cobros_cuotas`: una etiqueta de un par forma de pago + entidad. */
export type CobrosCuotaItem = {
  id: string;
  /** Etiqueta libre (ej. `01`, `06 CUOTAS SIN INTERES`). */
  cuotas: string;
  pagoId: string;
  pagoNombre: string;
  entidadId: string;
  entidadNombre: string;
};

/** Cuotas del par seleccionado. Sin forma o sin entidad, no hay opciones. */
export function cuotasParaFormaYEntidad(
  cuotas: readonly CobrosCuotaItem[],
  pagoId: string,
  entidadId: string
): CobrosCuotaItem[] {
  if (!pagoId || !entidadId) return [];
  return cuotas.filter((cuota) => cuota.pagoId === pagoId && cuota.entidadId === entidadId);
}
