"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/sesion";
import { rolDesdeModulosPermitidos } from "@/lib/ingreso";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import type { UsuarioSesion } from "@/lib/usuarioSesion";
import {
  crearContrasenaUsuarioSchema,
  ingresarUsuarioSchema,
} from "@/lib/validations/ingreso";
import {
  crearContrasenaInicial,
  ingresarUsuario,
  listarUsuariosIngreso,
  type UsuarioIngresoItem,
} from "@/services/ingreso.service";

async function abrirSesion(usuario: UsuarioSesion): Promise<void> {
  const sesion = await getSesion();
  sesion.idPersonal = usuario.idPersonal;
  sesion.rol = rolDesdeModulosPermitidos(usuario.modulosPermitidos);
  await sesion.save();
  revalidatePath("/", "layout");
}

/** Pantalla de ingreso: pública (todavía no hay sesión). No expone hashes. */
export async function listarUsuariosIngresoAction(): Promise<
  ActionResult<UsuarioIngresoItem[]>
> {
  return fromServiceResult(await listarUsuariosIngreso());
}

export async function ingresarUsuarioAction(
  raw: unknown
): Promise<ActionResult<UsuarioSesion>> {
  const parsed = ingresarUsuarioSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await ingresarUsuario(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    await abrirSesion(res.data);
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[sesion][ingresar]", e);
    return { ok: false, error: "No se pudo ingresar." };
  }
}

export async function crearContrasenaUsuarioAction(
  raw: unknown
): Promise<ActionResult<UsuarioSesion>> {
  const parsed = crearContrasenaUsuarioSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await crearContrasenaInicial(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    await abrirSesion(res.data);
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[sesion][crearContrasena]", e);
    return { ok: false, error: "No se pudo crear la contraseña." };
  }
}

export async function cerrarSesionAction(): Promise<ActionResult<void>> {
  const sesion = await getSesion();
  sesion.destroy();
  return { ok: true, data: undefined };
}
