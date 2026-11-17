import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function iguales(a: string, b: string): boolean {
  const izquierda = Buffer.from(a);
  const derecha = Buffer.from(b);
  if (izquierda.length !== derecha.length) return false;
  return timingSafeEqual(izquierda, derecha);
}

/** Compara `X-Hub-Signature-256` con el HMAC del cuerpo crudo. */
export function firmaWebhookWhatsappValida(
  cuerpoCrudo: string,
  encabezado: string | null,
  appSecret: string
): boolean {
  if (!encabezado?.startsWith("sha256=")) return false;
  const recibido = encabezado.slice("sha256=".length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(recibido)) return false;
  const esperado = createHmac("sha256", appSecret).update(cuerpoCrudo, "utf8").digest("hex");
  return iguales(esperado, recibido);
}

export function verifyTokenWhatsappValido(recibido: string, esperado: string): boolean {
  return iguales(recibido, esperado);
}
