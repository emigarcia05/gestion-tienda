"use server";

import { revalidatePath } from "next/cache";
import { requireEditorTienda, requireTiendaLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import { GP_ROUTES, REVALIDATE_LISTA_PRODUCTOS } from "@/lib/gestionProductosRoutes";
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
  getPxVentaItemModalSchema,
  guardarPxVentaDesdeItemSchema,
} from "@/lib/validations/pxListasPrecios";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import type { ItemPxListasPreciosTabla, ListaPrecioPxListasColumna } from "@/lib/pxListasPrecios";
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
import type {
  ComponenteCandidatoItem,
  ComposicionProductoTienda,
} from "@/lib/productoCompuesto";
import { listaPreciosCodTiendaSchema } from "@/lib/validations/common";
import {
  buscarComponentesCandidatosSchema,
  guardarComponentesCompuestoSchema,
  setProductoCompuestoSchema,
} from "@/lib/validations/productoCompuesto";
import {
  buscarComponentesCandidatos,
  getComposicionProductoTienda,
  guardarComponentesCompuesto,
  setProductoCompuestoTienda,
} from "@/services/productoCompuesto.service";
import { guardarCambiosPxListasLote } from "@/services/pxListasCambiosLote.service";
import { guardarCompetenciaRefPxListaGeneral } from "@/services/pxListasCompetenciaRef.service";
import { getPxVentaItemParaModal } from "@/services/pxListasPreciosPage.service";

function revalidateListaProductos(): void {
  for (const path of REVALIDATE_LISTA_PRODUCTOS) revalidatePath(path);
  revalidatePath(GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas);
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
): Promise<ActionResult<{ codTienda: string; deshabilitadoPor: string[] | null }>> {
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

// --- Producto compuesto (`prod_lista_compuestos`) ---

export async function getComposicionProductoTiendaAction(
  raw: unknown
): Promise<ActionResult<ComposicionProductoTienda>> {
  const gate = await requireTiendaLectura();
  if (gate) return gate;
  const parsed = listaPreciosCodTiendaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  return fromServiceResult(await getComposicionProductoTienda(parsed.data));
}

export async function setProductoCompuestoTiendaAction(
  raw: unknown
): Promise<ActionResult<{ esProductoCompuesto: boolean }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = setProductoCompuestoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(
    await setProductoCompuestoTienda(parsed.data.codTienda, parsed.data.esProductoCompuesto)
  );
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function guardarComponentesCompuestoAction(
  raw: unknown
): Promise<ActionResult<{ componentes: number }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = guardarComponentesCompuestoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const out = fromServiceResult(await guardarComponentesCompuesto(parsed.data));
  if (out.ok) revalidateListaProductos();
  return out;
}

export async function buscarComponentesCandidatosAction(
  raw: unknown
): Promise<ActionResult<ComponenteCandidatoItem[]>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = buscarComponentesCandidatosSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  return fromServiceResult(await buscarComponentesCandidatos(parsed.data.codTienda, parsed.data.q));
}

export async function getPxVentaItemModalAction(
  codTienda: string | null
): Promise<
  ActionResult<{
    listas: ListaPrecioPxListasColumna[];
    idListaGeneral: number | null;
    categoriasMc: FinAnaMcCategoriaItem[];
    item: ItemPxListasPreciosTabla;
  }>
> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = getPxVentaItemModalSchema.safeParse({ codTienda });
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    return { ok: true, data: await getPxVentaItemParaModal(parsed.data.codTienda) };
  } catch (e) {
    console.error("[getPxVentaItemModalAction]", e);
    return { ok: false, error: "No se pudo cargar PX VENTA." };
  }
}

export async function guardarPxVentaDesdeItemAction(
  raw: unknown
): Promise<ActionResult<{ guardados: number }>> {
  const gate = await requireEditorTienda();
  if (gate) return gate;
  const parsed = guardarPxVentaDesdeItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const errores: string[] = [];
  let guardados = 0;
  if (parsed.data.cambios.length > 0) {
    const resultados = await guardarCambiosPxListasLote(parsed.data.cambios);
    for (const resultado of resultados) {
      if (resultado.ok) guardados += 1;
      else errores.push(resultado.error);
    }
  }
  if (parsed.data.actualizarCompetencia && errores.length === 0) {
    const ref = await guardarCompetenciaRefPxListaGeneral(
      parsed.data.codTienda,
      parsed.data.competenciaId
    );
    if (!ref.success) errores.push(ref.error);
    else guardados += 1;
  }
  if (errores.length > 0) {
    return { ok: false, error: [...new Set(errores)].join(" · ") };
  }
  revalidateListaProductos();
  return { ok: true, data: { guardados } };
}
