"use server";

import { revalidatePath } from "next/cache";
import { revalidatePedidoUrgenteTrasCambioIvaSaldo } from "@/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo";
import { z } from "zod";
import { requireEditorFinanzas } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import { mesAnioQuerySchema } from "@/lib/validations/finBalGastoMensualBalance";
import {
  eliminarSaldoManualPosicionIva,
  upsertSaldoManualPosicionIva,
} from "@/services/finBalPosicionIvaSaldoManual.service";

const guardarSaldoSchema = mesAnioQuerySchema.extend({
  saldoPesos: z.coerce.number().finite(),
});

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}


export async function guardarFinBalPosicionIvaSaldoManualAction(
  raw: unknown,
): Promise<ActionResult<{ saldoPesos: number }>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = guardarSaldoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  const saldoPesos = Math.round(parsed.data.saldoPesos);

  try {
    await upsertSaldoManualPosicionIva({
      anio: parsed.data.anio,
      mes: parsed.data.mes,
      saldoPesos,
    });
  } catch {
    return { ok: false, error: "No se pudo guardar el saldo." };
  }

  revalidatePath("/finanzas/impuestos/posicion-iva");
  revalidatePedidoUrgenteTrasCambioIvaSaldo();
  return { ok: true, data: { saldoPesos } };
}

export async function eliminarFinBalPosicionIvaSaldoManualAction(
  raw: unknown,
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = mesAnioQuerySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };

  try {
    await eliminarSaldoManualPosicionIva({ anio: parsed.data.anio, mes: parsed.data.mes });
  } catch {
    return { ok: false, error: "No se pudo restaurar el cálculo automático." };
  }

  revalidatePath("/finanzas/impuestos/posicion-iva");
  revalidatePedidoUrgenteTrasCambioIvaSaldo();
  return { ok: true, data: undefined };
}
