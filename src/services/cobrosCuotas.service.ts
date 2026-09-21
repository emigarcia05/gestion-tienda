import { prisma } from "@/lib/prisma";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type {
  CrearCobrosCuotaInput,
  EditarCobrosCuotaInput,
} from "@/lib/validations/cobrosCuota";
import { sincronizarMatrizFinAnaCosFina } from "@/services/finAnaCosFinaMatriz.service";
import type { ServiceResult } from "@/types/service.types";

const CUOTA_SELECT = { id: true, cuotas: true } as const;

function mapCuota(row: { id: string; cuotas: string }): CobrosCuotaItem {
  return {
    id: row.id,
    cuotas: row.cuotas,
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe una cuota con ese texto.";
    if (code === "P2003") return "No se puede eliminar: hay registros asociados.";
    if (code === "P2025") return "Cuota no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarCobrosCuotas(): Promise<CobrosCuotaItem[]> {
  const rows = await prisma.cobrosCuota.findMany({
    orderBy: [{ cuotas: "asc" }],
    select: CUOTA_SELECT,
  });
  return rows.map(mapCuota);
}

export async function crearCobrosCuota(
  input: CrearCobrosCuotaInput
): Promise<ServiceResult<CobrosCuotaItem>> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.cobrosCuota.create({
        data: { cuotas: input.cuotas },
        select: CUOTA_SELECT,
      });
      await sincronizarMatrizFinAnaCosFina(tx);
      return row;
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
      data: { cuotas: input.cuotas },
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
    await prisma.$transaction(async (tx) => {
      await tx.cobrosCuota.delete({ where: { id } });
      await sincronizarMatrizFinAnaCosFina(tx);
    });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar la cuota.") };
  }
}
