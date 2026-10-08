"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { getIdPersonalSesion } from "@/lib/sesion";
import type { ActionResult } from "@/lib/types";
import {
  depositarChequesSchema,
  pagarProveedorConChequesSchema,
} from "@/lib/validations/tesoreriaCheques";
import {
  depositarCheques,
  pagarProveedorConCheques,
} from "@/services/tesoreriaCheques.service";

function revalidateCheques(): void {
  revalidatePath("/finanzas/tesoreria");
  revalidatePath("/finanzas/tesoreria/cheques");
  revalidatePath("/finanzas/tesoreria/movimientos");
  revalidatePath("/finanzas/venc-por-fecha");
  revalidatePath("/finanzas/control-comprobantes");
}

export async function depositarChequesAction(
  raw: unknown
): Promise<ActionResult<{ cantidad: number }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const personalId = await getIdPersonalSesion();
  if (personalId == null) return { ok: false, error: "Ingresá con tu usuario." };
  const parsed = depositarChequesSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await depositarCheques({ ...parsed.data, personalId });
  if (res.success) revalidateCheques();
  return fromServiceResult(res);
}

export async function pagarProveedorConChequesAction(
  raw: unknown
): Promise<ActionResult<{ cantidad: number }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const personalId = await getIdPersonalSesion();
  if (personalId == null) return { ok: false, error: "Ingresá con tu usuario." };
  const parsed = pagarProveedorConChequesSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await pagarProveedorConCheques({ ...parsed.data, personalId });
  if (res.success) revalidateCheques();
  return fromServiceResult(res);
}
