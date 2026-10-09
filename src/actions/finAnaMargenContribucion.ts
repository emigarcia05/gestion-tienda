"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import {
  actualizarDescuentoFpMargenContribucion,
} from "@/services/finAnaMcDescuentoFp.service";
import { actualizarDescuentoFpMargenContribucionSchema } from "@/lib/validations/finAnaMcDescuentoFp";
import type { DescuentoFpMargenContribucionMap } from "@/services/finAnaMcDescuentoFp.service";
import {
  listarFinAnaMcCategorias,
  reemplazarFinAnaMcCategorias,
} from "@/services/finAnaMcCategorias.service";
import { reemplazarFinAnaMcCategoriasSchema } from "@/lib/validations/finAnaMcCategorias";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import {
  getFinAnaMcConfig,
  guardarFinAnaMcConfig,
} from "@/services/finAnaMcConfig.service";
import { guardarFinAnaMcConfigSchema } from "@/lib/validations/finAnaMcConfig";
import type { FinAnaMcConfigItem } from "@/lib/finAnaMcConfig";

const RUTA_MARGEN_CONTRIBUCION = "/administrador/productos/margen-contribucion";



export async function actualizarDescuentoFpMargenContribucionAction(
  params: unknown
): Promise<ActionResult<DescuentoFpMargenContribucionMap>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = actualizarDescuentoFpMargenContribucionSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await actualizarDescuentoFpMargenContribucion(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidatePath(RUTA_MARGEN_CONTRIBUCION);
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

export async function getFinAnaMcConfigAction(): Promise<
  ActionResult<FinAnaMcConfigItem>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  const data = await getFinAnaMcConfig();
  return { ok: true, data };
}

export async function guardarFinAnaMcConfigAction(
  params: unknown
): Promise<ActionResult<FinAnaMcConfigItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = guardarFinAnaMcConfigSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await guardarFinAnaMcConfig(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidatePath(RUTA_MARGEN_CONTRIBUCION);
  return { ok: true, data: res.data };
}
