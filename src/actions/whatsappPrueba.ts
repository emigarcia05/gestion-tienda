"use server";

import { requireEditorWhatsappPrueba } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import { enviarTextoWhatsappPruebaSchema } from "@/lib/validations/whatsappPrueba";
import { enviarTextoWhatsappPrueba } from "@/services/whatsappPrueba.service";

export async function enviarTextoWhatsappPruebaAction(
  raw: unknown
): Promise<ActionResult<{ messageId: string }>> {
  const gate = await requireEditorWhatsappPrueba();
  if (gate) return gate;

  const parsed = enviarTextoWhatsappPruebaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    return fromServiceResult(await enviarTextoWhatsappPrueba(parsed.data));
  } catch (e) {
    console.error("[enviarTextoWhatsappPruebaAction]", e instanceof Error ? e.name : "error");
    return { ok: false, error: "No se pudo enviar el mensaje de prueba." };
  }
}
