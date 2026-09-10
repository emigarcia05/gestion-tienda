"use server";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

import { revalidatePath } from "next/cache";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import {
  guardarPxListaCompetenciaRefSchema,
  guardarPxListaMargenEdicionSchema,
  guardarPxListaPrecioEdicionSchema,
} from "@/lib/validations/pxListasPrecios";
import {
  guardarCompetenciaRefPxListaGeneral,
  limpiarCompetenciaRefSiListaGeneral,
} from "@/services/pxListasCompetenciaRef.service";
import {
  guardarPrecioListaEdicionDesdeMargen,
  guardarPrecioListaEdicionDesdePx,
} from "@/services/pxListasPrecioEdicion.service";
import {
  clavesDesdeGruposExportPxListas,
  listarExportPxListasMargenPorLista,
  type ExportPxListaMargenGrupo,
} from "@/services/exportPxListasMargen.service";
import { limpiarPreciosEdicionTrasActPx } from "@/services/pxListasPrecioEdicion.service";

const PX_LISTAS_PATHS = [
  GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas,
  "/tienda/px-listas",
] as const;

function revalidatePxListasPaths() {
  for (const p of PX_LISTAS_PATHS) {
    revalidatePath(p);
  }
}

/** Persiste PX staging en `prod_tienda_precios_edicion` desde margen % (o elimina con `margenManual: null`). */
export async function guardarPxListaMargenEdicionAction(
  raw: unknown
): Promise<
  ActionResult<{
    margenManual: number | null;
    pxEdicion: number | null;
    pxEfectivo: number | null;
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }

  const parsed = guardarPxListaMargenEdicionSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first =
      Object.values(msg).flat()[0] ?? "Datos de margen inválidos.";
    return { ok: false, error: first };
  }

  try {
    const { codTienda, idLista, margenManual } = parsed.data;
    const res = await guardarPrecioListaEdicionDesdeMargen(
      codTienda,
      idLista,
      margenManual
    );
    if (!res.success) {
      return { ok: false, error: res.error };
    }
    /** Edición manual de PORC. en GENERAL → quita FK de competidor. */
    await limpiarCompetenciaRefSiListaGeneral(codTienda, idLista);
    revalidatePxListasPaths();
    return {
      ok: true,
      data: {
        margenManual: res.data.margenManual,
        pxEdicion: res.data.pxEdicion,
        pxEfectivo: res.data.pxEfectivo,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el margen.",
    };
  }
}

/** Persiste PX staging en `prod_tienda_precios_edicion` desde precio entero (o elimina con `pxEdicion: null`). */
export async function guardarPxListaPrecioEdicionAction(
  raw: unknown
): Promise<
  ActionResult<{
    margenManual: number | null;
    pxEdicion: number | null;
    pxEfectivo: number | null;
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }

  const parsed = guardarPxListaPrecioEdicionSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first =
      Object.values(msg).flat()[0] ?? "Datos de precio inválidos.";
    return { ok: false, error: first };
  }

  try {
    const { codTienda, idLista, pxEdicion } = parsed.data;
    const res = await guardarPrecioListaEdicionDesdePx(
      codTienda,
      idLista,
      pxEdicion
    );
    if (!res.success) {
      return { ok: false, error: res.error };
    }
    /** Edición manual de PX en GENERAL → quita FK de competidor. */
    await limpiarCompetenciaRefSiListaGeneral(codTienda, idLista);
    revalidatePxListasPaths();
    return {
      ok: true,
      data: {
        margenManual: res.data.margenManual,
        pxEdicion: res.data.pxEdicion,
        pxEfectivo: res.data.pxEfectivo,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el precio.",
    };
  }
}

/**
 * Persiste competidor de referencia para **1 - GENERAL**.
 * `"-"` / null solo limpia FK; competidor válido copia PX a staging.
 */
export async function guardarPxListaCompetenciaRefAction(
  raw: unknown
): Promise<
  ActionResult<{
    competenciaIdPxListaGeneral: string | null;
    pxActualizado: boolean;
    pxEdicion: number | null;
    pxEfectivo: number | null;
    margenManual: number | null;
  }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }

  const parsed = guardarPxListaCompetenciaRefSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first =
      Object.values(msg).flat()[0] ?? "Datos de competidor inválidos.";
    return { ok: false, error: first };
  }

  try {
    const res = await guardarCompetenciaRefPxListaGeneral(
      parsed.data.codTienda,
      parsed.data.competenciaId
    );
    if (!res.success) {
      return { ok: false, error: res.error };
    }
    revalidatePxListasPaths();
    return { ok: true, data: res.data };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "No se pudo guardar el competidor de referencia.",
    };
  }
}

/** Excel por `nombre_lista` (CODIGO + PORC UTILIDAD) y limpieza de staging exportado. */
export async function exportarPxListasMargenAction(): Promise<
  ActionResult<{ grupos: ExportPxListaMargenGrupo[] }>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  try {
    const grupos = await listarExportPxListasMargenPorLista();
    const claves = clavesDesdeGruposExportPxListas(grupos);
    if (claves.length > 0) {
      await limpiarPreciosEdicionTrasActPx(claves);
      revalidatePxListasPaths();
    }
    return { ok: true, data: { grupos } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo generar la exportación.",
    };
  }
}
