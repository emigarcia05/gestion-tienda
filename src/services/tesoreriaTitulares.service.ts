import { prisma } from "@/lib/prisma";
import {
  normalizarNombreTitularCaja,
  type TesoreriaTitularItem,
} from "@/lib/cajasTesoreriaTitulares";
import type { ServiceResult } from "@/types";

function mapTitular(row: { id: string; nombre: string }): TesoreriaTitularItem {
  return {
    id: row.id,
    nombre: row.nombre.toLocaleUpperCase("es-AR"),
  };
}

function mapDbErrorTitular(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe un titular con ese nombre.";
    if (code === "P2025") return "Titular no encontrado.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarTesoreriaTitulares(): Promise<TesoreriaTitularItem[]> {
  const rows = await prisma.tesoreriaTitular.findMany({
    orderBy: [{ nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return rows.map(mapTitular);
}

export async function crearTesoreriaTitular(
  nombre: string
): Promise<ServiceResult<TesoreriaTitularItem>> {
  const norm = normalizarNombreTitularCaja(nombre);
  if (!norm) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  try {
    const row = await prisma.tesoreriaTitular.create({
      data: { nombre: norm },
      select: { id: true, nombre: true },
    });
    return { success: true, data: mapTitular(row) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbErrorTitular(error, "No se pudo crear el titular."),
    };
  }
}

export async function editarTesoreriaTitular(
  id: string,
  nombre: string
): Promise<ServiceResult<TesoreriaTitularItem>> {
  const norm = normalizarNombreTitularCaja(nombre);
  if (!norm) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  try {
    const row = await prisma.tesoreriaTitular.update({
      where: { id },
      data: { nombre: norm },
      select: { id: true, nombre: true },
    });
    return { success: true, data: mapTitular(row) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbErrorTitular(error, "No se pudo editar el titular."),
    };
  }
}

export async function eliminarTesoreriaTitular(id: string): Promise<ServiceResult<void>> {
  const existing = await prisma.tesoreriaTitular.findUnique({
    where: { id },
    select: { nombre: true },
  });
  if (!existing) {
    return { success: false, error: "Titular no encontrado." };
  }

  const nombre = existing.nombre;
  const [nPto, nCaja, nCheque] = await Promise.all([
    prisma.globalPtoVta.count({
      where: { nombreTitular: { equals: nombre, mode: "insensitive" } },
    }),
    prisma.cajaTesoreria.count({
      where: { titular: { equals: nombre, mode: "insensitive" } },
    }),
    prisma.finTesoreriaCheque.count({
      where: { tenedor: { equals: nombre, mode: "insensitive" } },
    }),
  ]);
  if (nPto > 0 || nCaja > 0 || nCheque > 0) {
    return {
      success: false,
      error: "No se puede eliminar: el titular figura en un punto de venta o en tesorería.",
    };
  }

  try {
    await prisma.tesoreriaTitular.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbErrorTitular(error, "No se pudo eliminar el titular."),
    };
  }
}
