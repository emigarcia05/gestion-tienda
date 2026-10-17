/**
 * Validación del link público del Conductor contra `ENVIOS_CONDUCTOR_TOKEN`. Sin la variable (o con
 * formato inválido) el link queda deshabilitado. Cambiar la variable invalida los links anteriores.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { tokenEnviosConductorFormatoValido } from "@/lib/enviosConductorPublico";

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
