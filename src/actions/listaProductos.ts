"use server";

import { revalidatePath } from "next/cache";
import { requireEditorTienda, requireTiendaLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import { REVALIDATE_LISTA_PRODUCTOS } from "@/lib/gestionProductosRoutes";
import type {
  MarcaCatalogoItem,
  OpcionCatalogoItem,
  RubroCatalogoItem,
} from "@/lib/listaProductos";
import type { ActionResult } from "@/lib/types";
import {
  crearMarcaSchema,
  crearProductosTiendaLoteSchema,
  crearRubroSchema,
  crearSubRubroSchema,
  editarMarcaSchema,
  editarProductoTiendaSchema,
  editarRubroSchema,
  editarSubRubroSchema,
  eliminarProductoTiendaSchema,
  idCatalogoInputSchema,
} from "@/lib/validations/listaProductos";
import {
  crearMarca,
  crearProductosTiendaLote,
  crearRubro,
  crearSubRubro,
  editarMarca,
  editarProductoTienda,
  editarRubro,
  editarSubRubro,
  eliminarMarca,
  eliminarProductoTienda,
  eliminarRubro,
  eliminarSubRubro,
  listarColoresOpciones,
  listarMarcasCatalogo,
  listarPresentacionesOpciones,
  listarRubrosCatalogo,
} from "@/services/listaProductos.service";

function revalidateListaProductos(): void {
  for (const path of REVALIDATE_LISTA_PRODUCTOS) revalidatePath(path);
}

export async function crearProductosTiendaLoteAction(
  raw: unknown
): Promise<ActionResult<{ codTiendas: string[] }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = crearProductosTiendaLoteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await crearProductosTiendaLote(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function editarProductoTiendaAction(
  raw: unknown
): Promise<ActionResult<{ codTienda: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = editarProductoTiendaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await editarProductoTienda(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function eliminarProductoTiendaAction(
  raw: unknown
): Promise<ActionResult<{ codTienda: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = eliminarProductoTiendaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await eliminarProductoTienda(parsed.data.codTienda));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function listarPresentacionesOpcionesAction(): Promise<
  ActionResult<OpcionCatalogoItem[]>
> {
  const gate = await requireTiendaLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarPresentacionesOpciones() };
  } catch (e) {
    console.error("[listarPresentacionesOpcionesAction]", e);
    return { ok: false, error: "No se pudieron listar las presentaciones." };
  }
}

export async function listarColoresOpcionesAction(): Promise<ActionResult<OpcionCatalogoItem[]>> {
  const gate = await requireTiendaLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarColoresOpciones() };
  } catch (e) {
    console.error("[listarColoresOpcionesAction]", e);
    return { ok: false, error: "No se pudieron listar los colores." };
  }
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

// --- Sub-rubros (se listan anidados en `listarRubrosCatalogoAction`) ---

export async function crearSubRubroAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = crearSubRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await crearSubRubro(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function editarSubRubroAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = editarSubRubroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await editarSubRubro(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function eliminarSubRubroAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = idCatalogoInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await eliminarSubRubro(parsed.data.id));
  if (out.ok) revalidateListaProductos();
  return out;
}
