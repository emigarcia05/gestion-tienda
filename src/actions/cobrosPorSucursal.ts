"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";
import { guardarCobroPorSucursalDestinoSchema } from "@/lib/validations/cobrosPorSucursal";
import {
  guardarCobroPorSucursalDestino,
  listarVistaCobrosPorSucursal,
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
    return { ok: false, error: "No se pudo cargar cobros por sucursal." };
  }
}

export async function guardarCobroPorSucursalDestinoAction(
  raw: unknown
): Promise<
  ActionResult<{ cobrosCxFinId: string; sucursalId: string; cajaDestinoId: string | null }>
> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = guardarCobroPorSucursalDestinoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await guardarCobroPorSucursalDestino(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidatePath(VTAS_COBROS_ROUTES.cobrosPorSucursal);
  return { ok: true, data: res.data };
}
