"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { requireEditorReposicionCorp } from "@/lib/actionGates";
import { APP_ROUTES } from "@/lib/appRoutes";
import { REVALIDATE_CX_COMPRA } from "@/lib/gestionProductosRoutes";
import {
  deleteReglaReposicionCorpSchema,
  productosReposicionCorpSelectorSchema,
  upsertReglaReposicionCorpSchema,
} from "@/lib/validations/reposicion";
import {
  deleteReglaReposicionCorp,
  listarProductosSelectorReposicionCorp,
  upsertReglaReposicionCorp,
} from "@/services/reposicionCorp.service";
import type { ItemSelectorReposicion } from "@/actions/reposicion";

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

export async function getProductosSelectorReposicionCorpAction(
  raw: unknown
): Promise<ActionResult<ItemSelectorReposicion[]>> {
  const gate = await requireEditorReposicionCorp();
  if (gate) return gate;
  const parsed = productosReposicionCorpSelectorSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Búsqueda inválida." };
  try {
    const rows = await listarProductosSelectorReposicionCorp(parsed.data);
    return {
      ok: true,
      data: rows.map((r) => ({
        idListaTienda: r.codTienda,
        codExt: "",
        codTienda: r.codTienda,
        descripcionTienda: r.descripcionTienda,
      })),
    };
  } catch (e: unknown) {
    console.error("[reposicionCorp] getProductosSelectorReposicionCorpAction:", e);
    return { ok: false, error: "No se pudieron cargar los productos." };
  }
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
