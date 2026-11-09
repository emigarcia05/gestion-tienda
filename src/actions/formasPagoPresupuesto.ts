"use server";

import { revalidatePath } from "next/cache";
import {
  requireEditorFinanzas,
  requireFacturacionLectura,
  requireFinanzasLectura,
} from "@/lib/actionGates";
import { firstZodErrorMessage } from "@/lib/actionResult";
import { APP_ROUTES } from "@/lib/appRoutes";
import type { ActionResult } from "@/lib/types";
import {
  guardarTextoFormaPagoPresupuestoSchema,
  idTextoFormaPagoPresupuestoSchema,
  moverTextoFormaPagoPresupuestoSchema,
} from "@/lib/validations/formasPagoPresupuesto";
import {
  crearTextoFormaPagoPresupuesto,
  editarTextoFormaPagoPresupuesto,
  eliminarTextoFormaPagoPresupuesto,
  listarTextosFormasPagoPresupuesto,
  moverTextoFormaPagoPresupuesto,
  type TextoFormaPagoPresupuesto,
} from "@/services/formasPagoPresupuesto.service";

function revalidar() {
  revalidatePath(APP_ROUTES.administrador.cobrosDesc.formasPagoPresupuesto);
}

async function listarTrasCambio(): Promise<ActionResult<TextoFormaPagoPresupuesto[]>> {
  revalidar();
  return { ok: true, data: await listarTextosFormasPagoPresupuesto() };
}

export async function listarTextosFormasPagoPresupuestoAction(): Promise<
  ActionResult<TextoFormaPagoPresupuesto[]>
> {
  const finanzas = await requireFinanzasLectura();
  if (finanzas) {
    const facturacion = await requireFacturacionLectura();
    if (facturacion) return facturacion;
  }
  try {
    return { ok: true, data: await listarTextosFormasPagoPresupuesto() };
  } catch (error) {
    console.error("[listarTextosFormasPagoPresupuestoAction]", error);
    return { ok: false, error: "No se pudieron listar las formas de pago del presupuesto." };
  }
}

export async function guardarTextoFormaPagoPresupuestoAction(
  raw: unknown
): Promise<ActionResult<TextoFormaPagoPresupuesto[]>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = guardarTextoFormaPagoPresupuestoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = parsed.data.id
      ? await editarTextoFormaPagoPresupuesto({
          id: parsed.data.id,
          descTexto: parsed.data.descTexto,
          pagoIds: parsed.data.pagoIds,
        })
      : await crearTextoFormaPagoPresupuesto(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    return await listarTrasCambio();
  } catch (error) {
    console.error("[guardarTextoFormaPagoPresupuestoAction]", error);
    return { ok: false, error: "No se pudo guardar el ítem." };
  }
}

export async function eliminarTextoFormaPagoPresupuestoAction(
  raw: unknown
): Promise<ActionResult<TextoFormaPagoPresupuesto[]>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = idTextoFormaPagoPresupuestoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await eliminarTextoFormaPagoPresupuesto(parsed.data.id);
    if (!res.success) return { ok: false, error: res.error };
    return await listarTrasCambio();
  } catch (error) {
    console.error("[eliminarTextoFormaPagoPresupuestoAction]", error);
    return { ok: false, error: "No se pudo eliminar el ítem." };
  }
}

export async function moverTextoFormaPagoPresupuestoAction(
  raw: unknown
): Promise<ActionResult<TextoFormaPagoPresupuesto[]>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = moverTextoFormaPagoPresupuestoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await moverTextoFormaPagoPresupuesto(parsed.data.id, parsed.data.direccion);
    if (!res.success) return { ok: false, error: res.error };
    return await listarTrasCambio();
  } catch (error) {
    console.error("[moverTextoFormaPagoPresupuestoAction]", error);
    return { ok: false, error: "No se pudo reordenar el ítem." };
  }
}
