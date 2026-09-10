"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import {
  eliminarFinBalVtasPorPeriodoSchema,
  guardarFinBalVtasCargaPeriodoSchema,
  listarFinBalVtasPorMesAnioSchema,
} from "@/lib/validations/finBalVtas";
import {
  eliminarFinBalVtasPorPeriodo,
  guardarFinBalVtasCargaPeriodo,
  listarFinBalVtasPorMesAnio,
  type FinBalVtasItem,
} from "@/services/finBalVtas.service";

export async function listarFinBalVtasPorMesAnioAction(
  raw: unknown
): Promise<ActionResult<FinBalVtasItem[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  const parsed = listarFinBalVtasPorMesAnioSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const data = await listarFinBalVtasPorMesAnio(parsed.data.mes, parsed.data.anio);
  return { ok: true, data };
}

export async function guardarFinBalVtasCargaPeriodoAction(
  raw: unknown
): Promise<ActionResult<{ guardados: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Solo el modo editor puede cargar ventas de balance." };
  }
  const parsed = guardarFinBalVtasCargaPeriodoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await guardarFinBalVtasCargaPeriodo(parsed.data);
  const out = fromServiceResult(res);
  if (!out.ok) return out;
  revalidatePath("/finanzas/balance/vtas");
  revalidatePath("/finanzas/balance/mensual");
  return out;
}

export async function eliminarFinBalVtasPorPeriodoAction(
  raw: unknown
): Promise<ActionResult<{ eliminados: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Solo el modo editor puede eliminar registros." };
  }
  const parsed = eliminarFinBalVtasPorPeriodoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await eliminarFinBalVtasPorPeriodo(parsed.data.mes, parsed.data.anio);
  const out = fromServiceResult(res);
  if (!out.ok) return out;
  revalidatePath("/finanzas/balance/vtas");
  revalidatePath("/finanzas/balance/mensual");
  return out;
}
