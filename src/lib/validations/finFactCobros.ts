import { z } from "zod";

/** Periodo del listado y del sync DUX Fact & Cobros. */
export const finFactCobrosPeriodoSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2020).max(2046),
});

export const syncFacturasVentasDuxBodySchema = finFactCobrosPeriodoSchema.extend({
  continuing: z.boolean().optional(),
});
