"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import type {
  AsistenteIaConfigSubmodulo,
  AsistenteIaModuloVariable,
  ProdIaDisenoPrompItem,
} from "@/lib/asistenteIa";
import { requireAsistenteIaLectura, requireEditorAsistenteIa } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import {
  crearProdIaDisenoPrompSchema,
  editarProdIaDisenoPrompSchema,
  eliminarProdIaDisenoPrompSchema,
} from "@/lib/validations/prodIaDisenoPromp";
import {
  crearProdIaDisenoPromp,
  editarProdIaDisenoPromp,
  eliminarProdIaDisenoPromp,
  listarProdIaDisenoPromps,
  resolverConfigAsistenteIa,
} from "@/services/prodIaDisenoPromp.service";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}

function revalidateAsistenteIa(): void {
  revalidatePath(GP_ROUTES.asistenteIa.buscarColorImagen);
}

const resolverConfigSchema = z.object({
  slot: z.enum(["buscar_codigo", "disenar_colores"]),
});



export async function listarProdIaDisenoPrompsAction(): Promise<
  ActionResult<ProdIaDisenoPrompItem[]>
> {
  const gate = await requireAsistenteIaLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarProdIaDisenoPromps() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron listar los prompts.",
    };
  }
}

/** Config actual del slot (BD). Usar al generar/copiar para no depender de props stale. */
export async function resolverConfigAsistenteIaAction(
  raw: unknown,
): Promise<ActionResult<AsistenteIaConfigSubmodulo>> {
  const gate = await requireAsistenteIaLectura();
  if (gate) return gate;
  const parsed = resolverConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  try {
    const slot = parsed.data.slot as AsistenteIaModuloVariable;
    return { ok: true, data: await resolverConfigAsistenteIa(slot) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cargar la configuración.",
    };
  }
}

export async function crearProdIaDisenoPrompAction(
  raw: unknown,
): Promise<ActionResult<ProdIaDisenoPrompItem>> {
  const gate = await requireEditorAsistenteIa();
  if (gate) return gate;
  const parsed = crearProdIaDisenoPrompSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await crearProdIaDisenoPromp(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateAsistenteIa();
  return { ok: true, data: res.data };
}

export async function editarProdIaDisenoPrompAction(
  raw: unknown,
): Promise<ActionResult<ProdIaDisenoPrompItem>> {
  const gate = await requireEditorAsistenteIa();
  if (gate) return gate;
  const parsed = editarProdIaDisenoPrompSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await editarProdIaDisenoPromp(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateAsistenteIa();
  return { ok: true, data: res.data };
}

export async function eliminarProdIaDisenoPrompAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorAsistenteIa();
  if (gate) return gate;
  const parsed = eliminarProdIaDisenoPrompSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await eliminarProdIaDisenoPromp(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };
  revalidateAsistenteIa();
  return { ok: true, data: res.data };
}
