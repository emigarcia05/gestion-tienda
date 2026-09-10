"use server";

import { revalidatePath } from "next/cache";
import type { EstPorProdColorItem } from "@/lib/estPorProdColores";
import { requireEditorEstadisticas, requireEstadisticasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import {
  crearEstPorProdColorSchema,
  editarEstPorProdColorSchema,
  eliminarEstPorProdColorSchema,
} from "@/lib/validations/estPorProdColores";
import {
  crearEstPorProdColor,
  editarEstPorProdColor,
  eliminarEstPorProdColor,
  listarEstPorProdColores,
} from "@/services/estPorProdColores.service";

function revalidateEstColores(): void {
  revalidatePath("/estadisticas-productos");
  revalidatePath("/estadisticas-productos/ventas-por-producto");
  revalidatePath("/estadisticas-productos/categorizacion");
}

export async function listarEstPorProdColoresAction(): Promise<
  ActionResult<EstPorProdColorItem[]>
> {
  const gate = await requireEstadisticasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarEstPorProdColores() };
  } catch (e) {
    console.error("[listarEstPorProdColoresAction]", e);
    return { ok: false, error: "No se pudieron listar los colores." };
  }
}

export async function crearEstPorProdColorAction(
  raw: unknown
): Promise<ActionResult<EstPorProdColorItem>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = crearEstPorProdColorSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const out = fromServiceResult(await crearEstPorProdColor(parsed.data));
  if (!out.ok) return out;
  revalidateEstColores();
  return out;
}

export async function editarEstPorProdColorAction(
  raw: unknown
): Promise<ActionResult<EstPorProdColorItem>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = editarEstPorProdColorSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const out = fromServiceResult(await editarEstPorProdColor(parsed.data));
  if (!out.ok) return out;
  revalidateEstColores();
  return out;
}

export async function eliminarEstPorProdColorAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorEstadisticas();
  if (gate) return gate;
  const parsed = eliminarEstPorProdColorSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const out = fromServiceResult(await eliminarEstPorProdColor(parsed.data.id));
  if (!out.ok) return out;
  revalidateEstColores();
  return out;
}
