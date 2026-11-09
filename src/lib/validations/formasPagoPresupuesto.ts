import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

const formaTextoSchema = z
  .string()
  .trim()
  .min(1, "Escribí la forma de pago.")
  .max(80, "La forma de pago tiene hasta 80 caracteres.");

export const guardarTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema.optional(),
  descuento: z.number().int().min(0, "El DESC. va de 0 a 100.").max(100, "El DESC. va de 0 a 100."),
  formas: z
    .array(formaTextoSchema)
    .min(1, "Escribí al menos una forma de pago.")
    .max(30, "Hay demasiadas formas de pago."),
});

export const idTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema,
});

export const moverTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema,
  direccion: z.enum(["subir", "bajar"]),
});
