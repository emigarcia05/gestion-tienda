import "server-only";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import { hashContrasena, verificarContrasena } from "@/lib/contrasena";
import { modulosEfectivosUsuario } from "@/lib/usuarios";
import { parseSucursalPreferida } from "@/lib/sucursalPreferida";
import { usuarioSesionDesdeItem, type UsuarioSesion } from "@/lib/usuarioSesion";
import type {
  CrearContrasenaUsuarioInput,
  IngresarUsuarioInput,
  RestablecerContrasenaUsuarioInput,
} from "@/lib/validations/ingreso";

/** Usuario elegible en la pantalla de ingreso (con sucursal y al menos un módulo). */
export type UsuarioIngresoItem = UsuarioSesion & { tieneContrasena: boolean };

const USUARIO_SELECT = {
  idPersonal: true,
  nombrePersonal: true,
  sucursalPorDefecto: true,
  modulosPermitidos: true,
  superUsuario: true,
} as const;

function aUsuarioSesion(row: {
  idPersonal: number;
  nombrePersonal: string;
  sucursalPorDefecto: string | null;
  modulosPermitidos: string[];
  superUsuario: boolean;
}): UsuarioSesion | null {
  return usuarioSesionDesdeItem({
    idPersonal: row.idPersonal,
    nombrePersonal: row.nombrePersonal,
    sucursalPorDefecto: parseSucursalPreferida(row.sucursalPorDefecto),
    modulosPermitidos: modulosEfectivosUsuario(row.modulosPermitidos, row.superUsuario),
  });
}

/** El hash nunca sale del servicio: solo `tieneContrasena`. */
export async function listarUsuariosIngreso(): Promise<ServiceResult<UsuarioIngresoItem[]>> {
  try {
    const rows = await prisma.globalPersonal.findMany({
      orderBy: { nombrePersonal: "asc" },
      select: { ...USUARIO_SELECT, contrasena: true },
    });
    const items: UsuarioIngresoItem[] = [];
    for (const row of rows) {
      const usuario = aUsuarioSesion(row);
      if (usuario) items.push({ ...usuario, tieneContrasena: row.contrasena != null });
    }
    return { success: true, data: items };
  } catch (e) {
    console.error("[ingreso][listarUsuarios]", e);
    return { success: false, error: "Error al listar usuarios." };
  }
}

/** Usuario vigente de la sesión (módulos frescos de la BD); null si ya no puede ingresar. */
export async function obtenerUsuarioSesion(idPersonal: number): Promise<UsuarioSesion | null> {
  const row = await prisma.globalPersonal.findUnique({
    where: { idPersonal },
    select: USUARIO_SELECT,
  });
  return row ? aUsuarioSesion(row) : null;
}

const ERROR_CREDENCIALES = "Contraseña incorrecta.";

export async function ingresarUsuario(
  input: IngresarUsuarioInput
): Promise<ServiceResult<UsuarioSesion>> {
  const row = await prisma.globalPersonal.findUnique({
    where: { idPersonal: input.idPersonal },
    select: { ...USUARIO_SELECT, contrasena: true },
  });
  const usuario = row ? aUsuarioSesion(row) : null;
  if (!row || !usuario) {
    return { success: false, error: "Usuario no habilitado para ingresar." };
  }
  if (row.contrasena == null) {
    return { success: false, error: "El usuario todavía no tiene contraseña. Creala para ingresar." };
  }
  const ok = await verificarContrasena(input.contrasena, row.contrasena);
  if (!ok) return { success: false, error: ERROR_CREDENCIALES };
  return { success: true, data: usuario };
}

/** Solo si el usuario no tiene contraseña (`updateMany` condicional: no pisa una existente). */
export async function crearContrasenaInicial(
  input: CrearContrasenaUsuarioInput
): Promise<ServiceResult<UsuarioSesion>> {
  const row = await prisma.globalPersonal.findUnique({
    where: { idPersonal: input.idPersonal },
    select: USUARIO_SELECT,
  });
  const usuario = row ? aUsuarioSesion(row) : null;
  if (!usuario) {
    return { success: false, error: "Usuario no habilitado para ingresar." };
  }
  const hash = await hashContrasena(input.contrasena);
  const res = await prisma.globalPersonal.updateMany({
    where: { idPersonal: input.idPersonal, contrasena: null },
    data: { contrasena: hash },
  });
  if (res.count === 0) {
    return { success: false, error: "El usuario ya tiene contraseña. Ingresala para continuar." };
  }
  return { success: true, data: usuario };
}

/** Borra el hash: en el próximo ingreso el usuario crea una nueva. */
export async function restablecerContrasenaUsuario(
  input: RestablecerContrasenaUsuarioInput
): Promise<ServiceResult<void>> {
  const res = await prisma.globalPersonal.updateMany({
    where: { idPersonal: input.idPersonal },
    data: { contrasena: null },
  });
  if (res.count === 0) return { success: false, error: "Usuario no encontrado." };
  return { success: true, data: undefined };
}
