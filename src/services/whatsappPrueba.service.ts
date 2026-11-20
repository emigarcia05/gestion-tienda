import "server-only";

import { Prisma, type WhatsappPruebaEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarTextoWhatsapp } from "@/lib/whatsapp/enviarTexto";
import { leerWhatsappEnv } from "@/lib/whatsapp/env";
import {
  claveChatWhatsapp,
  telefonoWhatsappCanonico,
  telefonosEquivalentesWhatsapp,
} from "@/lib/whatsapp/telefono";
import type { WhatsappPruebaChatItem, WhatsappPruebaMensajeItem } from "@/lib/whatsapp/tipos";
import type {
  MensajeWebhookWhatsapp,
  WebhookWhatsappPrueba,
} from "@/lib/validations/whatsappWebhook";
import type { ServiceResult } from "@/types/service.types";

export type { WhatsappPruebaChatItem, WhatsappPruebaMensajeItem };

const ORDEN_ESTADO: Record<WhatsappPruebaEstado, number> = {
  RECIBIDO: 0,
  ACEPTADO: 1,
  ENVIADO: 2,
  ENTREGADO: 3,
  LEIDO: 4,
  FALLIDO: 5,
};

function esUnico(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function instanteWhatsapp(unixSegundos: string | undefined): Date | null {
  if (!unixSegundos || !/^\d{9,12}$/.test(unixSegundos)) return null;
  const ms = Number(unixSegundos) * 1000;
  const fecha = new Date(ms);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function textoCorto(raw: string | undefined, max: number): string | null {
  const limpio = (raw ?? "").replace(/EAA[A-Za-z0-9]+/g, "").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  return limpio.slice(0, max);
}

function cuerpoDeMensaje(mensaje: MensajeWebhookWhatsapp): { tipo: string; cuerpo: string } {
  const tipo = (mensaje.type ?? "text").slice(0, 32);
  if (tipo === "text" && mensaje.text?.body) {
    return { tipo, cuerpo: mensaje.text.body.slice(0, 4000) };
  }
  if (tipo === "image") {
    return { tipo, cuerpo: (mensaje.image?.caption || "[imagen]").slice(0, 4000) };
  }
  if (tipo === "document") {
    const nombre = mensaje.document?.filename ? ` ${mensaje.document.filename}` : "";
    const caption = mensaje.document?.caption;
    return { tipo, cuerpo: (caption || `[documento]${nombre}`).slice(0, 4000) };
  }
  if (tipo === "audio") return { tipo, cuerpo: "[audio]" };
  if (tipo === "video") {
    return { tipo, cuerpo: (mensaje.video?.caption || "[video]").slice(0, 4000) };
  }
  if (tipo === "sticker") return { tipo, cuerpo: "[sticker]" };
  if (tipo === "location") return { tipo, cuerpo: "[ubicación]" };
  if (tipo === "contacts") return { tipo, cuerpo: "[contacto]" };
  if (tipo === "button" && mensaje.button?.text) {
    return { tipo, cuerpo: mensaje.button.text.slice(0, 4000) };
  }
  const titulo =
    mensaje.interactive?.button_reply?.title ?? mensaje.interactive?.list_reply?.title;
  if (titulo) return { tipo, cuerpo: titulo.slice(0, 4000) };
  return { tipo, cuerpo: "[mensaje]" };
}

function estadoDesdeMeta(status: string): WhatsappPruebaEstado | null {
  if (status === "sent") return "ENVIADO";
  if (status === "delivered") return "ENTREGADO";
  if (status === "read" || status === "played") return "LEIDO";
  if (status === "failed") return "FALLIDO";
  return null;
}

function puedeAvanzar(actual: WhatsappPruebaEstado, siguiente: WhatsappPruebaEstado): boolean {
  if (siguiente === "FALLIDO") return actual === "ACEPTADO" || actual === "ENVIADO";
  if (actual === "FALLIDO") return false;
  return ORDEN_ESTADO[siguiente] > ORDEN_ESTADO[actual];
}

async function guardarEntrante(input: {
  waMessageId: string;
  telefono: string;
  nombre: string | null;
  tipo: string;
  cuerpo: string;
  waTimestamp: Date | null;
}): Promise<void> {
  try {
    await prisma.whatsappPruebaMensaje.create({
      data: {
        waMessageId: input.waMessageId,
        direccion: "ENTRANTE",
        telefono: input.telefono,
        nombre: input.nombre,
        cuerpo: input.cuerpo,
        tipo: input.tipo,
        estado: "RECIBIDO",
        waTimestamp: input.waTimestamp,
      },
    });
  } catch (e) {
    if (esUnico(e)) return;
    throw e;
  }
}

/**
 * Envío de prueba y persistencia. El remitente es el phone number ID del entorno,
 * nunca `sucursales.whatsapp`.
 */
export async function enviarTextoWhatsappPrueba(input: {
  to: string;
  body: string;
}): Promise<ServiceResult<{ messageId: string }>> {
  const envio = await enviarTextoWhatsapp(input);
  if (!envio.success) return envio;

  const telefono = telefonoWhatsappCanonico(input.to);
  if (!telefono) return { success: false, error: "El teléfono no es válido." };

  try {
    await prisma.whatsappPruebaMensaje.create({
      data: {
        waMessageId: envio.data.messageId,
        direccion: "SALIENTE",
        telefono,
        cuerpo: input.body.slice(0, 4000),
        tipo: "text",
        estado: "ACEPTADO",
      },
    });
  } catch (e) {
    if (esUnico(e)) return envio;
    console.error("[whatsappPrueba][guardar]", e instanceof Error ? e.name : "error");
    return { success: false, error: "Meta aceptó el mensaje, pero no quedó guardado." };
  }

  return envio;
}

export async function listarMensajesWhatsappPrueba(
  telefonoRaw: string | null
): Promise<ServiceResult<WhatsappPruebaMensajeItem[]>> {
  const telefono = telefonoRaw ? telefonoWhatsappCanonico(telefonoRaw) : null;
  if (telefonoRaw && !telefono) return { success: false, error: "El teléfono no es válido." };

  try {
    const filas = await prisma.whatsappPruebaMensaje.findMany({
      where: telefono ? { telefono: { in: telefonosEquivalentesWhatsapp(telefono) } } : {},
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        telefono: true,
        direccion: true,
        cuerpo: true,
        estado: true,
        errorTexto: true,
        createdAt: true,
      },
    });
    return {
      success: true,
      data: filas.map((fila) => ({
        id: fila.id,
        telefono: fila.telefono,
        direccion: fila.direccion,
        cuerpo: fila.cuerpo,
        estado: fila.estado,
        errorTexto: fila.errorTexto,
        creadoEnIso: fila.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    console.error("[whatsappPrueba][listar]", e instanceof Error ? e.name : "error");
    return { success: false, error: "No se pudo leer la conversación." };
  }
}

/** Un renglón por chat (el mensaje más nuevo). Agrupa `+54` y `+549` del mismo móvil. */
export async function listarChatsWhatsappPrueba(): Promise<
  ServiceResult<WhatsappPruebaChatItem[]>
> {
  try {
    const filas = await prisma.whatsappPruebaMensaje.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        telefono: true,
        nombre: true,
        cuerpo: true,
        direccion: true,
        createdAt: true,
      },
    });
    const vistos = new Set<string>();
    const chats: WhatsappPruebaChatItem[] = [];
    for (const fila of filas) {
      const clave = claveChatWhatsapp(fila.telefono);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      chats.push({
        telefono: fila.telefono,
        nombre: fila.nombre,
        ultimoCuerpo: fila.cuerpo,
        ultimoEnIso: fila.createdAt.toISOString(),
        ultimoDireccion: fila.direccion,
      });
      if (chats.length >= 100) break;
    }
    return { success: true, data: chats };
  } catch (e) {
    console.error("[whatsappPrueba][chats]", e instanceof Error ? e.name : "error");
    return { success: false, error: "No se pudieron leer los chats." };
  }
}

/** Persiste mensajes y estados del webhook ya verificado. Ignora otro phone number ID. */
export async function procesarWebhookWhatsappPrueba(
  payload: WebhookWhatsappPrueba
): Promise<ServiceResult<void>> {
  const env = leerWhatsappEnv();
  if ("error" in env) return { success: false, error: env.error };

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes) {
        if (change.field && change.field !== "messages") continue;
        const valor = change.value;
        if (valor.metadata?.phone_number_id !== env.phoneNumberId) continue;

        const nombres = new Map<string, string>();
        for (const contacto of valor.contacts ?? []) {
          const tel = contacto.wa_id ? telefonoWhatsappCanonico(contacto.wa_id) : null;
          const nombre = textoCorto(contacto.profile?.name, 120);
          if (tel && nombre) nombres.set(tel, nombre);
        }

        for (const mensaje of valor.messages ?? []) {
          const telefono = telefonoWhatsappCanonico(mensaje.from);
          if (!telefono) continue;
          const { tipo, cuerpo } = cuerpoDeMensaje(mensaje);
          await guardarEntrante({
            waMessageId: mensaje.id,
            telefono,
            nombre: nombres.get(telefono) ?? null,
            tipo,
            cuerpo,
            waTimestamp: instanteWhatsapp(mensaje.timestamp),
          });
        }

        for (const estado of valor.statuses ?? []) {
          const siguiente = estadoDesdeMeta(estado.status);
          if (!siguiente) continue;
          const actual = await prisma.whatsappPruebaMensaje.findUnique({
            where: { waMessageId: estado.id },
            select: { estado: true },
          });
          if (!actual || !puedeAvanzar(actual.estado, siguiente)) continue;
          const errorMeta = estado.errors?.[0];
          await prisma.whatsappPruebaMensaje.update({
            where: { waMessageId: estado.id },
            data: {
              estado: siguiente,
              errorTexto:
                siguiente === "FALLIDO"
                  ? textoCorto(errorMeta?.title ?? errorMeta?.message, 200)
                  : null,
              waTimestamp: instanteWhatsapp(estado.timestamp) ?? undefined,
            },
          });
        }
      }
    }
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[whatsappPrueba][webhook]", e instanceof Error ? e.name : "error");
    return { success: false, error: "No se pudo guardar el aviso de Meta." };
  }
}
