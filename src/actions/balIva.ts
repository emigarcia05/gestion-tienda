"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas } from "@/lib/actionGates";
import { APP_ROUTES } from "@/lib/appRoutes";
import { revalidatePedidoUrgenteTrasCambioIvaSaldo } from "@/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo";
import type { ActionResult } from "@/lib/types";
import { crearAjusteBalIvaSchema, eliminarAjusteBalIvaSchema } from "@/lib/validations/balIva";
import { crearAjusteBalIva, eliminarAjusteBalIva } from "@/services/balIva.service";

function revalidarSaldoIva(): void {
  revalidatePath(APP_ROUTES.finanzas.balance.balanceIva);
  revalidatePedidoUrgenteTrasCambioIvaSaldo();
}

export async function crearAjusteBalIvaAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = crearAjusteBalIvaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const res = await crearAjusteBalIva(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidarSaldoIva();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearAjusteBalIvaAction]", e);
    return { ok: false, error: "No se pudo registrar el ajuste." };
  }
}

export async function eliminarAjusteBalIvaAction(raw: unknown): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = eliminarAjusteBalIvaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID inválido." };
  try {
    const res = await eliminarAjusteBalIva(parsed.data.id);
    if (!res.success) return { ok: false, error: res.error };
    revalidarSaldoIva();
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[eliminarAjusteBalIvaAction]", e);
    return { ok: false, error: "No se pudo borrar el ajuste." };
  }
}
