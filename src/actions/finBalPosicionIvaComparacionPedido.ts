"use server";

import { revalidatePath } from "next/cache";
import { revalidatePedidoUrgenteTrasCambioIvaSaldo } from "@/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo";
import { requireEditorFinanzas } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import { guardarIvaComparacionPedidoSchema } from "@/lib/validations/finBalPosicionIvaComparacionPedido";
import {
  guardarIvaComparacionPedido,
  type EstadoIvaComparacionPedido,
} from "@/services/finBalPosicionIvaComparacionPedido.service";

export type { EstadoIvaComparacionPedido } from "@/services/finBalPosicionIvaComparacionPedido.service";


export async function guardarIvaComparacionPedidoAction(
  raw: unknown
): Promise<ActionResult<EstadoIvaComparacionPedido>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = guardarIvaComparacionPedidoSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Datos inválidos para guardar.";
    return { ok: false, error: msg };
  }

  try {
    const estado = await guardarIvaComparacionPedido({
      usarValorConfigurado: parsed.data.usarValorConfigurado,
      saldoPesos: parsed.data.saldoPesos,
    });
    revalidatePath("/finanzas/impuestos/posicion-iva");
    revalidatePedidoUrgenteTrasCambioIvaSaldo();
    return { ok: true, data: estado };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo guardar la configuración.";
    return { ok: false, error: message };
  }
}
