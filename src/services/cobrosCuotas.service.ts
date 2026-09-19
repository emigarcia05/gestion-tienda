import { prisma } from "@/lib/prisma";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type {
  CrearCobrosCuotaInput,
  EditarCobrosCuotaInput,
} from "@/lib/validations/cobrosCuota";
import type { ServiceResult } from "@/types/service.types";

const CUOTA_SELECT = { id: true, cantidad: true, orden: true } as const;

function mapCuota(row: {
  id: string;
  cantidad: number;
  orden: number;
}): CobrosCuotaItem {
  return {
    id: row.id,
    cantidad: row.cantidad,
    orden: row.orden,
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe una cuota con esa cantidad.";
    if (code === "P2003") return "No se puede eliminar: hay registros asociados.";
    if (code === "P2025") return "Cuota no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarCobrosCuotas(): Promise<CobrosCuotaItem[]> {
  const rows = await prisma.cobrosCuota.findMany({
    orderBy: [{ orden: "asc" }, { cantidad: "asc" }],
    select: CUOTA_SELECT,
  });
  return rows.map(mapCuota);
}

export async function crearCobrosCuota(
  input: CrearCobrosCuotaInput
): Promise<ServiceResult<CobrosCuotaItem>> {
  try {
    const maxOrden = await prisma.cobrosCuota.aggregate({
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;

    const created = await prisma.cobrosCuota.create({
      data: { cantidad: input.cantidad, orden },
      select: CUOTA_SELECT,
    });
    return { success: true, data: mapCuota(created) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo crear la cuota.") };
  }
}

export async function editarCobrosCuota(
  input: EditarCobrosCuotaInput
): Promise<ServiceResult<CobrosCuotaItem>> {
  try {
    const updated = await prisma.cobrosCuota.update({
      where: { id: input.id },
      data: { cantidad: input.cantidad },
      select: CUOTA_SELECT,
    });
    return { success: true, data: mapCuota(updated) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo editar la cuota.") };
  }
}

export async function eliminarCobrosCuota(
  id: string
): Promise<ServiceResult<void>> {
  try {
    await prisma.cobrosCuota.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar la cuota.") };
  }
}
