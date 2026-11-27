"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import { guardarDescuentoMargenContribucion } from "@/services/margenContribucionDesc.service";
import {
  guardarDescuentoMargenContribucionSchema,
  type GuardarDescuentoMargenContribucionInput,
} from "@/lib/validations/margenContribucionDesc";
import {
  listarFinAnaMcCategorias,
  reemplazarFinAnaMcCategorias,
} from "@/services/finAnaMcCategorias.service";
import { reemplazarFinAnaMcCategoriasSchema } from "@/lib/validations/finAnaMcCategorias";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import { APP_ROUTES } from "@/lib/appRoutes";

const RUTA_MARGEN_CONTRIBUCION = APP_ROUTES.administrador.cobrosDesc.margenContribucion;

/** Cualquier usuario con acceso a la pantalla puede guardar el DESC. de una columna. */
export async function guardarDescuentoMargenContribucionAction(
  params: unknown
): Promise<ActionResult<GuardarDescuentoMargenContribucionInput>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const parsed = guardarDescuentoMargenContribucionSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await guardarDescuentoMargenContribucion(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  return { ok: true, data: res.data };
}

export async function listarFinAnaMcCategoriasAction(): Promise<
  ActionResult<FinAnaMcCategoriaItem[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const items = await listarFinAnaMcCategorias();
  return { ok: true, data: items };
}

export async function reemplazarFinAnaMcCategoriasAction(
  params: unknown
): Promise<ActionResult<FinAnaMcCategoriaItem[]>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = reemplazarFinAnaMcCategoriasSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await reemplazarFinAnaMcCategorias(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidatePath(RUTA_MARGEN_CONTRIBUCION);
  return { ok: true, data: res.data };
}
