"use server";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import {
  buscarProductosComparacionSchema,
  codTiendaComparacionSchema,
} from "@/lib/validations/comparacionCompetencia";
import * as comparacionCompetenciaService from "@/services/comparacionCompetencia.service";

function revalidatePxCompetenciaPaths() {
  revalidatePath(GP_ROUTES.analisisPrecios.pxCompetencia);
  revalidatePath("/administrador/productos/px-competencia");
}

async function gateEditarComparacion(): Promise<{ ok: false; error: string } | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.competenciaPrecios.editar)) {
    return { ok: false, error: "Sin permisos para editar comparación de competencia." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }
  return null;
}

export async function buscarProductosParaComparacionAction(
  raw: unknown
): Promise<
  ActionResult<{
    items: comparacionCompetenciaService.ProductoTiendaParaComparacionRow[];
    total: number;
  }>
> {
  const denied = await gateEditarComparacion();
  if (denied) return denied;

  const parsed = buscarProductosComparacionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await comparacionCompetenciaService.buscarProductosTiendaParaComparacion({
    q: parsed.data.q,
    take: parsed.data.take,
  });
  if (!res.success) return { ok: false, error: res.error };

  return { ok: true, data: res.data };
}

export async function agregarProductoComparacionAction(
  raw: unknown
): Promise<ActionResult> {
  const denied = await gateEditarComparacion();
  if (denied) return denied;

  const parsed = codTiendaComparacionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await comparacionCompetenciaService.agregarProductoComparacionCompetencia(
    parsed.data.codTienda
  );
  if (!res.success) return { ok: false, error: res.error };

  revalidatePxCompetenciaPaths();
  return { ok: true, data: undefined };
}

export async function quitarProductoComparacionAction(
  raw: unknown
): Promise<ActionResult> {
  const denied = await gateEditarComparacion();
  if (denied) return denied;

  const parsed = codTiendaComparacionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const res = await comparacionCompetenciaService.quitarProductoComparacionCompetencia(
    parsed.data.codTienda
  );
  if (!res.success) return { ok: false, error: res.error };

  revalidatePxCompetenciaPaths();
  return { ok: true, data: undefined };
}
