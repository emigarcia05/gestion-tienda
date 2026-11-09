import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  HORARIO_SUCURSAL_CERRADO,
} from "@/lib/horarioSucursal";
import {
  horarioSucursalSchema,
  type ActualizarSucursalCatalogoInput,
  type CrearSucursalCatalogoInput,
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
  /** `sucursales.maps`. */
  maps: string | null;
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
    if (code === "P2002") return "Ya existe una sucursal con ese código.";
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
      maps: true,
      horario: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    telefono: row.whatsapp,
    maps: row.maps,
    horario: horarioDesdeDb(row.horario),
  }));
}

function datosSucursal(input: {
  nombre: string;
  direccion: string;
  telefono: string;
  maps: string;
  horario: HorarioSucursal;
}) {
  return {
    nombre: input.nombre.trim().replace(/\s+/g, " "),
    direccion: textoONull(input.direccion),
    whatsapp: textoONull(input.telefono),
    maps: textoONull(input.maps),
    horario: input.horario as Prisma.InputJsonValue,
  };
}

export async function crearSucursalCatalogo(
  input: CrearSucursalCatalogoInput
): Promise<ServiceResult<void>> {
  try {
    await prisma.sucursal.create({
      data: {
        codigo: input.codigo,
        ...datosSucursal(input),
      },
    });
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[sucursalesCatalogo][crear]", e);
    return { success: false, error: mapDbError(e, "No se pudo crear la sucursal.") };
  }
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
      data: datosSucursal(input),
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
