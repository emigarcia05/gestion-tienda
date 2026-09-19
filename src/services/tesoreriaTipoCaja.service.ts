import type { TipoCajaTesoreria } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizarCodigoTipoCaja,
  normalizarNombreTipoCaja,
  type TesoreriaTipoCajaItem,
} from "@/lib/cajasTesoreriaTipoCaja";
import type { ServiceResult } from "@/types";

function mapTipoCaja(row: {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
}): TesoreriaTipoCajaItem {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre.toLocaleUpperCase("es-AR"),
    orden: row.orden,
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe un tipo de caja con ese código.";
    if (code === "P2025") return "Tipo de caja no encontrado.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarTesoreriaTipoCaja(): Promise<TesoreriaTipoCajaItem[]> {
  const rows = await prisma.finTesoreriaTipoCaja.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, codigo: true, nombre: true, orden: true },
  });
  return rows.map(mapTipoCaja);
}

export async function crearTesoreriaTipoCaja(input: {
  codigo: string;
  nombre: string;
  orden?: number;
}): Promise<ServiceResult<TesoreriaTipoCajaItem>> {
  const codigo = normalizarCodigoTipoCaja(input.codigo);
  const nombre = normalizarNombreTipoCaja(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  let orden = input.orden;
  if (orden == null) {
    const max = await prisma.finTesoreriaTipoCaja.aggregate({ _max: { orden: true } });
    orden = (max._max.orden ?? 0) + 10;
  }

  try {
    const row = await prisma.finTesoreriaTipoCaja.create({
      data: { codigo, nombre, orden },
      select: { id: true, codigo: true, nombre: true, orden: true },
    });
    return { success: true, data: mapTipoCaja(row) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo crear el tipo de caja.") };
  }
}

export async function editarTesoreriaTipoCaja(input: {
  id: string;
  nombre: string;
  orden?: number;
}): Promise<ServiceResult<TesoreriaTipoCajaItem>> {
  const nombre = normalizarNombreTipoCaja(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const row = await prisma.finTesoreriaTipoCaja.update({
      where: { id: input.id },
      data: {
        nombre,
        ...(input.orden != null ? { orden: input.orden } : {}),
      },
      select: { id: true, codigo: true, nombre: true, orden: true },
    });
    return { success: true, data: mapTipoCaja(row) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo editar el tipo de caja.") };
  }
}

export async function eliminarTesoreriaTipoCaja(id: string): Promise<ServiceResult<void>> {
  const existing = await prisma.finTesoreriaTipoCaja.findUnique({
    where: { id },
    select: { codigo: true },
  });
  if (!existing) {
    return { success: false, error: "Tipo de caja no encontrado." };
  }

  const enUso = await prisma.cajaTesoreria.count({
    where: { tipoCaja: existing.codigo as TipoCajaTesoreria },
  });
  if (enUso > 0) {
    return {
      success: false,
      error: "No se puede eliminar: hay cajas que usan este tipo.",
    };
  }

  try {
    await prisma.finTesoreriaTipoCaja.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar el tipo de caja.") };
  }
}
