"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import { SUCURSALES_CATALOGO_PATH } from "@/lib/usuarios";
import type { ActionResult } from "@/lib/types";
import {
  actualizarSucursalCatalogoSchema,
  eliminarSucursalCatalogoSchema,
} from "@/lib/validations/sucursalCatalogo";
import {
  actualizarSucursalCatalogo,
  eliminarSucursalCatalogo,
} from "@/services/sucursalesCatalogo.service";

async function gateSucursales(): Promise<string | null> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.acceso)) {
    return "Sin permisos para usuarios.";
  }
  if (!(await esEditor())) {
    return "Sin permisos de editor.";
  }
  return null;
}

export async function actualizarSucursalCatalogoAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await gateSucursales();
  if (gate) return { ok: false, error: gate };

  const parsed = actualizarSucursalCatalogoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const result = await actualizarSucursalCatalogo(parsed.data);
  if (result.success) revalidatePath(SUCURSALES_CATALOGO_PATH);
  return fromServiceResult(result);
}

export async function eliminarSucursalCatalogoAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await gateSucursales();
  if (gate) return { ok: false, error: gate };

  const parsed = eliminarSucursalCatalogoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const result = await eliminarSucursalCatalogo(parsed.data);
  if (result.success) revalidatePath(SUCURSALES_CATALOGO_PATH);
  return fromServiceResult(result);
}
