"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas } from "@/lib/actionGates";
import { APP_ROUTES } from "@/lib/appRoutes";
import type { ActionResult } from "@/lib/types";
import { crearAjusteBalIibbSchema, eliminarAjusteBalIibbSchema } from "@/lib/validations/balIibb";
import { crearAjusteBalIibb, eliminarAjusteBalIibb } from "@/services/balIibb.service";

export async function crearAjusteBalIibbAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = crearAjusteBalIibbSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const res = await crearAjusteBalIibb(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidatePath(APP_ROUTES.finanzas.balance.balanceIibb);
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearAjusteBalIibbAction]", e);
    return { ok: false, error: "No se pudo registrar el ajuste." };
  }
}

export async function eliminarAjusteBalIibbAction(raw: unknown): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = eliminarAjusteBalIibbSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID inválido." };
  try {
    const res = await eliminarAjusteBalIibb(parsed.data.id);
    if (!res.success) return { ok: false, error: res.error };
    revalidatePath(APP_ROUTES.finanzas.balance.balanceIibb);
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[eliminarAjusteBalIibbAction]", e);
    return { ok: false, error: "No se pudo borrar el ajuste." };
  }
}
