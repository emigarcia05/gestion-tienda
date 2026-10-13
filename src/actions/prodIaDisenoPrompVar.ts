"use server";

import { revalidatePath } from "next/cache";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import type { ProdIaDisenoPrompVarItem } from "@/lib/asistenteIa";
import { requireAsistenteIaLectura, requireEditorAsistenteIa } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import {
  guardarProdIaDisenoPrompVarsSchema,
  listarProdIaDisenoPrompVarsSchema,
} from "@/lib/validations/prodIaDisenoPrompVar";
import {
  guardarProdIaDisenoPrompVars,
  listarProdIaDisenoPrompVars,
} from "@/services/prodIaDisenoPrompVar.service";

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



export async function listarProdIaDisenoPrompVarsAction(
  raw: unknown,
): Promise<ActionResult<ProdIaDisenoPrompVarItem[]>> {
  const gate = await requireAsistenteIaLectura();
  if (gate) return gate;
  const parsed = listarProdIaDisenoPrompVarsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  try {
    return {
      ok: true,
      data: await listarProdIaDisenoPrompVars(parsed.data.prompId),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron listar las variables.",
    };
  }
}

export async function guardarProdIaDisenoPrompVarsAction(
  raw: unknown,
): Promise<ActionResult<ProdIaDisenoPrompVarItem[]>> {
  const gate = await requireEditorAsistenteIa();
  if (gate) return gate;
  const parsed = guardarProdIaDisenoPrompVarsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await guardarProdIaDisenoPrompVars(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidateAsistenteIa();
  return { ok: true, data: res.data };
}
