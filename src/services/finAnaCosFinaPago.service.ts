import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type {
  CrearFinAnaCosFinaPagoInput,
  EditarFinAnaCosFinaPagoInput,
  ReordenarFinAnaCosFinaPagosInput,
} from "@/lib/validations/finAnaCosFinaPago";
import type { ServiceResult } from "@/types";

const pagoSelect = {
  id: true,
  nombre: true,
  orden: true,
  enCostosFinancieros: true,
  enMargenContribucion: true,
  asociadoTerminal: true,
  asociadoBanco: true,
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
  orden: number;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  asociadoTerminal: boolean;
  asociadoBanco: boolean;
  entidades: { entidadId: string; entidad: { nombre: string } }[];
};

function mapPago(row: PagoRowConEntidades): FinAnaCosFinaPagoItem {
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    orden: row.orden,
    enCostosFinancieros: row.enCostosFinancieros,
    enMargenContribucion: row.enMargenContribucion,
    asociadoTerminal: row.asociadoTerminal,
    asociadoBanco: row.asociadoBanco,
    entidadIds: row.entidades.map((e) => e.entidadId),
    entidadNombres: row.entidades.map((e) => e.entidad.nombre.toUpperCase()),
  };
}

function normalizarNombrePago(nombre: string): string {
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
    if (code === "P2002") return "Ya existe un pago con ese nombre.";
    if (code === "P2003") return "Hay entidades inválidas o asociadas.";
    if (code === "P2025") return "Forma de pago no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

const PAGOS_SEMILLA: {
  id: string;
  nombre: string;
  orden: number;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  asociadoTerminal: boolean;
  asociadoBanco: boolean;
}[] = [
  { id: "clfinapago0000008efe", nombre: "EFECTIVO", orden: 0, enCostosFinancieros: false, enMargenContribucion: true, asociadoTerminal: false, asociadoBanco: false },
  { id: "clfinapago0000001deb", nombre: "DÉBITO", orden: 1, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
  { id: "clfinapago0000002c01", nombre: "1 CUOTA", orden: 2, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
  { id: "clfinapago0000003c03", nombre: "3 CUOTAS", orden: 3, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
  { id: "clfinapago0000004c06", nombre: "6 CUOTAS", orden: 4, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
  { id: "clfinapago0000005c09", nombre: "9 CUOTAS", orden: 5, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
  { id: "clfinapago0000006c12", nombre: "12 CUOTAS", orden: 6, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
  { id: "clfinapago0000007c18", nombre: "18 CUOTAS", orden: 7, enCostosFinancieros: true, enMargenContribucion: true, asociadoTerminal: true, asociadoBanco: false },
];

async function resolverEntidadIdsExistentes(
  entidadIds: string[]
): Promise<ServiceResult<string[]>> {
  const unique = [...new Set(entidadIds)];
  if (unique.length === 0) {
    return { success: false, error: "Seleccioná al menos una entidad." };
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

async function sincronizarFilasCostosPago(
  tx: Prisma.TransactionClient,
  pagoId: string,
  entidadIds: string[],
  enCostosFinancieros: boolean
): Promise<void> {
  if (!enCostosFinancieros) {
    await tx.finAnaCosFina.deleteMany({ where: { pagoId } });
    return;
  }

  if (entidadIds.length === 0) {
    await tx.finAnaCosFina.deleteMany({ where: { pagoId } });
    return;
  }

  await tx.finAnaCosFina.deleteMany({
    where: {
      pagoId,
      terminalId: { notIn: entidadIds },
    },
  });

  await tx.finAnaCosFina.createMany({
    data: entidadIds.map((entidadId) => ({
      terminalId: entidadId,
      pagoId,
      habilitado: true,
      impCheque: false,
      arancel: new Prisma.Decimal(0),
      costoFinanciero: new Prisma.Decimal(0),
    })),
    skipDuplicates: true,
  });
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
  const rows = await prisma.finAnaCosFinaPagoCat.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: pagoSelect,
  });
  return rows.map(mapPago);
}

export async function crearFinAnaCosFinaPago(
  input: CrearFinAnaCosFinaPagoInput
): Promise<ServiceResult<FinAnaCosFinaPagoItem>> {
  const nombre = normalizarNombrePago(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  const entidadesOk = await resolverEntidadIdsExistentes(input.entidadIds);
  if (!entidadesOk.success) return entidadesOk;
  const entidadIds = entidadesOk.data;

  try {
    const maxOrden = await prisma.finAnaCosFinaPagoCat.aggregate({
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;

    const pago = await prisma.$transaction(async (tx) => {
      const created = await tx.finAnaCosFinaPagoCat.create({
        data: {
          nombre,
          orden,
          enCostosFinancieros: true,
          enMargenContribucion: true,
          asociadoTerminal: true,
          asociadoBanco: false,
          entidades: {
            create: entidadIds.map((entidadId) => ({ entidadId })),
          },
        },
        select: pagoSelect,
      });

      await sincronizarFilasCostosPago(
        tx,
        created.id,
        entidadIds,
        created.enCostosFinancieros
      );

      if (created.enMargenContribucion) {
        await tx.finAnaMcDescuentoFp.upsert({
          where: { pagoId: created.id },
          create: { pagoId: created.id, descuentoPct: 0 },
          update: {},
        });
      }

      return created;
    });

    return { success: true, data: mapPago(pago) };
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

  const entidadesOk = await resolverEntidadIdsExistentes(input.entidadIds);
  if (!entidadesOk.success) return entidadesOk;
  const entidadIds = entidadesOk.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.finAnaCosFinaPagoCat.findUnique({
        where: { id: input.id },
        select: { id: true, enCostosFinancieros: true },
      });
      if (!existing) {
        throw Object.assign(new Error("Forma de pago no encontrada."), { code: "P2025" });
      }

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

      const row = await tx.finAnaCosFinaPagoCat.update({
        where: { id: input.id },
        data: { nombre },
        select: pagoSelect,
      });

      await sincronizarFilasCostosPago(
        tx,
        input.id,
        entidadIds,
        existing.enCostosFinancieros
      );

      return row;
    });

    return { success: true, data: mapPago(updated) };
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

export async function reordenarFinAnaCosFinaPagos(
  input: ReordenarFinAnaCosFinaPagosInput
): Promise<ServiceResult<FinAnaCosFinaPagoItem[]>> {
  try {
    const pagos = await listarFinAnaCosFinaPagos();
    if (input.ordenIds.length !== pagos.length) {
      return { success: false, error: "El orden enviado no coincide con el catálogo." };
    }

    const idsExistentes = new Set(pagos.map((p) => p.id));
    if (!input.ordenIds.every((id) => idsExistentes.has(id))) {
      return { success: false, error: "Hay formas de pago inválidas en el orden." };
    }

    await prisma.$transaction(
      input.ordenIds.map((id, orden) =>
        prisma.finAnaCosFinaPagoCat.update({
          where: { id },
          data: { orden },
        })
      )
    );

    const actualizados = await listarFinAnaCosFinaPagos();
    return { success: true, data: actualizados };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo guardar el orden de las formas de pago."),
    };
  }
}
