"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { REVALIDATE_LISTA_PRECIOS } from "@/lib/gestionProductosRoutes";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import { getProveedorById } from "@/services/proveedor.service";
import { listarPreciosRexParaVincular, vincularListaPrecioConPrecioRex } from "@/services/prodPreciosRex.service";
import type { PrecioRexParaVincular } from "@/services/prodPreciosRex.service";
import {
  aplicarImportListaPdf,
  previsualizarImportListaPdf,
} from "@/services/importListaPdf.service";
import type { PreviewImportListaPdf, ResultadoImportListaPdf } from "@/lib/importListaPdf";
import {
  aplicarImportListaPdfSchema,
  listarPreciosRexParaVincularSchema,
  previsualizarImportListaPdfSchema,
  vincularListaPrecioConPrecioRexSchema,
} from "@/lib/validations/prodPreciosRex";

async function requireImportarListaEditor(): Promise<ActionResult<never> | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.listaPrecios.acciones.importarLista)) {
    return { ok: false, error: "Sin permisos para importar lista de precios." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }
  return null;
}

/** Importar Lista PDF · paso 1 (sin escrituras): empareja ítems del PDF con la lista del proveedor. */
export async function previsualizarImportListaPdfAction(
  raw: unknown
): Promise<ActionResult<PreviewImportListaPdf>> {
  const gate = await requireImportarListaEditor();
  if (gate) return gate;
  const parsed = previsualizarImportListaPdfSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  if (!(await getProveedorById(parsed.data.proveedorId))) {
    return { ok: false, error: "Proveedor no encontrado." };
  }
  return fromServiceResult(
    await previsualizarImportListaPdf(parsed.data.proveedorId, parsed.data.filas)
  );
}

/** Importar Lista PDF · paso 2: actualiza `px_lista_proveedor` de los ítems confirmados. */
export async function aplicarImportListaPdfAction(
  raw: unknown
): Promise<ActionResult<ResultadoImportListaPdf>> {
  const gate = await requireImportarListaEditor();
  if (gate) return gate;
  const parsed = aplicarImportListaPdfSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  const { proveedorId, filas, vinculos } = parsed.data;
  if (!(await getProveedorById(proveedorId))) {
    return { ok: false, error: "Proveedor no encontrado." };
  }
  const out = fromServiceResult(await aplicarImportListaPdf(proveedorId, filas, vinculos));
  if (out.ok) {
    for (const path of REVALIDATE_LISTA_PRECIOS) revalidatePath(path);
  }
  return out;
}

export async function listarPreciosRexParaVincularAction(
  raw: unknown
): Promise<ActionResult<PrecioRexParaVincular[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.listaPrecios.acciones.edicionMasiva)) {
    return { ok: false, error: "Sin permisos para vincular precios REX." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = listarPreciosRexParaVincularSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Parámetros inválidos para listar precios REX." };
  }

  try {
    const rows = await listarPreciosRexParaVincular(
      parsed.data.proveedorId,
      parsed.data.codExtLista,
      parsed.data.q
    );
    return { ok: true, data: rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al listar precios REX.";
    return { ok: false, error: message };
  }
}

export async function vincularListaPrecioConPrecioRexAction(
  raw: unknown
): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.listaPrecios.acciones.edicionMasiva)) {
    return { ok: false, error: "Sin permisos para vincular precios REX." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = vincularListaPrecioConPrecioRexSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos para vincular." };
  }

  try {
    const result = await vincularListaPrecioConPrecioRex(
      parsed.data.codExtLista,
      parsed.data.idPrecioRex
    );
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    for (const path of REVALIDATE_LISTA_PRECIOS) {
      revalidatePath(path);
    }
    return { ok: true, data: undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al vincular precio REX.";
    return { ok: false, error: message };
  }
}
