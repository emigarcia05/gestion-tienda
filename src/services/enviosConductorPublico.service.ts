/**
 * Token del link público del Conductor: `ENVIOS_CONDUCTOR_TOKEN` si está cargada; si no, se deriva de
 * `SESSION_SECRET` (HMAC fijo). Cambiar cualquiera de las dos invalida los links anteriores.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  rutaEnviosConductorPublica,
  tokenEnviosConductorFormatoValido,
} from "@/lib/enviosConductorPublico";
import type { ServiceResult } from "@/types/service.types";

const SESSION_SECRET_MIN = 32;

function digest(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

function tokenEnviosConductorEsperado(): string | null {
  const explicito = process.env.ENVIOS_CONDUCTOR_TOKEN?.trim() ?? "";
  if (tokenEnviosConductorFormatoValido(explicito)) return explicito;
  const secreto = process.env.SESSION_SECRET?.trim() ?? "";
  if (secreto.length < SESSION_SECRET_MIN) return null;
  return createHmac("sha256", secreto).update("envios-conductor-publico").digest("base64url");
}

export function tokenEnviosConductorValido(token: string): boolean {
  const esperado = tokenEnviosConductorEsperado();
  if (!esperado || !tokenEnviosConductorFormatoValido(token)) return false;
  return timingSafeEqual(digest(token), digest(esperado));
}

/** Ruta pública para compartir (Envíos · Programados). Expone el token: solo con permiso de envíos. */
export function rutaEnviosConductorParaCompartir(): ServiceResult<{ path: string }> {
  const token = tokenEnviosConductorEsperado();
  if (!token) {
    return { success: false, error: "El link del conductor no está configurado." };
  }
  return { success: true, data: { path: rutaEnviosConductorPublica(token) } };
}
