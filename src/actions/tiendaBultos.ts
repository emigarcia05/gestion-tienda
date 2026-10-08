"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { REVALIDATE_CX_COMPRA } from "@/lib/gestionProductosRoutes";
import { guardarBultoTiendaSchema } from "@/lib/validations/tiendaBultos";
import { guardarBultoProdTienda } from "@/services/tiendaBultos.service";

/**
 * Persiste BULTO del ítem tienda (`prod_lista.bulto`). `bulto: null` vacía el valor.
 */
export async function guardarBultoTiendaAction(
  raw: unknown
): Promise<ActionResult<{ bulto: number | null }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return { ok: false, error: "Sin acceso." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = guardarBultoTiendaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }

  const res = await guardarBultoProdTienda(parsed.data.codTienda, parsed.data.bulto);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  for (const path of REVALIDATE_CX_COMPRA) {
    revalidatePath(path);
  }
  return { ok: true, data: res.data };
}
