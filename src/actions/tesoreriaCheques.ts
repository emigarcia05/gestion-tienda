"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { getIdPersonalSesion } from "@/lib/sesion";
import type { ActionResult } from "@/lib/types";
import {
  chequesCajaSchema,
  depositarChequesSchema,
  pagarProveedorConChequesSchema,
} from "@/lib/validations/tesoreriaCheques";
import {
  depositarCheques,
  obtenerDatosChequesCaja,
  pagarProveedorConCheques,
  type DatosChequesCaja,
} from "@/services/tesoreriaCheques.service";

function revalidateCheques(): void {
  revalidatePath("/finanzas/tesoreria/cajas");
  revalidatePath("/finanzas/tesoreria/movimientos");
  revalidatePath("/finanzas/tesoreria/flujo-de-fondos");
  revalidatePath("/finanzas/operaciones/comp-compras");
}

/** Cheques en cartera de la caja + destinos de depósito + proveedores con saldo. */
export async function obtenerDatosChequesCajaAction(
  raw: unknown
): Promise<ActionResult<DatosChequesCaja>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = chequesCajaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    return fromServiceResult(await obtenerDatosChequesCaja(parsed.data.cajaId));
  } catch (e) {
    console.error("[obtenerDatosChequesCajaAction]", e);
    return { ok: false, error: "No se pudieron cargar los cheques." };
  }
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
