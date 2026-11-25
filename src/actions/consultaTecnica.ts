"use server";

import { revalidatePath } from "next/cache";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import {
  requireConsultaTecnicaLectura,
  requireEditorConsultaTecnica,
} from "@/lib/actionGates";
import { APP_ROUTES } from "@/lib/appRoutes";
import type {
  ConsultaTecnicaConversacionItem,
  ConsultaTecnicaMensajeItem,
  ConsultaTecnicaRecomendacionItem,
} from "@/lib/consultaTecnica";
import type { ItemConsultaTecnica } from "@/services/consultaTecnica.service";
import { getIdPersonalSesion } from "@/lib/sesion";
import type { ActionResult } from "@/lib/types";
import {
  agregarItemConsultaTecnicaSchema,
  buscarItemsConsultaTecnicaSchema,
  conversarConsultaTecnicaSchema,
  crearFichaItemConsultaTecnicaSchema,
  elegirCoincidenciaConsultaTecnicaSchema,
  eliminarConsultaTecnicaSchema,
  eliminarConversacionConsultaTecnicaSchema,
  enviarMensajeConsultaTecnicaSchema,
  guardarConsultaTecnicaSchema,
  leerMensajesConsultaTecnicaSchema,
} from "@/lib/validations/consultaTecnica";
import {
  agregarItemConsultaTecnica,
  buscarItemsConsultaTecnica,
  conversarConsultaTecnica,
  crearFichaItemConsultaTecnica,
  elegirCoincidenciaConsultaTecnica,
  eliminarConsultaTecnica,
  eliminarConversacionConsultaTecnica,
  enviarMensajeConsultaTecnica,
  guardarConsultaTecnica,
  listarMensajesConsultaTecnica,
} from "@/services/consultaTecnica.service";

function refrescar() {
  revalidatePath(APP_ROUTES.ventas.ventas.consultaTecnica);
}

export async function guardarConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult<ConsultaTecnicaRecomendacionItem>> {
  const gate = await requireEditorConsultaTecnica();
  if (gate) return gate;

  const parsed = guardarConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await guardarConsultaTecnica(parsed.data));
  if (out.ok) refrescar();
  return out;
}

export async function eliminarConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult> {
  const gate = await requireEditorConsultaTecnica();
  if (gate) return gate;

  const parsed = eliminarConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await eliminarConsultaTecnica(parsed.data.id));
  if (out.ok) refrescar();
  return out;
}

export async function eliminarConversacionConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const parsed = eliminarConversacionConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await eliminarConversacionConsultaTecnica(parsed.data.conversacionId));
  if (out.ok) refrescar();
  return out;
}

export async function listarMensajesConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult<ConsultaTecnicaMensajeItem[]>> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const parsed = leerMensajesConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  return fromServiceResult(await listarMensajesConsultaTecnica(parsed.data.conversacionId));
}

export async function enviarMensajeConsultaTecnicaAction(
  raw: unknown
): Promise<
  ActionResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
  }>
> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const personalId = await getIdPersonalSesion();
  if (personalId == null) return { ok: false, error: "Ingresá de nuevo para consultar." };

  const parsed = enviarMensajeConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(
    await enviarMensajeConsultaTecnica({
      personalId,
      conversacionId: parsed.data.conversacionId,
      texto: parsed.data.texto,
    })
  );
  if (out.ok) refrescar();
  return out;
}

export async function buscarItemsConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult<ItemConsultaTecnica[]>> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const parsed = buscarItemsConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  return fromServiceResult(await buscarItemsConsultaTecnica(parsed.data.q));
}

export async function crearFichaItemConsultaTecnicaAction(
  raw: unknown
): Promise<
  ActionResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
  }>
> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const personalId = await getIdPersonalSesion();
  if (personalId == null) return { ok: false, error: "Ingresá de nuevo para consultar." };

  const parsed = crearFichaItemConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(
    await crearFichaItemConsultaTecnica({ personalId, codTienda: parsed.data.codTienda })
  );
  if (out.ok) refrescar();
  return out;
}

export async function conversarConsultaTecnicaAction(
  raw: unknown
): Promise<
  ActionResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem | null;
  }>
> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const personalId = await getIdPersonalSesion();
  if (personalId == null) return { ok: false, error: "Ingresá de nuevo para consultar." };

  const parsed = conversarConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(
    await conversarConsultaTecnica({
      personalId,
      conversacionId: parsed.data.conversacionId,
      texto: parsed.data.texto,
    })
  );
  if (out.ok) refrescar();
  return out;
}

export async function elegirCoincidenciaConsultaTecnicaAction(
  raw: unknown
): Promise<
  ActionResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem;
  }>
> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const parsed = elegirCoincidenciaConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await elegirCoincidenciaConsultaTecnica(parsed.data));
  if (out.ok) refrescar();
  return out;
}

export async function agregarItemConsultaTecnicaAction(
  raw: unknown
): Promise<
  ActionResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem;
  }>
> {
  const gate = await requireConsultaTecnicaLectura();
  if (gate) return gate;

  const parsed = agregarItemConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await agregarItemConsultaTecnica(parsed.data));
  if (out.ok) refrescar();
  return out;
}
