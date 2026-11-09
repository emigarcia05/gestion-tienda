import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  HORARIO_SUCURSAL_CERRADO,
} from "@/lib/horarioSucursal";
import {
  horarioSucursalSchema,
  type ActualizarSucursalCatalogoInput,
  type EliminarSucursalCatalogoInput,
  type HorarioSucursal,
} from "@/lib/validations/sucursalCatalogo";
import type { ServiceResult } from "@/types/service.types";

export type SucursalCatalogoItem = {
  id: string;
  nombre: string;
  direccion: string | null;
  /** `sucursales.whatsapp`. */
  telefono: string | null;
  horario: HorarioSucursal;
};

function horarioDesdeDb(value: Prisma.JsonValue): HorarioSucursal {
  const parsed = horarioSucursalSchema.safeParse(value);
  return parsed.success ? parsed.data : HORARIO_SUCURSAL_CERRADO;
}

function textoONull(value: string): string | null {
  const texto = value.trim();
  return texto.length > 0 ? texto : null;
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") return "No se puede borrar: la sucursal está en uso.";
    if (code === "P2025") return "La sucursal no existe.";
  }
  return fallback;
}

export async function listarSucursalesCatalogo(): Promise<SucursalCatalogoItem[]> {
  const rows = await prisma.sucursal.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      direccion: true,
      whatsapp: true,
      horario: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    telefono: row.whatsapp,
    horario: horarioDesdeDb(row.horario),
  }));
}

export async function actualizarSucursalCatalogo(
  input: ActualizarSucursalCatalogoInput
): Promise<ServiceResult<void>> {
  try {
    const existe = await prisma.sucursal.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existe) return { success: false, error: "La sucursal no existe." };
    await prisma.sucursal.update({
      where: { id: input.id },
      data: {
        nombre: input.nombre.trim().replace(/\s+/g, " "),
        direccion: textoONull(input.direccion),
        whatsapp: textoONull(input.telefono),
        horario: input.horario as Prisma.InputJsonValue,
      },
    });
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[sucursalesCatalogo][actualizar]", e);
    return { success: false, error: mapDbError(e, "No se pudo guardar la sucursal.") };
  }
}

export async function eliminarSucursalCatalogo(
  input: EliminarSucursalCatalogoInput
): Promise<ServiceResult<void>> {
  try {
    await prisma.sucursal.delete({ where: { id: input.id } });
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[sucursalesCatalogo][eliminar]", e);
    return { success: false, error: mapDbError(e, "No se pudo borrar la sucursal.") };
  }
}
