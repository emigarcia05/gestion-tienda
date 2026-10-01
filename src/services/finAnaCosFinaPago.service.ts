import { prisma } from "@/lib/prisma";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type {
  CrearFinAnaCosFinaPagoInput,
  EditarFinAnaCosFinaPagoInput,
} from "@/lib/validations/finAnaCosFinaPago";
import { sincronizarMatrizFinAnaCosFina } from "@/services/finAnaCosFinaMatriz.service";
import type { ServiceResult } from "@/types";

const pagoSelect = {
  id: true,
  nombre: true,
  enCostosFinancieros: true,
  enMargenContribucion: true,
  entidadObligatoria: true,
  entidades: {
    orderBy: { entidad: { nombre: "asc" as const } },
    select: {
      entidadId: true,
      entidad: { select: { nombre: true } },
    },
  },
} as const;

type PagoRowConEntidades = {
  id: string;
  nombre: string;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  entidadObligatoria: boolean;
  entidades: { entidadId: string; entidad: { nombre: string } }[];
};

function mapPago(
  row: PagoRowConEntidades,
  cuotaIdsPorEntidad: Record<string, string[]>
): FinAnaCosFinaPagoItem {
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    enCostosFinancieros: row.enCostosFinancieros,
    enMargenContribucion: row.enMargenContribucion,
    entidadObligatoria: row.entidadObligatoria,
    entidadIds: row.entidades.map((e) => e.entidadId),
    entidadNombres: row.entidades.map((e) => e.entidad.nombre.toUpperCase()),
    cuotaIdsPorEntidad,
  };
}

