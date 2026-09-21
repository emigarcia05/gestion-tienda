"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { TesoreriaTipoCajaItem } from "@/lib/cajasTesoreriaTipoCaja";
import type { ActionResult } from "@/lib/types";
import {
  crearTesoreriaTipoCajaSchema,
  editarTesoreriaTipoCajaSchema,
  eliminarTesoreriaTipoCajaSchema,
} from "@/lib/validations/tesoreriaTipoCaja";
import {
  crearTesoreriaTipoCaja,
  editarTesoreriaTipoCaja,
  eliminarTesoreriaTipoCaja,
  listarTesoreriaTipoCaja,
} from "@/services/tesoreriaTipoCaja.service";

function revalidateTesoreriaTipoCajaPaths(): void {
  revalidatePath("/finanzas/tesoreria");
}

export async function listarTesoreriaTipoCajaAction(): Promise<
  ActionResult<TesoreriaTipoCajaItem[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  try {
    return { ok: true, data: await listarTesoreriaTipoCaja() };
  } catch (e) {
    console.error("[tesoreriaTipoCaja][listar]", e);
    return { ok: false, error: "No se pudieron listar los tipos de caja." };
  }
}

export async function crearTesoreriaTipoCajaAction(
  raw: unknown
): Promise<ActionResult<TesoreriaTipoCajaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = crearTesoreriaTipoCajaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await crearTesoreriaTipoCaja(parsed.data);
  if (!res.success) return fromServiceResult(res);
  revalidateTesoreriaTipoCajaPaths();
  return { ok: true, data: res.data };
}

export async function editarTesoreriaTipoCajaAction(
  raw: unknown
): Promise<ActionResult<TesoreriaTipoCajaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = editarTesoreriaTipoCajaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await editarTesoreriaTipoCaja(parsed.data);
  if (!res.success) return fromServiceResult(res);
  revalidateTesoreriaTipoCajaPaths();
  return { ok: true, data: res.data };
}

export async function eliminarTesoreriaTipoCajaAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = eliminarTesoreriaTipoCajaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }
  const res = await eliminarTesoreriaTipoCaja(parsed.data.id);
  if (!res.success) return fromServiceResult(res);
  revalidateTesoreriaTipoCajaPaths();
  return { ok: true, data: undefined };
}
