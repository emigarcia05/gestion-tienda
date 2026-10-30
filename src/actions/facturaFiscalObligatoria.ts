"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas } from "@/lib/actionGates";
import { firstZodErrorMessage } from "@/lib/actionResult";
import { APP_ROUTES } from "@/lib/appRoutes";
import type { ActionResult } from "@/lib/types";
import { guardarFacturaFiscalObligatoriaSchema } from "@/lib/validations/facturaFiscalObligatoria";
import {
  guardarFacturaFiscalObligatoria,
  type FacturaFiscalObligatoriaFila,
} from "@/services/facturaFiscalObligatoria.service";

export async function guardarFacturaFiscalObligatoriaAction(
  raw: unknown
): Promise<ActionResult<FacturaFiscalObligatoriaFila>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = guardarFacturaFiscalObligatoriaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await guardarFacturaFiscalObligatoria(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidatePath(APP_ROUTES.administrador.cobrosDesc.seguimientoFiscal);
  return { ok: true, data: res.data };
}
