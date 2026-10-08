import { prisma } from "@/lib/prisma";
import type { EstPorProdColorItem } from "@/lib/estPorProdColores";
import type {
  CrearEstPorProdColorInput,
  EditarEstPorProdColorInput,
} from "@/lib/validations/estPorProdColores";
import type { ServiceResult } from "@/types";

function normalizarNombreColor(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe un color con ese nombre.";
    if (code === "P2025") return "Color no encontrado.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarEstPorProdColores(): Promise<EstPorProdColorItem[]> {
  try {
    const rows = await prisma.prodColor.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    });
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre.toLocaleUpperCase("es-AR"),
    }));
  } catch (e: unknown) {
    console.error("[estPorProdColores.service] listarEstPorProdColores:", e);
    return [];
  }
}

export async function crearEstPorProdColor(
  input: CrearEstPorProdColorInput
): Promise<ServiceResult<EstPorProdColorItem>> {
  const nombre = normalizarNombreColor(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  try {
    const created = await prisma.prodColor.create({
      data: { nombre },
      select: { id: true, nombre: true },
    });
    return { success: true, data: { id: created.id, nombre: created.nombre } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear el color."),
    };
  }
}

export async function editarEstPorProdColor(
  input: EditarEstPorProdColorInput
): Promise<ServiceResult<EstPorProdColorItem>> {
  const nombre = normalizarNombreColor(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  try {
    const updated = await prisma.prodColor.update({
      where: { id: input.id },
      data: { nombre },
      select: { id: true, nombre: true },
    });
    return { success: true, data: { id: updated.id, nombre: updated.nombre } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar el color."),
    };
  }
}

export async function eliminarEstPorProdColor(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.prodColor.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar el color."),
    };
  }
}
