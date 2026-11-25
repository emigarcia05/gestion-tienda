import "server-only";

import { z } from "zod";
import { leerWhatsappIaEnv } from "@/lib/whatsapp/ia/env";
import { WHATSAPP_IA_MAX_TOKENS_SALIDA } from "@/lib/whatsapp/ia/limites";
import type { ServiceResult } from "@/types/service.types";

const TIMEOUT_MS = 45_000;

const usoSchema = z.object({
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
});

const respuestaSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.unknown().optional() }).optional(),
      })
    )
    .optional(),
  usage: usoSchema.optional(),
});

function textoDeContenido(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((parte) => {
      if (!parte || typeof parte !== "object" || !("text" in parte)) return "";
      return typeof parte.text === "string" ? parte.text : "";
    })
    .join("")
    .trim();
}

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
  razonMinima: boolean,
  maxTokens: number
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
        [campoTope]: maxTokens,
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
  let respuesta = await postChat(env, input, campoTope, razonMinima, WHATSAPP_IA_MAX_TOKENS_SALIDA);
  if ("error" in respuesta) return { success: false, error: respuesta.error };

  if (respuesta.status === 400) {
    const crudo = JSON.stringify(respuesta.json ?? "");
    if (/reasoning_effort/i.test(crudo)) razonMinima = false;
    if (/max_completion_tokens/i.test(crudo)) campoTope = "max_tokens";
    if (!razonMinima || campoTope === "max_tokens") {
      respuesta = await postChat(
        env,
        input,
        campoTope,
        razonMinima,
        WHATSAPP_IA_MAX_TOKENS_SALIDA
      );
      if ("error" in respuesta) return { success: false, error: respuesta.error };
    }
  }

  if (respuesta.status < 200 || respuesta.status >= 300) {
    console.error("[whatsappIa][completar] http", respuesta.status);
    return { success: false, error: mensajeHttp(respuesta.status) };
  }

  const parsed = respuestaSchema.safeParse(respuesta.json);
  const texto = parsed.success ? textoDeContenido(parsed.data.choices?.[0]?.message?.content) : "";
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

const CONSULTA_TECNICA_MAX_TOKENS = 1000;

/** Redacción corta para el instructivo. Sin búsqueda web: el texto de la hoja ya viene en el pedido. */
export async function completarConsultaTecnica(
  input: CompletarWhatsappIaInput
): Promise<ServiceResult<string>> {
  const env = leerWhatsappIaEnv();
  if ("error" in env) return { success: false, error: env.error };

  let campoTope: "max_completion_tokens" | "max_tokens" = "max_completion_tokens";
  let razonMinima = true;
  let respuesta = await postChat(env, input, campoTope, razonMinima, CONSULTA_TECNICA_MAX_TOKENS);
  if ("error" in respuesta) return { success: false, error: respuesta.error };

  if (respuesta.status === 400) {
    const crudo = JSON.stringify(respuesta.json ?? "");
    if (/reasoning_effort/i.test(crudo)) razonMinima = false;
    if (/max_completion_tokens/i.test(crudo)) campoTope = "max_tokens";
    if (!razonMinima || campoTope === "max_tokens") {
      respuesta = await postChat(env, input, campoTope, razonMinima, CONSULTA_TECNICA_MAX_TOKENS);
      if ("error" in respuesta) return { success: false, error: respuesta.error };
    }
  }

  if (respuesta.status < 200 || respuesta.status >= 300) {
    console.error("[consultaTecnica][completar] http", respuesta.status);
    return { success: false, error: mensajeHttp(respuesta.status) };
  }

  let parsed = respuestaSchema.safeParse(respuesta.json);
  let texto = parsed.success ? textoDeContenido(parsed.data.choices?.[0]?.message?.content) : "";
  if (!texto && respuesta.status >= 200 && respuesta.status < 300) {
    const reintento = await postChat(env, input, "max_completion_tokens", false, 1500);
    if (!("error" in reintento) && reintento.status >= 200 && reintento.status < 300) {
      parsed = respuestaSchema.safeParse(reintento.json);
      texto = parsed.success ? textoDeContenido(parsed.data.choices?.[0]?.message?.content) : "";
    }
  }
  if (!texto) {
    console.error("[consultaTecnica][completar] vacio", respuesta.status);
    return { success: false, error: "El modelo no devolvió un texto." };
  }
  return { success: true, data: texto };
}

function urlsDeBusqueda(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) return [];
  const urls: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const sources = (item as { action?: { sources?: { url?: unknown }[] } }).action?.sources;
    if (!Array.isArray(sources)) continue;
    for (const fuente of sources) {
      if (typeof fuente.url === "string" && fuente.url.startsWith("https://")) urls.push(fuente.url);
    }
  }
  return urls;
}

/**
 * Busca la hoja del fabricante. Solo devuelve URLs que trajo la búsqueda, no las que redacta el modelo.
 * `web_search` no acepta razonamiento mínimo: va en `low`.
 */
export async function buscarFuentesConsultaTecnica(
  consulta: string
): Promise<ServiceResult<string[]>> {
  const env = leerWhatsappIaEnv();
  if ("error" in env) return { success: false, error: env.error };

  let response: Response;
  try {
    response = await fetch(`${env.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.modelo,
        tools: [
          {
            type: "web_search",
            user_location: { type: "approximate", country: "AR" },
          },
        ],
        reasoning: { effort: "low" },
        include: ["web_search_call.action.sources"],
        input: consulta,
        max_output_tokens: 800,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error("[consultaTecnica][fuentes] red", e instanceof Error ? e.name : "error");
    return { success: false, error: "No se pudo buscar la ficha del fabricante." };
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (response.status < 200 || response.status >= 300) {
    console.error("[consultaTecnica][fuentes] http", response.status);
    return { success: false, error: mensajeHttp(response.status) };
  }
  return { success: true, data: urlsDeBusqueda(json) };
}
