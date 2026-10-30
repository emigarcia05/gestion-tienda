"use server";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

import { revalidatePath } from "next/cache";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import {
  guardarPxListaCompetenciaRefSchema,
  guardarPxListasCambiosSchema,
} from "@/lib/validations/pxListasPrecios";
import { guardarCompetenciaRefPxListaGeneral } from "@/services/pxListasCompetenciaRef.service";
import {
  guardarCambiosPxListasLote,
  type ResultadoCambioPxListas,
} from "@/services/pxListasCambiosLote.service";
function revalidatePxListasPaths() {
  revalidatePath(GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas);
}

/**
 * **Guardar Cambios** de Px Listas: persiste en `prod_listas_precios_edicion` todos los cambios
 * pendientes de la pantalla (PX o PORC. UTILIDAD; `null` elimina el staging). Resultado por celda.
 */
export async function guardarPxListasCambiosAction(
  raw: unknown
): Promise<ActionResult<{ resultados: ResultadoCambioPxListas[] }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }

  const parsed = guardarPxListasCambiosSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      parsed.error.issues[0]?.message ?? "Datos de cambios inválidos.";
    return { ok: false, error: first };
  }

  try {
    const resultados = await guardarCambiosPxListasLote(parsed.data.cambios);
    if (resultados.some((r) => r.ok)) revalidatePxListasPaths();
    return { ok: true, data: { resultados } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron guardar los cambios.",
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