function normalizarNombrePago(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

async function cuotaIdsPorEntidadDePago(
  pagoId: string
): Promise<Record<string, string[]>> {
  const filas = await prisma.finAnaCosFina.findMany({
    where: { pagoId, cuotaId: { not: null }, habilitado: true },
    select: { terminalId: true, cuotaId: true },
  });
  const out = new Map<string, Set<string>>();
  for (const fila of filas) {
    if (!fila.cuotaId) continue;
    const set = out.get(fila.terminalId) ?? new Set<string>();
    set.add(fila.cuotaId);
    out.set(fila.terminalId, set);
  }
  const record: Record<string, string[]> = {};
  for (const [entidadId, ids] of out.entries()) {
    record[entidadId] = [...ids].sort((a, b) => a.localeCompare(b, "es"));
  }
  return record;
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe un pago con ese nombre.";
    if (code === "P2003") return "Hay entidades inválidas o asociadas.";
    if (code === "P2025") return "Forma de pago no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

const PAGOS_SEMILLA: {
  id: string;
  nombre: string;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
}[] = [
  {
    id: "clfinapago0000008efe",
    nombre: "EFECTIVO",
    enCostosFinancieros: false,
    enMargenContribucion: true,
  },
  {
    id: "clfinapago0000001deb",
    nombre: "DÉBITO",
    enCostosFinancieros: true,
    enMargenContribucion: true,
  },
  {
    id: "clfinapago0000002c01",
    nombre: "CRÉDITO",
    enCostosFinancieros: true,
    enMargenContribucion: true,
  },
];

async function resolverEntidadIdsExistentes(
  entidadIds: string[],
  entidadObligatoria: boolean
): Promise<ServiceResult<string[]>> {
  const unique = [...new Set(entidadIds)];
  if (unique.length === 0) {
    if (entidadObligatoria) {
      return { success: false, error: "Seleccioná al menos una entidad." };
    }
    return { success: true, data: [] };
  }
  const encontradas = await prisma.finAnaCosFinaTerminalMarca.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  if (encontradas.length !== unique.length) {
    return { success: false, error: "Hay entidades inválidas." };
  }
  return { success: true, data: unique };
}

export async function ensureFinAnaCosFinaPagosSeed(): Promise<void> {
  const count = await prisma.finAnaCosFinaPagoCat.count();
  if (count > 0) return;

  await prisma.finAnaCosFinaPagoCat.createMany({
    data: PAGOS_SEMILLA,
    skipDuplicates: true,
  });

  const entidades = await prisma.finAnaCosFinaTerminalMarca.findMany({
    select: { id: true },
  });
  if (entidades.length === 0) return;

  const pagos = await prisma.finAnaCosFinaPagoCat.findMany({ select: { id: true } });
  await prisma.cobrosFormaPagoEntidad.createMany({
    data: pagos.flatMap((p) =>
      entidades.map((e) => ({ pagoId: p.id, entidadId: e.id }))
    ),
    skipDuplicates: true,
  });
}

export async function listarFinAnaCosFinaPagos(): Promise<FinAnaCosFinaPagoItem[]> {
  await ensureFinAnaCosFinaPagosSeed();
  const [rows, matrizCuotas] = await Promise.all([
    prisma.finAnaCosFinaPagoCat.findMany({
      orderBy: [{ nombre: "asc" }],
      select: pagoSelect,
    }),
    prisma.finAnaCosFina.findMany({
      where: { cuotaId: { not: null }, habilitado: true },
      select: { pagoId: true, terminalId: true, cuotaId: true },
    }),
  ]);

  const cuotasPorPago = new Map<string, Map<string, Set<string>>>();
  for (const fila of matrizCuotas) {
    if (!fila.cuotaId) continue;
    const porEntidad = cuotasPorPago.get(fila.pagoId) ?? new Map<string, Set<string>>();
    const cuotas = porEntidad.get(fila.terminalId) ?? new Set<string>();
    cuotas.add(fila.cuotaId);
    porEntidad.set(fila.terminalId, cuotas);
    cuotasPorPago.set(fila.pagoId, porEntidad);
  }

  return rows.map((row) => {
    const porEntidad = cuotasPorPago.get(row.id);
    const cuotaIdsPorEntidad: Record<string, string[]> = {};
    for (const entidad of row.entidades) {
      const ids = [...(porEntidad?.get(entidad.entidadId) ?? new Set<string>())];
      ids.sort((a, b) => a.localeCompare(b, "es"));
      cuotaIdsPorEntidad[entidad.entidadId] = ids;
    }
    return mapPago(row, cuotaIdsPorEntidad);
  });
}

export async function crearFinAnaCosFinaPago(
  input: CrearFinAnaCosFinaPagoInput
): Promise<ServiceResult<FinAnaCosFinaPagoItem>> {
  const nombre = normalizarNombrePago(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  const entidadesOk = await resolverEntidadIdsExistentes(
    input.entidadIds,
    input.entidadObligatoria
  );
  if (!entidadesOk.success) return entidadesOk;
  const entidadIds = entidadesOk.data;

  try {
    const pago = await prisma.$transaction(async (tx) => {
      const created = await tx.finAnaCosFinaPagoCat.create({
        data: {
          nombre,
          enCostosFinancieros: true,
          enMargenContribucion: true,
          entidadObligatoria: input.entidadObligatoria,
          entidades:
            entidadIds.length === 0
              ? undefined
              : {
                  create: entidadIds.map((entidadId) => ({ entidadId })),
                },
        },
        select: pagoSelect,
      });

      if (created.enMargenContribucion) {
        await tx.finAnaMcDescuentoFp.upsert({
          where: { pagoId: created.id },
          create: { pagoId: created.id, descuentoPct: 0 },
          update: {},
        });
      }

      await sincronizarMatrizFinAnaCosFina(tx);
      return created;
    });

    return {
      success: true,
      data: mapPago(pago, await cuotaIdsPorEntidadDePago(pago.id)),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la forma de pago."),
    };
  }
}

export async function editarFinAnaCosFinaPago(
  input: EditarFinAnaCosFinaPagoInput
): Promise<ServiceResult<FinAnaCosFinaPagoItem>> {
  const nombre = normalizarNombrePago(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  const entidadesOk = await resolverEntidadIdsExistentes(
    input.entidadIds,
    input.entidadObligatoria
  );
  if (!entidadesOk.success) return entidadesOk;
  const entidadIds = entidadesOk.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.finAnaCosFinaPagoCat.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw Object.assign(new Error("Forma de pago no encontrada."), { code: "P2025" });
      }

      if (entidadIds.length === 0) {
        await tx.cobrosFormaPagoEntidad.deleteMany({ where: { pagoId: input.id } });
      } else {
        await tx.cobrosFormaPagoEntidad.deleteMany({
          where: {
            pagoId: input.id,
            entidadId: { notIn: entidadIds },
          },
        });
        await tx.cobrosFormaPagoEntidad.createMany({
          data: entidadIds.map((entidadId) => ({ pagoId: input.id, entidadId })),
          skipDuplicates: true,
        });
      }

      const row = await tx.finAnaCosFinaPagoCat.update({
        where: { id: input.id },
        data: {
          nombre,
          entidadObligatoria: input.entidadObligatoria,
        },
        select: pagoSelect,
      });

      await sincronizarMatrizFinAnaCosFina(tx);
      return row;
    });

    return {
      success: true,
      data: mapPago(updated, await cuotaIdsPorEntidadDePago(updated.id)),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo editar la forma de pago."),
    };
  }
}

export async function eliminarFinAnaCosFinaPago(
  id: string
): Promise<ServiceResult<void>> {
  try {
    const count = await prisma.finAnaCosFinaPagoCat.count();
    if (count <= 1) {
      return {
        success: false,
        error: "Debe quedar al menos una forma de pago.",
      };
    }

    await prisma.finAnaCosFinaPagoCat.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la forma de pago."),
    };
  }
}
