/** Ítem del catálogo `cobros_cuotas` y sus pares forma de pago + entidad. */
export type CobrosCuotaVinculoItem = {
  pagoId: string;
  pagoNombre: string;
  entidadId: string;
  entidadNombre: string;
};

export type CobrosCuotaItem = {
  id: string;
  /** Etiqueta libre (ej. `06 CUOTAS SIN INTERES`). */
  cuotas: string;
  vinculos: CobrosCuotaVinculoItem[];
};

/** Cuotas que incluyen el par seleccionado. Sin forma o sin entidad, no hay opciones. */
export function cuotasParaFormaYEntidad(
  cuotas: readonly CobrosCuotaItem[],
  pagoId: string,
  entidadId: string
): CobrosCuotaItem[] {
  if (!pagoId || !entidadId) return [];
  return cuotas.filter((cuota) =>
    cuota.vinculos.some((vinculo) => vinculo.pagoId === pagoId && vinculo.entidadId === entidadId)
  );
}
