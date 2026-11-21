import { z } from "zod";

/**
 * Aviso de Meta. `from` puede faltar si el usuario tiene nombre de usuario:
 * en ese caso el identificador es `from_user_id` (BSUID).
 * Un ítem que no cumple no tira el resto del aviso: el servicio parsea cada uno.
 */
const mensajeSchema = z
  .object({
    from: z.string().max(32).nullish(),
    from_user_id: z.string().max(80).nullish(),
    id: z.string().min(1).max(512),
    timestamp: z.union([z.string(), z.number()]).nullish(),
    type: z.string().max(32).nullish(),
    text: z.object({ body: z.string().nullish() }).nullish(),
    image: z.object({ caption: z.string().nullish() }).nullish(),
    document: z
      .object({
        caption: z.string().nullish(),
        filename: z.string().max(200).nullish(),
      })
      .nullish(),
    video: z.object({ caption: z.string().nullish() }).nullish(),
    button: z.object({ text: z.string().max(200).nullish() }).nullish(),
    interactive: z
      .object({
        button_reply: z.object({ title: z.string().max(200).nullish() }).nullish(),
        list_reply: z.object({ title: z.string().max(200).nullish() }).nullish(),
      })
      .nullish(),
    contacts: z
      .array(
        z.object({
          origin: z.string().max(64).optional(),
          phones: z
            .array(
              z.object({
                phone: z.string().max(32).nullish(),
                wa_id: z.string().max(32).nullish(),
              })
            )
            .max(5)
            .nullish(),
        })
      )
      .max(5)
      .nullish(),
  })
  .refine((mensaje) => Boolean(mensaje.from || mensaje.from_user_id), { path: ["from"] });

const estadoSchema = z.object({
  id: z.string().min(1).max(512),
  status: z.string().max(32),
  timestamp: z.union([z.string(), z.number()]).nullish(),
  recipient_id: z.string().max(32).nullish(),
  recipient_user_id: z.string().max(80).nullish(),
  errors: z
    .array(
      z.object({
        title: z.string().optional(),
        message: z.string().optional(),
        code: z.union([z.number(), z.string()]).optional(),
      })
    )
    .max(5)
    .optional(),
});

const contactoSchema = z.object({
  profile: z
    .object({
      name: z.string().max(200).nullish(),
      username: z.string().max(64).nullish(),
    })
    .nullish(),
  wa_id: z.string().max(32).nullish(),
  user_id: z.string().max(80).nullish(),
});

const valorSchema = z.object({
  metadata: z
    .object({
      phone_number_id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  contacts: z.array(z.unknown()).max(50).nullish(),
  messages: z.array(z.unknown()).max(50).nullish(),
  statuses: z.array(z.unknown()).max(50).nullish(),
});

export const webhookWhatsappPruebaSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.string().optional(),
              value: valorSchema,
            })
          )
          .max(20),
      })
    )
    .max(10)
    .optional(),
});

export const mensajeWebhookWhatsappSchema = mensajeSchema;
export const estadoWebhookWhatsappSchema = estadoSchema;
export const contactoWebhookWhatsappSchema = contactoSchema;

export type WebhookWhatsappPrueba = z.infer<typeof webhookWhatsappPruebaSchema>;
export type MensajeWebhookWhatsapp = z.infer<typeof mensajeSchema>;
export type EstadoWebhookWhatsapp = z.infer<typeof estadoSchema>;
export type ContactoWebhookWhatsapp = z.infer<typeof contactoSchema>;
