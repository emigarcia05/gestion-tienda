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
  idDux: string | null;
  sucursalPorDefecto: SucursalPreferida | null;
  modulosPermitidos: MainAppAreaId[];
  titularFinanciero: boolean;
}

const PERSONAL_SELECT = {
  idPersonal: true,
  nombrePersonal: true,
  idDux: true,
  sucursalPorDefecto: true,
  modulosPermitidos: true,
  titularFinanciero: true,
} as const;

function normalizarNombrePersonal(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function p2002TargetIncludes(error: unknown, field: string): boolean {
  if (!error || typeof error !== "object" || !("meta" in error)) return false;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;
  if (Array.isArray(target)) {
    return target.some((t) => typeof t === "string" && t === field);
  }
  return typeof target === "string" && target.includes(field);
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      if (p2002TargetIncludes(error, "id_dux")) {
        return "Ya existe un usuario con ese ID DUX.";
      }
      return "Ya existe un usuario con esos datos.";
    }
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
  idDux: string | null;
  sucursalPorDefecto: string | null;
  modulosPermitidos: string[];
  titularFinanciero: boolean;
}): GlobalPersonalItem {
  return {
    idPersonal: row.idPersonal,
    nombrePersonal: row.nombrePersonal,
    idDux: row.idDux,
    sucursalPorDefecto: parseSucursalPreferida(row.sucursalPorDefecto),
    modulosPermitidos: ordenarModulosPermitidos(row.modulosPermitidos),
    titularFinanciero: row.titularFinanciero,
  };
}

/** Nombres de `global_personal` con `titular_financiero = true` (tesorería / tenedor). */
export async function listNombresTitularesFinancieros(): Promise<string[]> {
  const rows = await prisma.globalPersonal.findMany({
    where: { titularFinanciero: true },
    orderBy: { nombrePersonal: "asc" },
    select: { nombrePersonal: true },
  });
  const seen = new Set<string>();
  const nombres: string[] = [];
  for (const row of rows) {
    const nombre = normalizarNombrePersonal(row.nombrePersonal);
    if (!nombre || seen.has(nombre)) continue;
    seen.add(nombre);
    nombres.push(nombre);
  }
  return nombres;
}

/**
 * Resuelve el nombre canónico de un titular financiero.
 * `permitirNombre` deja pasar un valor ya persistido (edición de caja/cheque legado).
 */
export async function resolverNombreTitularFinanciero(
  raw: string,
  permitirNombre?: string
): Promise<ServiceResult<string>> {
  const nombre = normalizarNombrePersonal(raw);
  if (!nombre) {
    return { success: false, error: "Seleccioná un titular válido." };
  }
  if (permitirNombre && normalizarNombrePersonal(permitirNombre) === nombre) {
    return { success: true, data: nombre };
  }
  const row = await prisma.globalPersonal.findFirst({
    where: { titularFinanciero: true, nombrePersonal: nombre },
    select: { nombrePersonal: true },
  });
  if (!row) {
    return { success: false, error: "Seleccioná un titular financiero válido." };
  }
  return { success: true, data: row.nombrePersonal };
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
        nombrePersonal: nombre,
        idDux: input.idDux,
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
        idDux: input.idDux,
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
