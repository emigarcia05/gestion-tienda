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
  vinculos: {
    orderBy: [{ pago: { nombre: "asc" as const } }, { entidad: { nombre: "asc" as const } }],
    select: {
      pagoId: true,
      entidadId: true,
      pago: { select: { nombre: true } },
      entidad: { select: { nombre: true } },
    },
  },
} as const;

type CuotaRow = {
  id: string;
  cuotas: string;
  vinculos: {
    pagoId: string;
    entidadId: string;
    pago: { nombre: string };
    entidad: { nombre: string };
  }[];
};

function mapCuota(row: CuotaRow): CobrosCuotaItem {
  return {
    id: row.id,
    cuotas: row.cuotas,
    vinculos: row.vinculos.map((vinculo) => ({
      pagoId: vinculo.pagoId,
      pagoNombre: vinculo.pago.nombre,
      entidadId: vinculo.entidadId,
      entidadNombre: vinculo.entidad.nombre,
    })),
  };
}

function compararCuotas(a: CobrosCuotaItem, b: CobrosCuotaItem): number {
  return a.cuotas.localeCompare(b.cuotas, "es");
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe una cuota con ese texto.";
    if (code === "P2003") return "La forma de pago o la entidad no existen.";
    if (code === "P2025") return "Cuota no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

async function assertVinculos(
  tx: Prisma.TransactionClient,
  vinculos: { pagoId: string; entidadId: string }[]
): Promise<string | null> {
  const vistos = new Set<string>();
  for (const vinculo of vinculos) {
    const clave = `${vinculo.pagoId}:${vinculo.entidadId}`;
    if (vistos.has(clave)) return "Hay un par forma de pago y entidad repetido.";
    vistos.add(clave);
    const pago = await tx.finAnaCosFinaPagoCat.findUnique({
      where: { id: vinculo.pagoId },
      select: { id: true },
    });
    if (!pago) return "Forma de pago no encontrada.";
    const nexo = await tx.cobrosFormaPagoEntidad.findUnique({
      where: { pagoId_entidadId: { pagoId: vinculo.pagoId, entidadId: vinculo.entidadId } },
      select: { pagoId: true },
    });
    if (!nexo) return "La entidad no está vinculada a esa forma de pago.";
  }
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
      const parError = await assertVinculos(tx, input.vinculos);
      if (parError) throw new Error(parError);
      const row = await tx.cobrosCuota.create({
        data: {
          cuotas: input.cuotas,
          vinculos: {
            create: input.vinculos.map((vinculo) => ({
              pagoId: vinculo.pagoId,
              entidadId: vinculo.entidadId,
            })),
          },
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
      const parError = await assertVinculos(tx, input.vinculos);
      if (parError) throw new Error(parError);
      await tx.cobrosCuotaVinculo.deleteMany({ where: { cuotaId: input.id } });
      const row = await tx.cobrosCuota.update({
        where: { id: input.id },
        data: {
          cuotas: input.cuotas,
          vinculos: {
            create: input.vinculos.map((vinculo) => ({
              pagoId: vinculo.pagoId,
              entidadId: vinculo.entidadId,
            })),
          },
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
