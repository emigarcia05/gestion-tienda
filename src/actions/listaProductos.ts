"use server";

import { revalidatePath } from "next/cache";
import { requireEditorTienda, requireTiendaLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import { REVALIDATE_LISTA_PRODUCTOS } from "@/lib/gestionProductosRoutes";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";
import type { ActionResult } from "@/lib/types";
import {
  crearMarcaSchema,
  crearProductoTiendaSchema,
  crearRubroSchema,
  editarMarcaSchema,
  editarRubroSchema,
  idCatalogoInputSchema,
} from "@/lib/validations/listaProductos";
import {
  crearMarca,
  crearProductoTienda,
  crearRubro,
  editarMarca,
  editarRubro,
  eliminarMarca,
  eliminarRubro,
  listarMarcasCatalogo,
  listarRubrosCatalogo,
} from "@/services/listaProductos.service";

function revalidateListaProductos(): void {
  for (const path of REVALIDATE_LISTA_PRODUCTOS) revalidatePath(path);
}

export async function crearProductoTiendaAction(
  raw: unknown
): Promise<ActionResult<{ codTienda: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = crearProductoTiendaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await crearProductoTienda(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

// --- Marcas ---

export async function listarMarcasCatalogoAction(): Promise<ActionResult<MarcaCatalogoItem[]>> {
  const gate = await requireTiendaLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarMarcasCatalogo() };
  } catch (e) {
    console.error("[listarMarcasCatalogoAction]", e);
    return { ok: false, error: "No se pudieron listar las marcas." };
  }
}

export async function crearMarcaAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = crearMarcaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await crearMarca(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function editarMarcaAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = editarMarcaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await editarMarca(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function eliminarMarcaAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = idCatalogoInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await eliminarMarca(parsed.data.id));
  if (out.ok) revalidateListaProductos();
  return out;
}

// --- Rubros ---

export async function listarRubrosCatalogoAction(): Promise<ActionResult<RubroCatalogoItem[]>> {
  const gate = await requireTiendaLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarRubrosCatalogo() };
  } catch (e) {
    console.error("[listarRubrosCatalogoAction]", e);
    return { ok: false, error: "No se pudieron listar los rubros." };
  }
}

export async function crearRubroAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = crearRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await crearRubro(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function editarRubroAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = editarRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await editarRubro(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function eliminarRubroAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = idCatalogoInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await eliminarRubro(parsed.data.id));
  if (out.ok) revalidateListaProductos();
  return out;
}
