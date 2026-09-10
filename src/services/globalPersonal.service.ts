import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import type { MainAppAreaId } from "@/lib/main-app-areas";
import { ordenarModulosPermitidos } from "@/lib/usuarios";
import { parseSucursalPreferida, type SucursalPreferida } from "@/lib/sucursalPreferida";
import type {
  ActualizarUsuarioPersonalInput,
  CrearUsuarioPersonalInput,
} from "@/lib/validations/globalPersonal";

export interface GlobalPersonalItem {
  idPersonal: number;
  nombrePersonal: string;
  sucursalPorDefecto: SucursalPreferida | null;
  modulosPermitidos: MainAppAreaId[];
  titularFinanciero: boolean;
}

const PERSONAL_SELECT = {
  idPersonal: true,
  nombrePersonal: true,
  sucursalPorDefecto: true,
  modulosPermitidos: true,
  titularFinanciero: true,
} as const;

function normalizarNombrePersonal(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe un usuario con ese ID Personal.";
    if (code === "P2003") return "Sucursal inválida.";
    if (code === "P2025") return "Usuario no encontrado.";
  }
  return error instanceof Error ? error.message : fallback;
}

async function validarSucursalOpcional(
  codigo: SucursalPreferida | null
): Promise<ServiceResult<void>> {
  if (!codigo) return { success: true, data: undefined };
  const sucursal = await prisma.sucursal.findUnique({
    where: { codigo },
    select: { codigo: true },
  });
  if (!sucursal) return { success: false, error: "Sucursal inválida." };
  return { success: true, data: undefined };
}

function mapRow(row: {
  idPersonal: number;
  nombrePersonal: string;
  sucursalPorDefecto: string | null;
  modulosPermitidos: string[];
  titularFinanciero: boolean;
}): GlobalPersonalItem {
  return {
    idPersonal: row.idPersonal,
    nombrePersonal: row.nombrePersonal,
    sucursalPorDefecto: parseSucursalPreferida(row.sucursalPorDefecto),
    modulosPermitidos: ordenarModulosPermitidos(row.modulosPermitidos),
    titularFinanciero: row.titularFinanciero,
  };
}

/** Lista el catálogo `global_personal` ordenado por nombre. */
export async function listGlobalPersonal(): Promise<GlobalPersonalItem[]> {
  const rows = await prisma.globalPersonal.findMany({
    orderBy: { nombrePersonal: "asc" },
    select: PERSONAL_SELECT,
  });
  return rows.map(mapRow);
}

/** Usuarios con sucursal por defecto y al menos un módulo (modal de inicio). */
export async function listUsuariosParaInicioSesion(): Promise<GlobalPersonalItem[]> {
  const items = await listGlobalPersonal();
  return items.filter(
    (item) => item.sucursalPorDefecto != null && item.modulosPermitidos.length > 0
  );
}

export async function crearUsuarioPersonal(
  input: CrearUsuarioPersonalInput
): Promise<ServiceResult<GlobalPersonalItem>> {
  const nombre = normalizarNombrePersonal(input.nombrePersonal);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  const sucursalOk = await validarSucursalOpcional(input.sucursalPorDefecto);
  if (!sucursalOk.success) return sucursalOk;

  try {
    const row = await prisma.globalPersonal.create({
      data: {
        idPersonal: input.idPersonal,
        nombrePersonal: nombre,
        sucursalPorDefecto: input.sucursalPorDefecto,
        modulosPermitidos: ordenarModulosPermitidos(input.modulosPermitidos),
        titularFinanciero: input.titularFinanciero,
      },
      select: PERSONAL_SELECT,
    });
    return { success: true, data: mapRow(row) };
  } catch (e) {
    console.error("[globalPersonal][crear]", e);
    return { success: false, error: mapDbError(e, "No se pudo crear el usuario.") };
  }
}

export async function actualizarUsuarioPersonal(
  input: ActualizarUsuarioPersonalInput
): Promise<ServiceResult<GlobalPersonalItem>> {
  try {
    const existente = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.idPersonal },
      select: { idPersonal: true },
    });
    if (!existente) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const sucursalOk = await validarSucursalOpcional(input.sucursalPorDefecto);
    if (!sucursalOk.success) return sucursalOk;

    const row = await prisma.globalPersonal.update({
      where: { idPersonal: input.idPersonal },
      data: {
        sucursalPorDefecto: input.sucursalPorDefecto,
        modulosPermitidos: ordenarModulosPermitidos(input.modulosPermitidos),
        titularFinanciero: input.titularFinanciero,
      },
      select: PERSONAL_SELECT,
    });
    return { success: true, data: mapRow(row) };
  } catch (e) {
    console.error("[globalPersonal][actualizar]", e);
    return { success: false, error: mapDbError(e, "Error al guardar el usuario.") };
  }
}
