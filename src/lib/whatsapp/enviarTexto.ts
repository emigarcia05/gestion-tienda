import "server-only";

import { z } from "zod";
import { leerWhatsappEnv } from "@/lib/whatsapp/env";
import type { ServiceResult } from "@/types/service.types";

const TIMEOUT_MS = 20_000;

const respuestaSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).optional(),
  error: z
    .object({
      message: z.string().optional(),
      code: z.number().optional(),
    })
    .optional(),
});

export type EnviarTextoWhatsappInput = {
  to: string;
  body: string;
};

function mensajeMeta(code: number | undefined, message: string | undefined): string {
  if (code === 131047) {
    return "Ese número no escribió en las últimas 24 horas. La prueba solo puede responder dentro de esa ventana.";
  }
  if (code === 10) {
    return "El identificador no puede usar la cuenta de mensajes de prueba.";
  }
  if (code === 190) {
    return "El identificador de acceso venció.";
  }
  if (code === 131026) {
    return "WhatsApp no pudo entregar el mensaje a ese número.";
  }
  const limpio = (message ?? "").replace(/EAA[A-Za-z0-9]+/g, "").trim();
  if (limpio && limpio.length <= 180 && !/bearer|access token/i.test(limpio)) {
    return code != null ? `${limpio} (${code})` : limpio;
  }
  return code != null ? `Meta no aceptó el mensaje (${code}).` : "Meta no aceptó el mensaje.";
}

/** POST de un texto al número configurado en el entorno. No persiste nada. */
export async function enviarTextoWhatsapp(
  input: EnviarTextoWhatsappInput
): Promise<ServiceResult<{ messageId: string }>> {
  const env = leerWhatsappEnv();
  if ("error" in env) return { success: false, error: env.error };

  const url = `https://graph.facebook.com/${env.graphVersion}/${env.phoneNumberId}/messages`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { body: input.body },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[whatsapp][enviarTexto] red", e instanceof Error ? e.name : "error");
    return { success: false, error: "No se pudo conectar con Meta." };
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  const parsed = respuestaSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[whatsapp][enviarTexto] respuesta", { http: response.status });
    return { success: false, error: "Meta respondió de una forma que no se pudo leer." };
  }

  const messageId = parsed.data.messages?.[0]?.id;
  if (response.ok && messageId) {
    return { success: true, data: { messageId } };
  }

  const code = parsed.data.error?.code;
  console.error("[whatsapp][enviarTexto]", { http: response.status, code: code ?? null });
  return {
    success: false,
    error: mensajeMeta(code, parsed.data.error?.message),
  };
}
