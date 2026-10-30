import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

/** `monto = null` quita la obligación del titular. */
export const guardarFacturaFiscalObligatoriaSchema = z.object({
  titularId: prismaCuidOrUuidSchema,
  monto: z
    .number()
    .int("El monto debe ser un número entero.")
    .positive("El monto debe ser mayor a cero.")
    .max(2_000_000_000, "El monto es demasiado grande.")
    .nullable(),
});

export type GuardarFacturaFiscalObligatoriaInput = z.infer<
  typeof guardarFacturaFiscalObligatoriaSchema
>;
