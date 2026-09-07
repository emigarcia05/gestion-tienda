"use server";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { mesAnioQuerySchema } from "@/lib/validations/finBalGastoMensualBalance";
import {
  listarDetalleIvaDebitoMes,
  type DetalleLineaIvaDebitoBalance,
} from "@/services/finBalIvaDeb.service";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}

async function parseMesAnioFinanzas(
  raw: unknown,
): Promise<{ ok: true; data: { mes: number; anio: number } } | { ok: false; error: string }> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }

  const parsed = mesAnioQuerySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  return { ok: true, data: parsed.data };
}

/** Detalle IVA débito del mes. */
export async function listarDetalleIvaDebitoMesAction(
  raw: unknown,
): Promise<ActionResult<DetalleLineaIvaDebitoBalance[]>> {
  const parsed = await parseMesAnioFinanzas(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const data = await listarDetalleIvaDebitoMes(parsed.data);
  return { ok: true, data };
}
