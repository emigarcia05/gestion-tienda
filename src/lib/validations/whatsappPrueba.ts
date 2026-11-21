import { z } from "zod";
import { bsuidWhatsapp, telefonoWhatsappCanonico } from "@/lib/whatsapp/telefono";

/** Teléfono E.164 con +. Sin +, Meta antepone el país del número que envía. */
export const telefonoWhatsappSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "El teléfono tiene que empezar con + y el código de país.");

/** Teléfono E.164 o BSUID del chat. */
export const claveConversacionWhatsappSchema = z
  .string()
  .trim()
  .refine(
    (valor) => telefonoWhatsappCanonico(valor) != null || bsuidWhatsapp(valor) != null,
    "El teléfono tiene que empezar con + y el código de país."
  );

/** Sin teléfono: los últimos enviados y recibidos. Con clave: esa conversación (`+54` y `+549`, o el BSUID). */
export const listarMensajesWhatsappPruebaSchema = z.object({
  telefono: claveConversacionWhatsappSchema.optional(),
});

export const sugerirRespuestaWhatsappIaSchema = z.object({
  telefono: claveConversacionWhatsappSchema,
});

export const enviarTextoWhatsappPruebaSchema = z.object({
  to: telefonoWhatsappSchema,
  body: z
    .string()
    .trim()
    .min(1, "Escribí el mensaje.")
    .max(4096, "El mensaje supera los 4096 caracteres."),
});
