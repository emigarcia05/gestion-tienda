import { prisma } from "@/lib/prisma";
import type { CobrosBancoItem } from "@/lib/cobrosBancos";
import type {
  CrearCobrosBancoInput,
  EditarCobrosBancoInput,
} from "@/lib/validations/cobrosBancos";
import type { ServiceResult } from "@/types";

const BANCO_SELECT = { id: true, nombre: true, orden: true } as const;

function mapBanco(row: { id: string; nombre: string; orden: number }): CobrosBancoItem {
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    orden: row.orden,
  };
}

function normalizarNombreBanco(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe un banco con ese nombre.";
    if (code === "P2003") return "No se puede eliminar: hay registros asociados.";
    if (code === "P2025") return "Banco no encontrado.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarCobrosBancos(): Promise<CobrosBancoItem[]> {
  const rows = await prisma.cobrosBanco.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: BANCO_SELECT,
  });
  return rows.map(mapBanco);
}

export async function crearCobrosBanco(
  input: CrearCobrosBancoInput
): Promise<ServiceResult<CobrosBancoItem>> {
  const nombre = normalizarNombreBanco(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const maxOrden = await prisma.cobrosBanco.aggregate({
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;
    const created = await prisma.cobrosBanco.create({
      data: { nombre, orden },
      select: BANCO_SELECT,
    });
    return { success: true, data: mapBanco(created) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo crear el banco.") };
  }
}

export async function editarCobrosBanco(
  input: EditarCobrosBancoInput
): Promise<ServiceResult<CobrosBancoItem>> {
  const nombre = normalizarNombreBanco(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const updated = await prisma.cobrosBanco.update({
      where: { id: input.id },
      data: { nombre },
      select: BANCO_SELECT,
    });
    return { success: true, data: mapBanco(updated) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo editar el banco.") };
  }
}

export async function eliminarCobrosBanco(id: string): Promise<ServiceResult<void>> {
  try {
    await prisma.cobrosBanco.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar el banco.") };
  }
}
