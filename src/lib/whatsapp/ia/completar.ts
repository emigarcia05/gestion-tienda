import "server-only";

import { z } from "zod";
import { leerWhatsappIaEnv } from "@/lib/whatsapp/ia/env";
import { WHATSAPP_IA_MAX_TOKENS_SALIDA } from "@/lib/whatsapp/ia/limites";
import type { ServiceResult } from "@/types/service.types";

const TIMEOUT_MS = 20_000;

const usoSchema = z.object({
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
});

const respuestaSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }).optional(),
      })
    )
    .optional(),
  usage: usoSchema.optional(),
});

export type CompletarWhatsappIaInput = {
  system: string;
  user: string;
};

export type CompletarWhatsappIaData = {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensTotal: number;
};

function tokens(n: number | undefined): number {
  if (n == null || !Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 1_000_000);
}

function mensajeHttp(status: number): string {
  if (status === 401 || status === 403) return "La clave del modelo no fue aceptada.";
  if (status === 429) return "El modelo está ocupado. Probá de nuevo en un momento.";
  return "No se pudo redactar la sugerencia.";
}

async function postChat(
  env: { apiKey: string; modelo: string; baseUrl: string },
  input: CompletarWhatsappIaInput,
  campoTope: "max_completion_tokens" | "max_tokens",
  razonMinima: boolean
): Promise<{ status: number; json: unknown } | { error: string }> {
  let response: Response;
  try {
    response = await fetch(`${env.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.modelo,
        [campoTope]: WHATSAPP_IA_MAX_TOKENS_SALIDA,
        ...(razonMinima ? { reasoning_effort: "minimal" } : {}),
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[whatsappIa][completar] red", e instanceof Error ? e.name : "error");
    return { error: "No se pudo conectar con el modelo." };
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

/**
 * Una completación corta. No persiste. La clave no se loguea.
 * Pide razonamiento mínimo: si no, `gpt-5-nano` gasta el tope y el texto vuelve vacío.
 * Si el modelo no acepta ese campo o `max_completion_tokens`, reintenta sin ellos.
 */
export async function completarWhatsappIa(
  input: CompletarWhatsappIaInput
): Promise<ServiceResult<CompletarWhatsappIaData>> {
  const env = leerWhatsappIaEnv();
  if ("error" in env) return { success: false, error: env.error };

  let campoTope: "max_completion_tokens" | "max_tokens" = "max_completion_tokens";
  let razonMinima = true;
  let respuesta = await postChat(env, input, campoTope, razonMinima);
  if ("error" in respuesta) return { success: false, error: respuesta.error };

  if (respuesta.status === 400) {
    const crudo = JSON.stringify(respuesta.json ?? "");
    if (/reasoning_effort/i.test(crudo)) razonMinima = false;
    if (/max_completion_tokens/i.test(crudo)) campoTope = "max_tokens";
    if (!razonMinima || campoTope === "max_tokens") {
      respuesta = await postChat(env, input, campoTope, razonMinima);
      if ("error" in respuesta) return { success: false, error: respuesta.error };
    }
  }

  if (respuesta.status < 200 || respuesta.status >= 300) {
    console.error("[whatsappIa][completar] http", respuesta.status);
    return { success: false, error: mensajeHttp(respuesta.status) };
  }

  const parsed = respuestaSchema.safeParse(respuesta.json);
  const texto = parsed.success ? (parsed.data.choices?.[0]?.message?.content ?? "").trim() : "";
  if (!texto) return { success: false, error: "El modelo no devolvió un texto." };

  const uso = parsed.success ? parsed.data.usage : undefined;
  const tokensEntrada = tokens(uso?.prompt_tokens);
  const tokensSalida = tokens(uso?.completion_tokens);
  const tokensTotal = tokens(uso?.total_tokens) || tokensEntrada + tokensSalida;

  return {
    success: true,
    data: {
      texto,
      modelo: env.modelo,
      tokensEntrada,
      tokensSalida,
      tokensTotal,
    },
  };
}
