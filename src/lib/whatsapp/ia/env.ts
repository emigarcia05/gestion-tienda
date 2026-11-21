import "server-only";

import {
  OPENIA_BASE_URL_DEFAULT,
  OPENIA_MODELO_DEFAULT,
} from "@/lib/whatsapp/ia/limites";

export type WhatsappIaEnv = {
  apiKey: string;
  modelo: string;
  baseUrl: string;
};

const MODELO_OK = /^[a-zA-Z0-9._:-]{1,64}$/;

/**
 * Clave y modelo de la sugerencia. La clave no sale de esta función.
 * La URL vacía usa la API de chat completions de OpenAI.
 */
export function leerWhatsappIaEnv(): WhatsappIaEnv | { error: string } {
  const apiKey = (process.env.OPENIA_API_KEY ?? "").trim();
  const modelo = (process.env.OPENIA_MODELO ?? "").trim() || OPENIA_MODELO_DEFAULT;
  const baseRaw = (process.env.OPENIA_BASE_URL ?? "").trim();
  const baseUrl = (baseRaw || OPENIA_BASE_URL_DEFAULT).replace(/\/+$/, "");

  if (!apiKey) return { error: "Falta OPENIA_API_KEY en el entorno." };
  if (!MODELO_OK.test(modelo)) return { error: "OPENIA_MODELO no es válido." };
  if (!/^https:\/\/[^\s]+$/i.test(baseUrl)) {
    return { error: "OPENIA_BASE_URL tiene que ser https." };
  }

  return { apiKey, modelo, baseUrl };
}
