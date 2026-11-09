import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";

const descTextoSchema = z
  .string()
  .trim()
  .min(1, "Escribí el DESC.")
  .max(80, "El DESC. admite hasta 80 caracteres.")
  .transform((valor) => valor.toLocaleUpperCase("es-AR"));

const pagoIdsSchema = z
  .array(prismaCuidSchema)
  .min(1, "Elegí al menos una forma de pago.")
  .max(30, "Hay demasiadas formas de pago.")
  .transform((ids) => [...new Set(ids)]);

export const guardarTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema.optional(),
  descTexto: descTextoSchema,
  pagoIds: pagoIdsSchema,
});

export const idTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema,
});

export const moverTextoFormaPagoPresupuestoSchema = z.object({
  id: prismaCuidSchema,
  direccion: z.enum(["subir", "bajar"]),
});
