"use server";

import { revalidatePath } from "next/cache";
import { getRol, esEditor } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import { USUARIOS_PATH } from "@/lib/usuarios";
import {
  actualizarUsuarioPersonalSchema,
  crearUsuarioPersonalSchema,
} from "@/lib/validations/globalPersonal";
import {
  actualizarUsuarioPersonal,
  crearUsuarioPersonal,
  listUsuariosParaInicioSesion,
  type GlobalPersonalItem,
} from "@/services/globalPersonal.service";

export async function listUsuariosParaInicioSesionAction(): Promise<
  ActionResult<GlobalPersonalItem[]>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.inicioSesion)) {
    return { ok: false, error: "Sin permisos." };
  }
  try {
    const items = await listUsuariosParaInicioSesion();
    return { ok: true, data: items };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[globalPersonal][action][listUsuariosParaInicioSesion]", message);
    return { ok: false, error: "Error al listar usuarios." };
  }
}

export async function crearUsuarioPersonalAction(
  raw: unknown
): Promise<ActionResult<GlobalPersonalItem>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.acceso)) {
    return { ok: false, error: "Sin permisos para usuarios." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = crearUsuarioPersonalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const result = await crearUsuarioPersonal(parsed.data);
  if (result.success) revalidatePath(USUARIOS_PATH);
  return fromServiceResult(result);
}

export async function actualizarUsuarioPersonalAction(
  raw: unknown
): Promise<ActionResult<GlobalPersonalItem>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.acceso)) {
    return { ok: false, error: "Sin permisos para usuarios." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = actualizarUsuarioPersonalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const result = await actualizarUsuarioPersonal(parsed.data);
  if (result.success) revalidatePath(USUARIOS_PATH);
  return fromServiceResult(result);
}
