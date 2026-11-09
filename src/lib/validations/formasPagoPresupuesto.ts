import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

const vinculoSchema = z.object({
  pagoId: prismaCuidSchema,
  cuotaIds: z.array(prismaCuidSchema).max(30, "Hay demasiadas cuotas."),
});

export const guardarTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema.optional(),
  descuento: z.number().int().min(0, "El DESC. va de 0 a 100.").max(100, "El DESC. va de 0 a 100."),
  vinculos: z
    .array(vinculoSchema)
    .min(1, "Elegí al menos una forma de pago.")
    .max(30, "Hay demasiadas formas de pago."),
});

export const idTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema,
});

export const moverTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema,
  direccion: z.enum(["subir", "bajar"]),
});
