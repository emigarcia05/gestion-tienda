import { z } from "zod";

/** Teléfono E.164 con +. Sin +, Meta antepone el país del número que envía. */
export const telefonoWhatsappSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "El teléfono tiene que empezar con + y el código de país.");

export const enviarTextoWhatsappPruebaSchema = z.object({
  to: telefonoWhatsappSchema,
  body: z
    .string()
    .trim()
    .min(1, "Escribí el mensaje.")
    .max(4096, "El mensaje supera los 4096 caracteres."),
});
