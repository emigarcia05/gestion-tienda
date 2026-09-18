import { z } from "zod";

/** Periodo del listado de cobros persistidos. */
export const finVtasCobrosPeriodoSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2020).max(2046),
});
