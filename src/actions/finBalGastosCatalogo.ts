"use server";

import { revalidatePath } from "next/cache";
import { revalidatePedidoUrgenteTrasCambioIvaSaldo } from "@/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo";
import { requireEditorFinanzas } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import {
  crearFinBalGastoFinalSchema,
  crearFinBalGastoRubroSchema,
  crearFinBalGastoSchema,
  crearFinBalGastoTipoSchema,
  editarFinBalGastoFinalSchema,
  editarFinBalGastoRubroSchema,
  editarFinBalGastoSchema,
  editarFinBalGastoTipoSchema,
  eliminarFinBalGastoFinalSchema,
  eliminarFinBalGastoRubroSchema,
  eliminarFinBalGastoSchema,
  eliminarFinBalGastoTipoSchema,
} from "@/lib/validations/finBalGastosCatalogo";
import {
  crearFinBalGasto,
  crearFinBalGastoFinal,
  crearFinBalGastoRubro,
  crearFinBalGastoTipo,
  editarFinBalGasto,
  editarFinBalGastoFinal,
  editarFinBalGastoRubro,
  editarFinBalGastoTipo,
  eliminarFinBalGasto,
  eliminarFinBalGastoFinal,
  eliminarFinBalGastoRubro,
  eliminarFinBalGastoTipo,
  type FinBalGastoFinalItem,
  type FinBalGastoItem,
  type FinBalGastoRubroItem,
  type FinBalGastoTipoItem,
} from "@/services/finBalGastosCatalogo.service";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}

function revalidateBalancePaths(): void {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/balance/gastos");
  revalidatePath("/finanzas/balance/catalogo-gastos");
  revalidatePedidoUrgenteTrasCambioIvaSaldo();
}

// ─── Tipo (raíz) ──────────────────────────────────────────────────────────

export async function crearFinBalGastoTipoAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoTipoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinBalGastoTipoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await crearFinBalGastoTipo(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function editarFinBalGastoTipoAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoTipoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinBalGastoTipoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await editarFinBalGastoTipo(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function eliminarFinBalGastoTipoAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinBalGastoTipoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await eliminarFinBalGastoTipo(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

// ─── Rubro (intermedio) ───────────────────────────────────────────────────

export async function crearFinBalGastoRubroAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoRubroItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinBalGastoRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await crearFinBalGastoRubro(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function editarFinBalGastoRubroAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoRubroItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinBalGastoRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await editarFinBalGastoRubro(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function eliminarFinBalGastoRubroAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinBalGastoRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await eliminarFinBalGastoRubro(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

// ─── Gasto (hoja) ─────────────────────────────────────────────────────────

export async function crearFinBalGastoAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinBalGastoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await crearFinBalGasto(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function editarFinBalGastoAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinBalGastoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await editarFinBalGasto(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function eliminarFinBalGastoAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinBalGastoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await eliminarFinBalGasto(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

// ─── Gasto final (`fin_bal_gasto_final`) ───────────────────────────────────

export async function crearFinBalGastoFinalAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoFinalItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinBalGastoFinalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await crearFinBalGastoFinal(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function editarFinBalGastoFinalAction(
  raw: unknown
): Promise<ActionResult<FinBalGastoFinalItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinBalGastoFinalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await editarFinBalGastoFinal(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}

export async function eliminarFinBalGastoFinalAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinBalGastoFinalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const res = await eliminarFinBalGastoFinal(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateBalancePaths();
  return { ok: true, data: res.data };
}
