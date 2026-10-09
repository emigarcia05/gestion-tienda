"use server";

import { revalidatePath } from "next/cache";
import { requireFinanzasLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import {
  ajustarMontoCajaTesoreriaSchema,
  crearMovimientoTesoreriaSchema,
  crearTransferenciaEntreCajasSchema,
  eliminarMovimientoTesoreriaSchema,
} from "@/lib/validations/tesoreriaMovimientos";
import {
  ajustarMontoCajaTesoreria,
  crearMovimientoTesoreria,
  crearTransferenciaEntreCajas,
  eliminarMovimientoTesoreria,
  type EliminarMovimientoTesoreriaResultado,
  listarMovimientosTesoreria,
  obtenerMovimientoTesoreriaPorId,
  type TesoreriaMovimientoCreado,
  type TesoreriaMovimientoFila,
} from "@/services/tesoreriaMovimientos.service";

function revalidateTesoreria(): void {
  revalidatePath("/finanzas/tesoreria/cajas");
  revalidatePath("/finanzas/tesoreria/movimientos");
  revalidatePath("/finanzas/tesoreria/flujo-de-fondos");
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

export async function obtenerMovimientoTesoreriaPorIdAction(
  raw: unknown
): Promise<ActionResult<TesoreriaMovimientoFila>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = eliminarMovimientoTesoreriaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await obtenerMovimientoTesoreriaPorId(parsed.data.id);
  return fromServiceResult(res);
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

export async function eliminarMovimientoTesoreriaAction(
  raw: unknown
): Promise<ActionResult<EliminarMovimientoTesoreriaResultado>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = eliminarMovimientoTesoreriaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await eliminarMovimientoTesoreria(parsed.data.id);
  if (res.success) revalidateTesoreria();
  return fromServiceResult(res);
}
