"use server";

import { revalidatePath } from "next/cache";
import type { EstPorProdTerminacionItem } from "@/lib/estPorProdTerminacion";
import { ESTADISTICAS_PRODUCTOS_ROUTES } from "@/lib/estadisticasProductosRoutes";
import { requireEditorEstadisticas, requireEstadisticasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import {
  crearEstPorProdTerminacionSchema,
  editarEstPorProdTerminacionSchema,
  eliminarEstPorProdTerminacionSchema,
} from "@/lib/validations/estPorProdTerminacion";
import {
  crearEstPorProdTerminacion,
  editarEstPorProdTerminacion,
  eliminarEstPorProdTerminacion,
  listarEstPorProdTerminaciones,
} from "@/services/estPorProdTerminacion.service";

function revalidateCategorizacion() {
  revalidatePath("/estadisticas-productos");
  revalidatePath(ESTADISTICAS_PRODUCTOS_ROUTES.categorizacion);
}

export async function listarEstPorProdTerminacionesAction(): Promise<
  ActionResult<EstPorProdTerminacionItem[]>
> {
  const gate = await requireEstadisticasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarEstPorProdTerminaciones() };
  } catch (e) {
    console.error("[listarEstPorProdTerminacionesAction]", e);
    return { ok: false, error: "No se pudieron listar las terminaciones." };
  }
}

export async function crearEstPorProdTerminacionAction(
  raw: unknown
): Promise<ActionResult<EstPorProdTerminacionItem>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = crearEstPorProdTerminacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const out = fromServiceResult(await crearEstPorProdTerminacion(parsed.data));
  if (!out.ok) return out;
  revalidateCategorizacion();
  return out;
}

export async function editarEstPorProdTerminacionAction(
  raw: unknown
): Promise<ActionResult<EstPorProdTerminacionItem>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = editarEstPorProdTerminacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const out = fromServiceResult(await editarEstPorProdTerminacion(parsed.data));
  if (!out.ok) return out;
  revalidateCategorizacion();
  return out;
}

export async function eliminarEstPorProdTerminacionAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = eliminarEstPorProdTerminacionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const out = fromServiceResult(await eliminarEstPorProdTerminacion(parsed.data.id));
  if (!out.ok) return out;
  revalidateCategorizacion();
  return out;
}
