import "server-only";

import { z } from "zod";

const versionSchema = z.string().regex(/^v\d+\.\d+$/);
const phoneNumberIdSchema = z.string().regex(/^\d{8,20}$/);

export type WhatsappEnvConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
};

/**
 * Lee la configuración del número de prueba.
 * El phone number ID no es `sucursales.whatsapp`.
 * El token no sale de esta función hacia logs ni hacia el cliente.
 */
export function leerWhatsappEnv(): WhatsappEnvConfig | { error: string } {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
  const graphVersion = (process.env.WHATSAPP_GRAPH_VERSION ?? "").trim();

  if (!accessToken) {
    return { error: "Falta WHATSAPP_ACCESS_TOKEN en el entorno." };
  }
  if (!phoneNumberIdSchema.safeParse(phoneNumberId).success) {
    return { error: "Falta WHATSAPP_PHONE_NUMBER_ID del número de prueba." };
  }
  if (!versionSchema.safeParse(graphVersion).success) {
    return { error: "Falta WHATSAPP_GRAPH_VERSION (por ejemplo v27.0)." };
  }

  return { accessToken, phoneNumberId, graphVersion };
}

export type WhatsappWebhookEnv = {
  appSecret: string;
  verifyToken: string;
  phoneNumberId: string;
};

/** Secreto de la app y frase de verificación del webhook. No se devuelven al cliente. */
export function leerWhatsappWebhookEnv(): WhatsappWebhookEnv | { error: string } {
  const appSecret = (process.env.WHATSAPP_APP_SECRET ?? "").trim();
  const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN ?? "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();

  if (!/^[a-f0-9]{32}$/i.test(appSecret)) {
    return { error: "WHATSAPP_APP_SECRET está incompleto. En Meta, Mostrar, y copiá el valor entero." };
  }
  if (verifyToken.length < 4) {
    return { error: "Falta WHATSAPP_VERIFY_TOKEN." };
  }
  if (!phoneNumberIdSchema.safeParse(phoneNumberId).success) {
    return { error: "Falta WHATSAPP_PHONE_NUMBER_ID del número de prueba." };
  }

  return { appSecret, verifyToken, phoneNumberId };
}
