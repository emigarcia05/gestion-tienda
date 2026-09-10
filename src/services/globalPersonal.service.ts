import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import type { MainAppAreaId } from "@/lib/main-app-areas";
import { ordenarModulosPermitidos } from "@/lib/usuarios";
import { parseSucursalPreferida, type SucursalPreferida } from "@/lib/sucursalPreferida";

export interface GlobalPersonalItem {
  idPersonal: number;
  nombrePersonal: string;
  sucursalPorDefecto: SucursalPreferida | null;
  modulosPermitidos: MainAppAreaId[];
  titularFinanciero: boolean;
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
    select: {
      idPersonal: true,
      nombrePersonal: true,
      sucursalPorDefecto: true,
      modulosPermitidos: true,
      titularFinanciero: true,
    },
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

export async function actualizarUsuarioPersonal(input: {
  idPersonal: number;
  sucursalPorDefecto: SucursalPreferida;
  modulosPermitidos: MainAppAreaId[];
  titularFinanciero: boolean;
}): Promise<ServiceResult<GlobalPersonalItem>> {
  try {
    const existente = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.idPersonal },
      select: { idPersonal: true },
    });
    if (!existente) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: input.sucursalPorDefecto },
      select: { codigo: true },
    });
    if (!sucursal) {
      return { success: false, error: "Sucursal inválida." };
    }

    const row = await prisma.globalPersonal.update({
      where: { idPersonal: input.idPersonal },
      data: {
        sucursalPorDefecto: input.sucursalPorDefecto,
        modulosPermitidos: ordenarModulosPermitidos(input.modulosPermitidos),
        titularFinanciero: input.titularFinanciero,
      },
      select: {
        idPersonal: true,
        nombrePersonal: true,
        sucursalPorDefecto: true,
        modulosPermitidos: true,
        titularFinanciero: true,
      },
    });
    return { success: true, data: mapRow(row) };
  } catch (e) {
    console.error("[actualizarUsuarioPersonal]", e);
    return { success: false, error: "Error al guardar el usuario." };
  }
}
