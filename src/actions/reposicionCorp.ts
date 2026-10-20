"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { requireEditorReposicionCorp } from "@/lib/actionGates";
import { APP_ROUTES } from "@/lib/appRoutes";
import { REVALIDATE_CX_COMPRA } from "@/lib/gestionProductosRoutes";
import {
  deleteReglaReposicionCorpSchema,
  upsertReglaReposicionCorpSchema,
} from "@/lib/validations/reposicion";
import {
  deleteReglaReposicionCorp,
  upsertReglaReposicionCorp,
} from "@/services/reposicionCorp.service";

const REPOSICION_CORP_PATH = APP_ROUTES.administrador.reposicionCorp.reposicionCorp;

export async function upsertReglaReposicionCorpAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorReposicionCorp();
  if (gate) return gate;
  const parsed = upsertReglaReposicionCorpSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean);
    return { ok: false, error: first ?? "Datos inválidos." };
  }
  const res = await upsertReglaReposicionCorp(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidatePath(REPOSICION_CORP_PATH);
  revalidatePath("/ventas/compras/pedir-mercaderia");
  if (parsed.data.formaPedir === "POR_BULTO" && parsed.data.unidadesPorBulto != null) {
    for (const path of REVALIDATE_CX_COMPRA) {
      revalidatePath(path);
    }
  }
  return { ok: true, data: undefined };
}

export async function deleteReglaReposicionCorpAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorReposicionCorp();
  if (gate) return gate;
  const parsed = deleteReglaReposicionCorpSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Código inválido." };
  }
  const res = await deleteReglaReposicionCorp(parsed.data.codTienda);
  if (!res.success) return { ok: false, error: res.error };
  revalidatePath(REPOSICION_CORP_PATH);
  revalidatePath("/ventas/compras/pedir-mercaderia");
  return { ok: true, data: undefined };
}
