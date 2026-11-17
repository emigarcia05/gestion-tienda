import { z } from "zod";

const mensajeSchema = z.object({
  from: z.string(),
  id: z.string().min(1).max(200),
  timestamp: z.string().optional(),
  type: z.string().max(32).optional(),
  text: z.object({ body: z.string().max(4096) }).optional(),
  image: z.object({ caption: z.string().max(1024).optional() }).optional(),
  document: z
    .object({
      caption: z.string().max(1024).optional(),
      filename: z.string().max(200).optional(),
    })
    .optional(),
  video: z.object({ caption: z.string().max(1024).optional() }).optional(),
  button: z.object({ text: z.string().max(200).optional() }).optional(),
  interactive: z
    .object({
      button_reply: z.object({ title: z.string().max(200).optional() }).optional(),
      list_reply: z.object({ title: z.string().max(200).optional() }).optional(),
    })
    .optional(),
});

const estadoSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.string().max(32),
  timestamp: z.string().optional(),
  recipient_id: z.string().optional(),
  errors: z
    .array(
      z.object({
        title: z.string().max(200).optional(),
        message: z.string().max(300).optional(),
        code: z.number().optional(),
      })
    )
    .optional(),
});

const valorSchema = z.object({
  metadata: z.object({ phone_number_id: z.string().optional() }).optional(),
  contacts: z
    .array(
      z.object({
        profile: z.object({ name: z.string().max(200).optional() }).optional(),
        wa_id: z.string().optional(),
      })
    )
    .optional(),
  messages: z.array(mensajeSchema).max(50).optional(),
  statuses: z.array(estadoSchema).max(50).optional(),
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

export type WebhookWhatsappPrueba = z.infer<typeof webhookWhatsappPruebaSchema>;
export type MensajeWebhookWhatsapp = z.infer<typeof mensajeSchema>;
