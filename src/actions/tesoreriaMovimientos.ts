"use server";

import { revalidatePath } from "next/cache";
import { requireFinanzasLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import {
  ajustarMontoCajaTesoreriaSchema,
  crearMovimientoTesoreriaSchema,
  crearTransferenciaEntreCajasSchema,
} from "@/lib/validations/tesoreriaMovimientos";
import {
  ajustarMontoCajaTesoreria,
  crearMovimientoTesoreria,
  crearTransferenciaEntreCajas,
  listarMovimientosTesoreria,
  type TesoreriaMovimientoCreado,
  type TesoreriaMovimientoFila,
} from "@/services/tesoreriaMovimientos.service";

function revalidateTesoreria(): void {
  revalidatePath("/finanzas/tesoreria");
  revalidatePath("/finanzas/tesoreria/movimientos");
  revalidatePath("/finanzas/venc-por-fecha");
}

export async function listarMovimientosTesoreriaAction(): Promise<
  ActionResult<TesoreriaMovimientoFila[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  try {
    const filas = await listarMovimientosTesoreria();
    return { ok: true, data: filas };
  } catch (e) {
    console.error("[listarMovimientosTesoreriaAction]", e);
    return { ok: false, error: "No se pudieron cargar los movimientos." };
  }
}

export async function crearMovimientoTesoreriaAction(
  raw: unknown
): Promise<ActionResult<TesoreriaMovimientoCreado>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = crearMovimientoTesoreriaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await crearMovimientoTesoreria(parsed.data);
  if (res.success) revalidateTesoreria();
  return fromServiceResult(res);
}

export async function ajustarMontoCajaTesoreriaAction(
  raw: unknown
): Promise<ActionResult<TesoreriaMovimientoCreado>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = ajustarMontoCajaTesoreriaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await ajustarMontoCajaTesoreria(parsed.data);
  if (res.success) revalidateTesoreria();
  return fromServiceResult(res);
}

export async function crearTransferenciaEntreCajasAction(
  raw: unknown
): Promise<ActionResult<{ transferenciaGrupoId: string; ids: [string, string] }>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = crearTransferenciaEntreCajasSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await crearTransferenciaEntreCajas(parsed.data);
  if (res.success) revalidateTesoreria();
  return fromServiceResult(res);
}
