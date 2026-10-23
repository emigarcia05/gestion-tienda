/**
 * Validación del link público del Conductor contra `ENVIOS_CONDUCTOR_TOKEN`. Sin la variable (o con
 * formato inválido) el link queda deshabilitado. Cambiar la variable invalida los links anteriores.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import {
  rutaEnviosConductorPublica,
  tokenEnviosConductorFormatoValido,
} from "@/lib/enviosConductorPublico";
import type { ServiceResult } from "@/types/service.types";

function digest(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

export function tokenEnviosConductorValido(token: string): boolean {
  const esperado = process.env.ENVIOS_CONDUCTOR_TOKEN?.trim() ?? "";
  if (!tokenEnviosConductorFormatoValido(esperado) || !tokenEnviosConductorFormatoValido(token)) {
    return false;
  }
  return timingSafeEqual(digest(token), digest(esperado));
}

/** Ruta pública para compartir (Envíos · Programados). Expone el token: solo con permiso de envíos. */
export function rutaEnviosConductorParaCompartir(): ServiceResult<{ path: string }> {
  const token = process.env.ENVIOS_CONDUCTOR_TOKEN?.trim() ?? "";
  if (!tokenEnviosConductorFormatoValido(token)) {
    return { success: false, error: "El link del conductor no está configurado." };
  }
  return { success: true, data: { path: rutaEnviosConductorPublica(token) } };
}
