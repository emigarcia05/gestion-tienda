import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type {
  CrearCobrosCuotaInput,
  EditarCobrosCuotaInput,
} from "@/lib/validations/cobrosCuota";
import { sincronizarMatrizFinAnaCosFina } from "@/services/finAnaCosFinaMatriz.service";
import type { ServiceResult } from "@/types/service.types";

const CUOTA_SELECT = {
  id: true,
  cuotas: true,
  pagoId: true,
  entidadId: true,
  pago: { select: { nombre: true } },
  entidad: { select: { nombre: true } },
} as const;

type CuotaRow = {
  id: string;
  cuotas: string;
  pagoId: string;
  entidadId: string;
  pago: { nombre: string };
  entidad: { nombre: string };
};

function mapCuota(row: CuotaRow): CobrosCuotaItem {
  return {
    id: row.id,
    cuotas: row.cuotas,
    pagoId: row.pagoId,
    pagoNombre: row.pago.nombre,
    entidadId: row.entidadId,
    entidadNombre: row.entidad.nombre,
  };
}

function compararCuotas(a: CobrosCuotaItem, b: CobrosCuotaItem): number {
  const porPago = a.pagoNombre.localeCompare(b.pagoNombre, "es");
  if (porPago !== 0) return porPago;
  const porEntidad = a.entidadNombre.localeCompare(b.entidadNombre, "es");
  if (porEntidad !== 0) return porEntidad;
  return a.cuotas.localeCompare(b.cuotas, "es");
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe esa cuota para esta forma de pago y entidad.";
    if (code === "P2003") return "La forma de pago o la entidad no existen.";
    if (code === "P2025") return "Cuota no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

async function assertParCuota(
  tx: Prisma.TransactionClient,
  pagoId: string,
  entidadId: string
): Promise<string | null> {
  const pago = await tx.finAnaCosFinaPagoCat.findUnique({
    where: { id: pagoId },
    select: { id: true, aceptaCuotas: true },
  });
  if (!pago) return "Forma de pago no encontrada.";
  if (!pago.aceptaCuotas) {
    await tx.finAnaCosFinaPagoCat.update({
      where: { id: pagoId },
      data: { aceptaCuotas: true },
    });
  }
  const vinculo = await tx.cobrosFormaPagoEntidad.findUnique({
    where: { pagoId_entidadId: { pagoId, entidadId } },
    select: { pagoId: true },
  });
  if (!vinculo) return "La entidad no está vinculada a esa forma de pago.";
  return null;
}

export async function listarCobrosCuotas(): Promise<CobrosCuotaItem[]> {
  const rows = await prisma.cobrosCuota.findMany({ select: CUOTA_SELECT });
  return rows.map(mapCuota).sort(compararCuotas);
}

export async function crearCobrosCuota(
  input: CrearCobrosCuotaInput
): Promise<ServiceResult<CobrosCuotaItem>> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const parError = await assertParCuota(tx, input.pagoId, input.entidadId);
      if (parError) throw new Error(parError);
      const row = await tx.cobrosCuota.create({
        data: {
          cuotas: input.cuotas,
          pagoId: input.pagoId,
          entidadId: input.entidadId,
        },
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
    const updated = await prisma.$transaction(async (tx) => {
      const parError = await assertParCuota(tx, input.pagoId, input.entidadId);
      if (parError) throw new Error(parError);
      const row = await tx.cobrosCuota.update({
        where: { id: input.id },
        data: {
          cuotas: input.cuotas,
          pagoId: input.pagoId,
          entidadId: input.entidadId,
        },
        select: CUOTA_SELECT,
      });
      await sincronizarMatrizFinAnaCosFina(tx);
      return row;
    });
    return { success: true, data: mapCuota(updated) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo editar la cuota.") };
  }
}

export async function eliminarCobrosCuota(id: string): Promise<ServiceResult<void>> {
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
