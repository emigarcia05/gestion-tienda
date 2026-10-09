"use server";

import { revalidatePath } from "next/cache";
import type { EstPorProdUnPresentacionItem } from "@/lib/estPorProdUnPresentacion";
import { ESTADISTICAS_PRODUCTOS_ROUTES } from "@/lib/estadisticasProductosRoutes";
import { requireEditorEstadisticas, requireEstadisticasLectura } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import {
  crearEstPorProdUnPresentacionSchema,
  editarEstPorProdUnPresentacionSchema,
  eliminarEstPorProdUnPresentacionSchema,
} from "@/lib/validations/estPorProdUnPresentacion";
import {
  crearEstPorProdUnPresentacion,
  editarEstPorProdUnPresentacion,
  eliminarEstPorProdUnPresentacion,
  listarEstPorProdUnPresentaciones,
} from "@/services/estPorProdUnPresentacion.service";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}



function revalidateCategorizacion() {
  revalidatePath("/administrador/estadisticas");
  revalidatePath(ESTADISTICAS_PRODUCTOS_ROUTES.categorizacion);
}

export async function listarEstPorProdUnPresentacionesAction(): Promise<
  ActionResult<EstPorProdUnPresentacionItem[]>
> {
  const gate = await requireEstadisticasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarEstPorProdUnPresentaciones() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron listar las unidades.",
    };
  }
}

export async function crearEstPorProdUnPresentacionAction(
  raw: unknown
): Promise<ActionResult<EstPorProdUnPresentacionItem>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = crearEstPorProdUnPresentacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await crearEstPorProdUnPresentacion(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateCategorizacion();
  return { ok: true, data: res.data };
}

export async function editarEstPorProdUnPresentacionAction(
  raw: unknown
): Promise<ActionResult<EstPorProdUnPresentacionItem>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = editarEstPorProdUnPresentacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await editarEstPorProdUnPresentacion(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateCategorizacion();
  return { ok: true, data: res.data };
}

export async function eliminarEstPorProdUnPresentacionAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = eliminarEstPorProdUnPresentacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await eliminarEstPorProdUnPresentacion(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };
  revalidateCategorizacion();
  return { ok: true, data: res.data };
}
