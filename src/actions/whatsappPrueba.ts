"use server";

import { revalidatePath } from "next/cache";
import { requireEditorWhatsappPrueba } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { APP_ROUTES } from "@/lib/appRoutes";
import type { ActionResult } from "@/lib/types";
import { enviarTextoWhatsappPruebaSchema, telefonoWhatsappSchema } from "@/lib/validations/whatsappPrueba";
import type { WhatsappPruebaMensajeItem } from "@/lib/whatsapp/tipos";
import {
  enviarTextoWhatsappPrueba,
  listarMensajesWhatsappPrueba,
} from "@/services/whatsappPrueba.service";

export async function enviarTextoWhatsappPruebaAction(
  raw: unknown
): Promise<ActionResult<{ messageId: string }>> {
  const gate = await requireEditorWhatsappPrueba();
  if (gate) return gate;

  const parsed = enviarTextoWhatsappPruebaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const out = fromServiceResult(await enviarTextoWhatsappPrueba(parsed.data));
    if (out.ok) revalidatePath(APP_ROUTES.administrador.whatsapp.prueba);
    return out;
  } catch (e) {
    console.error("[enviarTextoWhatsappPruebaAction]", e instanceof Error ? e.name : "error");
    return { ok: false, error: "No se pudo enviar el mensaje de prueba." };
  }
}

export async function listarMensajesWhatsappPruebaAction(
  raw: unknown
): Promise<ActionResult<WhatsappPruebaMensajeItem[]>> {
  const gate = await requireEditorWhatsappPrueba();
  if (gate) return gate;

  const parsed = telefonoWhatsappSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    return fromServiceResult(await listarMensajesWhatsappPrueba(parsed.data));
  } catch (e) {
    console.error("[listarMensajesWhatsappPruebaAction]", e instanceof Error ? e.name : "error");
    return { ok: false, error: "No se pudo leer la conversación." };
  }
}
