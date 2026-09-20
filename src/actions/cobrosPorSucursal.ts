"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";
import {
  actualizarCobroPorSucursalSchema,
  crearCobroPorSucursalSchema,
  eliminarCobroPorSucursalSchema,
} from "@/lib/validations/cobrosPorSucursal";
import {
  actualizarCobroPorSucursal,
  crearCobroPorSucursal,
  eliminarCobroPorSucursal,
  listarVistaCobrosPorSucursal,
  type CobrosPorSucursalFila,
  type CobrosPorSucursalVista,
} from "@/services/cobrosPorSucursal.service";

export async function listarVistaCobrosPorSucursalAction(): Promise<
  ActionResult<CobrosPorSucursalVista>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  try {
    const data = await listarVistaCobrosPorSucursal();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudo cargar Cobros & Cajas." };
  }
}

export async function crearCobroPorSucursalAction(
  raw: unknown
): Promise<ActionResult<CobrosPorSucursalFila>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearCobroPorSucursalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearCobroPorSucursal(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidatePath(VTAS_COBROS_ROUTES.cobrosPorSucursal);
  return { ok: true, data: res.data };
}

export async function actualizarCobroPorSucursalAction(
  raw: unknown
): Promise<ActionResult<CobrosPorSucursalFila>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = actualizarCobroPorSucursalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await actualizarCobroPorSucursal(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidatePath(VTAS_COBROS_ROUTES.cobrosPorSucursal);
  return { ok: true, data: res.data };
}

export async function eliminarCobroPorSucursalAction(
  raw: unknown
): Promise<ActionResult<{ pagoId: string; entidadId: string }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarCobroPorSucursalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarCobroPorSucursal(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidatePath(VTAS_COBROS_ROUTES.cobrosPorSucursal);
  return { ok: true, data: res.data };
}
