import { prisma } from "@/lib/prisma";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type {
  CrearFinAnaCosFinaPagoInput,
  EditarFinAnaCosFinaPagoInput,
} from "@/lib/validations/finAnaCosFinaPago";
import { sincronizarMatrizFinAnaCosFina } from "@/services/finAnaCosFinaMatriz.service";
import type { ServiceResult } from "@/types";

<<<<<<< HEAD
const SELECT_PAGO = {
  id: true,
  nombre: true,
  orden: true,
  enCostosFinancieros: true,
  enMargenContribucion: true,
  asociadoTerminal: true,
  asociadoBanco: true,
} as const;

function mapPago(row: {
=======
const pagoSelect = {
  id: true,
  nombre: true,
  enCostosFinancieros: true,
  enMargenContribucion: true,
  aceptaCuotas: true,
  entidades: {
    orderBy: { entidad: { nombre: "asc" as const } },
    select: {
      entidadId: true,
      entidad: { select: { nombre: true } },
    },
  },
} as const;

type PagoRowConEntidades = {
>>>>>>> facturacion
  id: string;
  nombre: string;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
<<<<<<< HEAD
  asociadoTerminal: boolean;
  asociadoBanco: boolean;
}): FinAnaCosFinaPagoItem {
=======
  aceptaCuotas: boolean;
  entidades: { entidadId: string; entidad: { nombre: string } }[];
};

function mapPago(row: PagoRowConEntidades): FinAnaCosFinaPagoItem {
>>>>>>> facturacion
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    enCostosFinancieros: row.enCostosFinancieros,
    enMargenContribucion: row.enMargenContribucion,
<<<<<<< HEAD
    asociadoTerminal: row.asociadoTerminal,
    asociadoBanco: row.asociadoBanco,
=======
    aceptaCuotas: row.aceptaCuotas,
    entidadIds: row.entidades.map((e) => e.entidadId),
    entidadNombres: row.entidades.map((e) => e.entidad.nombre.toUpperCase()),
>>>>>>> facturacion
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
<<<<<<< HEAD
=======
    if (code === "P2003") return "Hay entidades inválidas o asociadas.";
>>>>>>> facturacion
    if (code === "P2025") return "Forma de pago no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

const PAGOS_SEMILLA: {
  id: string;
  nombre: string;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
<<<<<<< HEAD
  asociadoTerminal: boolean;
  asociadoBanco: boolean;
=======
  aceptaCuotas: boolean;
>>>>>>> facturacion
}[] = [
  {
    id: "clfinapago0000008efe",
    nombre: "EFECTIVO",
<<<<<<< HEAD
    orden: 0,
    enCostosFinancieros: false,
    enMargenContribucion: true,
    asociadoTerminal: false,
    asociadoBanco: false,
=======
    enCostosFinancieros: false,
    enMargenContribucion: true,
    aceptaCuotas: false,
>>>>>>> facturacion
  },
  {
    id: "clfinapago0000001deb",
    nombre: "DÉBITO",
<<<<<<< HEAD
    orden: 1,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000002c01",
    nombre: "1 CUOTA",
    orden: 2,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000003c03",
    nombre: "3 CUOTAS",
    orden: 3,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000004c06",
    nombre: "6 CUOTAS",
    orden: 4,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000005c09",
    nombre: "9 CUOTAS",
    orden: 5,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000006c12",
    nombre: "12 CUOTAS",
    orden: 6,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000007c18",
    nombre: "18 CUOTAS",
    orden: 7,
    enCostosFinancieros: true,
    enMargenContribucion: true,
    asociadoTerminal: true,
    asociadoBanco: false,
=======
    enCostosFinancieros: true,
    enMargenContribucion: true,
    aceptaCuotas: false,
  },
  {
    id: "clfinapago0000002c01",
    nombre: "CRÉDITO",
    enCostosFinancieros: true,
    enMargenContribucion: true,
    aceptaCuotas: true,
>>>>>>> facturacion
  },
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
<<<<<<< HEAD
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: SELECT_PAGO,
=======
    orderBy: [{ nombre: "asc" }],
    select: pagoSelect,
>>>>>>> facturacion
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

<<<<<<< HEAD
  try {
    const maxOrden = await prisma.finAnaCosFinaPagoCat.aggregate({
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;
=======
  const entidadesOk = await resolverEntidadIdsExistentes(input.entidadIds);
  if (!entidadesOk.success) return entidadesOk;
  const entidadIds = entidadesOk.data;
>>>>>>> facturacion

  try {
    const pago = await prisma.$transaction(async (tx) => {
      const created = await tx.finAnaCosFinaPagoCat.create({
        data: {
          nombre,
<<<<<<< HEAD
          orden,
          enCostosFinancieros: true,
          enMargenContribucion: true,
          asociadoTerminal: input.asociadoTerminal,
          asociadoBanco: input.asociadoBanco,
        },
        select: SELECT_PAGO,
=======
          enCostosFinancieros: true,
          enMargenContribucion: true,
          aceptaCuotas: input.aceptaCuotas,
          entidades: {
            create: entidadIds.map((entidadId) => ({ entidadId })),
          },
        },
        select: pagoSelect,
>>>>>>> facturacion
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
<<<<<<< HEAD
    const updated = await prisma.finAnaCosFinaPagoCat.update({
      where: { id: input.id },
      data: {
        nombre,
        asociadoTerminal: input.asociadoTerminal,
        asociadoBanco: input.asociadoBanco,
      },
      select: SELECT_PAGO,
=======
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.finAnaCosFinaPagoCat.findUnique({
        where: { id: input.id },
        select: { id: true },
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
        data: {
          nombre,
          aceptaCuotas: input.aceptaCuotas,
        },
        select: pagoSelect,
      });

      await sincronizarMatrizFinAnaCosFina(tx);
      return row;
>>>>>>> facturacion
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
