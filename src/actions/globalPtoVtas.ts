"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import type { GlobalPtoVtaItem } from "@/lib/globalPtoVtas";
import type { ActionResult } from "@/lib/types";
import {
  crearGlobalPtoVtaSchema,
  editarGlobalPtoVtaSchema,
  eliminarGlobalPtoVtaSchema,
} from "@/lib/validations/globalPtoVtas";
import { VTAS_COBROS_LEGACY_FACT_COBROS_PATH, VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";
import {
  crearGlobalPtoVta,
  editarGlobalPtoVta,
  eliminarGlobalPtoVta,
  listarGlobalPtoVtas,
} from "@/services/globalPtoVtas.service";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}

function revalidateFactCobros(): void {
  revalidatePath(VTAS_COBROS_ROUTES.ptosVenta);
  revalidatePath(VTAS_COBROS_LEGACY_FACT_COBROS_PATH);
}

export async function listarGlobalPtoVtasAction(): Promise<ActionResult<GlobalPtoVtaItem[]>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarGlobalPtoVtas() };
  } catch (e) {
    console.error("[globalPtoVtas][listar]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron listar los puntos de venta.",
    };
  }
}

export async function crearGlobalPtoVtaAction(
  raw: unknown
): Promise<ActionResult<GlobalPtoVtaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = crearGlobalPtoVtaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await crearGlobalPtoVta(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateFactCobros();
  return { ok: true, data: res.data };
}

export async function editarGlobalPtoVtaAction(
  raw: unknown
): Promise<ActionResult<GlobalPtoVtaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = editarGlobalPtoVtaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await editarGlobalPtoVta(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateFactCobros();
  return { ok: true, data: res.data };
}

export async function eliminarGlobalPtoVtaAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = eliminarGlobalPtoVtaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await eliminarGlobalPtoVta(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };
  revalidateFactCobros();
  return { ok: true, data: res.data };
}
