import "server-only";

import { enviarTextoWhatsapp } from "@/lib/whatsapp/enviarTexto";
import type { ServiceResult } from "@/types/service.types";

/**
 * Envío de prueba. El remitente es el phone number ID del entorno,
 * nunca `sucursales.whatsapp`. No guarda el mensaje.
 */
export async function enviarTextoWhatsappPrueba(input: {
  to: string;
  body: string;
}): Promise<ServiceResult<{ messageId: string }>> {
  return enviarTextoWhatsapp(input);
}
