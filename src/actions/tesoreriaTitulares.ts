"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { TesoreriaTitularItem } from "@/lib/cajasTesoreriaTitulares";
import type { ActionResult } from "@/lib/types";
import {
  crearTesoreriaTitularSchema,
  editarTesoreriaTitularSchema,
  eliminarTesoreriaTitularSchema,
} from "@/lib/validations/tesoreriaTitulares";
import { VTAS_COBROS_LEGACY_FACT_COBROS_PATH, VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";
import {
  crearTesoreriaTitular,
  editarTesoreriaTitular,
  eliminarTesoreriaTitular,
  listarTesoreriaTitulares,
} from "@/services/tesoreriaTitulares.service";

function revalidateTesoreriaTitularesPaths(): void {
  revalidatePath(VTAS_COBROS_ROUTES.ptosVenta);
  revalidatePath(VTAS_COBROS_LEGACY_FACT_COBROS_PATH);
  revalidatePath("/finanzas/tesoreria");
}

export async function listarTesoreriaTitularesAction(): Promise<
  ActionResult<TesoreriaTitularItem[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarTesoreriaTitulares() };
  } catch (e) {
    console.error("[tesoreriaTitulares][listar]", e);
    return { ok: false, error: "No se pudieron listar los titulares." };
  }
}

export async function crearTesoreriaTitularAction(
  raw: unknown
): Promise<ActionResult<TesoreriaTitularItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = crearTesoreriaTitularSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await crearTesoreriaTitular(parsed.data.nombre);
  if (!res.success) return fromServiceResult(res);
  revalidateTesoreriaTitularesPaths();
  return { ok: true, data: res.data };
}

export async function editarTesoreriaTitularAction(
  raw: unknown
): Promise<ActionResult<TesoreriaTitularItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = editarTesoreriaTitularSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await editarTesoreriaTitular(parsed.data.id, parsed.data.nombre);
  if (!res.success) return fromServiceResult(res);
  revalidateTesoreriaTitularesPaths();
  return { ok: true, data: res.data };
}

export async function eliminarTesoreriaTitularAction(raw: unknown): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = eliminarTesoreriaTitularSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await eliminarTesoreriaTitular(parsed.data.id);
  if (!res.success) return fromServiceResult(res);
  revalidateTesoreriaTitularesPaths();
  return { ok: true, data: undefined };
}
