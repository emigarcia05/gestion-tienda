"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { APP_ROUTES } from "@/lib/appRoutes";
import { getIdPersonalSesion } from "@/lib/sesion";
import type { ActionResult } from "@/lib/types";
import {
  chequeEmitidoIdSchema,
  chequesEmitidosCajaSchema,
  emitirEcheqPagoProveedorSchema,
} from "@/lib/validations/controlComprobantes";
import {
  anularChequeEmitido,
  emitirEcheqPagoProveedor,
  listarCajasEmiteCheque,
  listarChequesEmitidosDeCaja,
  type CajaEmiteChequeOpcion,
  type ChequesEmitidosCaja,
} from "@/services/tesoreriaChequesEmitidos.service";

function revalidateChequesEmitidos(): void {
  revalidatePath(APP_ROUTES.finanzas.operaciones.compCompras);
  revalidatePath(APP_ROUTES.finanzas.tesoreria.cajas);
  revalidatePath(APP_ROUTES.finanzas.tesoreria.movimientos);
  revalidatePath(APP_ROUTES.finanzas.tesoreria.flujoDeFondos);
}

export async function listarCajasEmiteChequeAction(): Promise<
  ActionResult<CajaEmiteChequeOpcion[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarCajasEmiteCheque() };
  } catch (e) {
    console.error("[listarCajasEmiteChequeAction]", e);
    return { ok: false, error: "No se pudieron cargar las cajas que emiten cheques." };
  }
}

export async function emitirEcheqPagoProveedorAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const personalId = await getIdPersonalSesion();
  if (personalId == null) return { ok: false, error: "Ingresá con tu usuario." };
  const parsed = emitirEcheqPagoProveedorSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await emitirEcheqPagoProveedor({ ...parsed.data, personalId });
  if (res.success) revalidateChequesEmitidos();
  return fromServiceResult(res);
}

export async function listarChequesEmitidosCajaAction(
  raw: unknown
): Promise<ActionResult<ChequesEmitidosCaja>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = chequesEmitidosCajaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  return fromServiceResult(await listarChequesEmitidosDeCaja(parsed.data.cajaId));
}

export async function anularChequeEmitidoAction(raw: unknown): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = chequeEmitidoIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await anularChequeEmitido(parsed.data.id);
  if (res.success) revalidateChequesEmitidos();
  return fromServiceResult(res);
}
