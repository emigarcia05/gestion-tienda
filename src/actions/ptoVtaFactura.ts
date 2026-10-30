"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas } from "@/lib/actionGates";
import { firstZodErrorMessage } from "@/lib/actionResult";
import { APP_ROUTES } from "@/lib/appRoutes";
import type { ActionResult } from "@/lib/types";
import { guardarPtoVtaFacturaSchema } from "@/lib/validations/ptoVtaFactura";
import {
  guardarPtoVtaFactura,
  type PtoVtaFacturaGuardado,
} from "@/services/ptoVtaFactura.service";

export async function guardarPtoVtaFacturaAction(
  raw: unknown
): Promise<ActionResult<PtoVtaFacturaGuardado>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = guardarPtoVtaFacturaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await guardarPtoVtaFactura(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidatePath(APP_ROUTES.administrador.cobrosDesc.seguimientoFiscal);
  return { ok: true, data: res.data };
}
