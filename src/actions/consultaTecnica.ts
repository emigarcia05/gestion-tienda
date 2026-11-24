"use server";

import { revalidatePath } from "next/cache";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import {
  requireEditorConsultaTecnica,
} from "@/lib/actionGates";
import { APP_ROUTES } from "@/lib/appRoutes";
import type { ConsultaTecnicaRecomendacionItem } from "@/lib/consultaTecnica";
import type { ActionResult } from "@/lib/types";
import {
  eliminarConsultaTecnicaSchema,
  guardarConsultaTecnicaSchema,
} from "@/lib/validations/consultaTecnica";
import {
  eliminarConsultaTecnica,
  guardarConsultaTecnica,
} from "@/services/consultaTecnica.service";

function refrescar() {
  revalidatePath(APP_ROUTES.ventas.herramientas.consultaTecnica);
}

export async function guardarConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult<ConsultaTecnicaRecomendacionItem>> {
  const gate = await requireEditorConsultaTecnica();
  if (gate) return gate;

  const parsed = guardarConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await guardarConsultaTecnica(parsed.data));
  if (out.ok) refrescar();
  return out;
}

export async function eliminarConsultaTecnicaAction(
  raw: unknown
): Promise<ActionResult> {
  const gate = await requireEditorConsultaTecnica();
  if (gate) return gate;

  const parsed = eliminarConsultaTecnicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = fromServiceResult(await eliminarConsultaTecnica(parsed.data.id));
  if (out.ok) refrescar();
  return out;
}
