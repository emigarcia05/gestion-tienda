"use server";

import { revalidatePath } from "next/cache";
import {
  requireDescPromosLectura,
  requireEditorDescPromos,
  requireFacturacionLectura,
} from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import { DESC_PROMOS_PATH, type DescPromoFila } from "@/lib/descPromo";
import type { ActionResult } from "@/lib/types";
import {
  crearDescPromoSchema,
  editarDescPromoSchema,
  eliminarDescPromoSchema,
  moverPrioridadDescPromoSchema,
} from "@/lib/validations/descPromo";
import {
  crearDescPromo,
  editarDescPromo,
  eliminarDescPromo,
  listarDescPromos,
  listarDescPromosPorFormaPago,
  moverPrioridadDescPromo,
} from "@/services/descPromo.service";

function revalidateDescPromos() {
  revalidatePath(DESC_PROMOS_PATH);
}

export async function listarDescPromosAction(): Promise<ActionResult<DescPromoFila[]>> {
  const gate = await requireDescPromosLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarDescPromos() };
  } catch (e) {
    console.error("[listarDescPromosAction]", e);
    return { ok: false, error: "No se pudieron listar los descuentos." };
  }
}

export async function listarDescPromosFormaPagoFacturaAction(): Promise<
  ActionResult<DescPromoFila[]>
> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarDescPromosPorFormaPago() };
  } catch (e) {
    console.error("[listarDescPromosFormaPagoFacturaAction]", e);
    return { ok: false, error: "No se pudieron listar los descuentos por forma de pago." };
  }
}

export async function crearDescPromoAction(
  raw: unknown
): Promise<ActionResult<DescPromoFila>> {
  const gate = await requireEditorDescPromos();
  if (gate) return gate;
  const parsed = crearDescPromoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const result = fromServiceResult(await crearDescPromo(parsed.data));
  if (result.ok) revalidateDescPromos();
  return result;
}

export async function editarDescPromoAction(
  raw: unknown
): Promise<ActionResult<DescPromoFila>> {
  const gate = await requireEditorDescPromos();
  if (gate) return gate;
  const parsed = editarDescPromoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const result = fromServiceResult(await editarDescPromo(parsed.data));
  if (result.ok) revalidateDescPromos();
  return result;
}

export async function eliminarDescPromoAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEditorDescPromos();
  if (gate) return gate;
  const parsed = eliminarDescPromoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const result = fromServiceResult(await eliminarDescPromo(parsed.data.id));
  if (result.ok) revalidateDescPromos();
  return result;
}

export async function moverPrioridadDescPromoAction(
  raw: unknown
): Promise<ActionResult<DescPromoFila>> {
  const gate = await requireEditorDescPromos();
  if (gate) return gate;
  const parsed = moverPrioridadDescPromoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const result = fromServiceResult(
    await moverPrioridadDescPromo(parsed.data.id, parsed.data.direccion)
  );
  if (result.ok) revalidateDescPromos();
  return result;
}
