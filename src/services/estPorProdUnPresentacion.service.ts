import { prisma } from "@/lib/prisma";
import type {
  EstPorProdPosicionUnidad,
  EstPorProdUnPresentacionItem,
} from "@/lib/estPorProdUnPresentacion";
import type {
  CrearEstPorProdUnPresentacionInput,
  EditarEstPorProdUnPresentacionInput,
} from "@/lib/validations/estPorProdUnPresentacion";
import type { ServiceResult } from "@/types";

function normalizarUnidad(unidad: string): string {
  return unidad.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function mapRow(r: {
  id: string;
  unidad: string;
  posicionUnidad: EstPorProdPosicionUnidad;
  suma: boolean;
}): EstPorProdUnPresentacionItem {
  return {
    id: r.id,
    unidad: r.unidad.toLocaleUpperCase("es-AR"),
    posicionUnidad: r.posicionUnidad,
    suma: r.suma,
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
    if (code === "P2002") return "Ya existe esa unidad.";
    if (code === "P2025") return "Unidad no encontrada.";
    if (code === "P2003") {
      return "No se puede eliminar: hay presentaciones que usan esta unidad.";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarEstPorProdUnPresentaciones(): Promise<
  EstPorProdUnPresentacionItem[]
> {
  try {
    const rows = await prisma.prodPresentacionUnidad.findMany({
      orderBy: { unidad: "asc" },
      select: { id: true, unidad: true, posicionUnidad: true, suma: true },
    });
    return rows.map(mapRow);
  } catch (e: unknown) {
    console.error(
      "[estPorProdUnPresentacion.service] listarEstPorProdUnPresentaciones:",
      e
    );
    return [];
  }
}

export async function crearEstPorProdUnPresentacion(
  input: CrearEstPorProdUnPresentacionInput
): Promise<ServiceResult<EstPorProdUnPresentacionItem>> {
  const unidad = normalizarUnidad(input.unidad);
  if (!unidad) {
    return { success: false, error: "La unidad no puede quedar vacía." };
  }
  try {
    const created = await prisma.prodPresentacionUnidad.create({
      data: {
        unidad,
        posicionUnidad: input.posicionUnidad,
        suma: input.suma,
      },
      select: { id: true, unidad: true, posicionUnidad: true, suma: true },
    });
    return { success: true, data: mapRow(created) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la unidad."),
    };
  }
}

export async function editarEstPorProdUnPresentacion(
  input: EditarEstPorProdUnPresentacionInput
): Promise<ServiceResult<EstPorProdUnPresentacionItem>> {
  const unidad = normalizarUnidad(input.unidad);
  if (!unidad) {
    return { success: false, error: "La unidad no puede quedar vacía." };
  }
  try {
    const updated = await prisma.prodPresentacionUnidad.update({
      where: { id: input.id },
      data: {
        unidad,
        posicionUnidad: input.posicionUnidad,
        suma: input.suma,
      },
      select: { id: true, unidad: true, posicionUnidad: true, suma: true },
    });
    return { success: true, data: mapRow(updated) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar la unidad."),
    };
  }
}

export async function eliminarEstPorProdUnPresentacion(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.prodPresentacionUnidad.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la unidad."),
    };
  }
}
