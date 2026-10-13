"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import {
  actualizarReglaDescEspecialSchema,
  crearReglaDescEspecialSchema,
  eliminarReglaDescEspecialSchema,
  obtenerReglaDescEspecialDetalleSchema,
} from "@/lib/validations/descEspecialReglas";
import {
  actualizarReglaDescEspecial,
  crearReglaDescEspecial,
  eliminarReglaDescEspecial,
  listarReglasDescEspecial,
  obtenerReglaDescEspecialDetalle,
  type ReglaDescEspecialDetalle,
  type ReglaDescEspecialListaPrecio,
} from "@/services/descEspecialReglas.service";
import { REVALIDATE_LISTA_PRECIOS } from "@/lib/gestionProductosRoutes";

export type {
  ReglaDescEspecialListaPrecio,
  ReglaDescEspecialDetalle,
} from "@/services/descEspecialReglas.service";

function revalidarListaPrecios(): void {
  for (const path of REVALIDATE_LISTA_PRECIOS) {
    revalidatePath(path);
  }
  revalidatePath("/administrador/productos/analisis-cat");
}

async function requireGestionReglasDescuentos(): Promise<{ ok: false; error: string } | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.listaPrecios.acciones.gestionarReglasDescuentos)) {
    return { ok: false, error: "Sin permisos para gestionar reglas de descuentos." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }
  return null;
}

export async function listarReglasDescEspecialAction(): Promise<
  ActionResult<ReglaDescEspecialListaPrecio[]>
> {
  const gate = await requireGestionReglasDescuentos();
  if (gate) return gate;

  try {
    const reglas = await listarReglasDescEspecial();
    return { ok: true, data: reglas };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al listar reglas de desc. específico.";
    return { ok: false, error: message };
  }
}

export async function obtenerReglaDescEspecialDetalleAction(
  raw: unknown
): Promise<ActionResult<ReglaDescEspecialDetalle>> {
  const gate = await requireGestionReglasDescuentos();
  if (gate) return gate;

  const parsed = obtenerReglaDescEspecialDetalleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "ID de regla inválido." };
  }

  try {
    const detalle = await obtenerReglaDescEspecialDetalle(parsed.data.id);
    if (!detalle) {
      return { ok: false, error: "Regla no encontrada." };
    }
    return { ok: true, data: detalle };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cargar la regla.";
    return { ok: false, error: message };
  }
}

export async function crearReglaDescEspecialAction(
  raw: unknown
): Promise<ActionResult<ReglaDescEspecialDetalle>> {
  const gate = await requireGestionReglasDescuentos();
  if (gate) return gate;

  const parsed = crearReglaDescEspecialSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Datos inválidos para crear la regla.";
    return { ok: false, error: msg };
  }

  try {
    const result = await crearReglaDescEspecial(parsed.data);
    if (!result.success) {
      return { ok: false, error: result.error };
    }
    revalidarListaPrecios();
    return { ok: true, data: result.data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear la regla.";
    return { ok: false, error: message };
  }
}

export async function actualizarReglaDescEspecialAction(
  raw: unknown
): Promise<ActionResult<ReglaDescEspecialDetalle>> {
  const gate = await requireGestionReglasDescuentos();
  if (gate) return gate;

  const parsed = actualizarReglaDescEspecialSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Datos inválidos para actualizar la regla.";
    return { ok: false, error: msg };
  }

  try {
    const result = await actualizarReglaDescEspecial(parsed.data);
    if (!result.success) {
      return { ok: false, error: result.error };
    }
    revalidarListaPrecios();
    return { ok: true, data: result.data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar la regla.";
    return { ok: false, error: message };
  }
}

export async function eliminarReglaDescEspecialAction(
  raw: unknown
): Promise<ActionResult<{ actualizados: number }>> {
  const gate = await requireGestionReglasDescuentos();
  if (gate) return gate;

  const parsed = eliminarReglaDescEspecialSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "ID de regla inválido." };
  }

  try {
    const result = await eliminarReglaDescEspecial(parsed.data.id);
    if (!result.success) {
      return { ok: false, error: result.error };
    }
    revalidarListaPrecios();
    return { ok: true, data: result.data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al eliminar la regla.";
    return { ok: false, error: message };
  }
}
