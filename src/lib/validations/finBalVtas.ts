import { z } from "zod";
import { globalSucursalIdSchema } from "@/lib/validations/common";
import { mesAnioQuerySchema } from "@/lib/validations/finBalGastoMensualBalance";

export const listarFinBalVtasPorMesAnioSchema = mesAnioQuerySchema;
export type ListarFinBalVtasPorMesAnioInput = z.infer<typeof listarFinBalVtasPorMesAnioSchema>;

const finBalVtasLineaCargaSchema = z.object({
  sucursalId: globalSucursalIdSchema,
  monto: z.coerce
    .number()
    .int("El monto debe ser un número entero.")
    .min(0, "El monto no puede ser negativo.")
    .max(2_000_000_000, "El monto es demasiado grande."),
});

export const guardarFinBalVtasCargaPeriodoSchema = mesAnioQuerySchema.extend({
  lineas: z
    .array(finBalVtasLineaCargaSchema)
    .min(1, "Ingresá al menos un monto de venta."),
});
export type GuardarFinBalVtasCargaPeriodoInput = z.infer<typeof guardarFinBalVtasCargaPeriodoSchema>;

/** Borra todas las sucursales de un mes/año. */
export const eliminarFinBalVtasPorPeriodoSchema = mesAnioQuerySchema;
export type EliminarFinBalVtasPorPeriodoInput = z.infer<
  typeof eliminarFinBalVtasPorPeriodoSchema
>;
