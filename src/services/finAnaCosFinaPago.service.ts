import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type {
  CrearFinAnaCosFinaPagoInput,
  EditarFinAnaCosFinaPagoInput,
  ReordenarFinAnaCosFinaPagosInput,
} from "@/lib/validations/finAnaCosFinaPago";
import type { ServiceResult } from "@/types";

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
  id: string;
  nombre: string;
  orden: number;
  enCostosFinancieros: boolean;
  enMargenContribucion: boolean;
  asociadoTerminal: boolean;
  asociadoBanco: boolean;
}): FinAnaCosFinaPagoItem {
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    orden: row.orden,
    enCostosFinancieros: row.enCostosFinancieros,
    enMargenContribucion: row.enMargenContribucion,
    asociadoTerminal: row.asociadoTerminal,
    asociadoBanco: row.asociadoBanco,
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
  {
    id: "clfinapago0000008efe",
    nombre: "EFECTIVO",
    orden: 0,
    enCostosFinancieros: false,
    enMargenContribucion: true,
    asociadoTerminal: false,
    asociadoBanco: false,
  },
  {
    id: "clfinapago0000001deb",
    nombre: "DÉBITO",
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
  },
];

export async function ensureFinAnaCosFinaPagosSeed(): Promise<void> {
  const count = await prisma.finAnaCosFinaPagoCat.count();
  if (count > 0) return;

  await prisma.finAnaCosFinaPagoCat.createMany({
    data: PAGOS_SEMILLA,
    skipDuplicates: true,
  });
}

export async function listarFinAnaCosFinaPagos(): Promise<FinAnaCosFinaPagoItem[]> {
  await ensureFinAnaCosFinaPagosSeed();
  const rows = await prisma.finAnaCosFinaPagoCat.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: SELECT_PAGO,
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
          asociadoTerminal: input.asociadoTerminal,
          asociadoBanco: input.asociadoBanco,
        },
        select: SELECT_PAGO,
      });

      if (created.enCostosFinancieros) {
        const marcas = await tx.finAnaCosFinaTerminalMarca.findMany({
          select: { id: true },
        });
        const filas = marcas.map((marca) => ({
          terminalId: marca.id,
          pagoId: created.id,
          habilitado: true,
          impCheque: false,
          arancel: new Prisma.Decimal(0),
          costoFinanciero: new Prisma.Decimal(0),
        }));
        if (filas.length > 0) {
          await tx.finAnaCosFina.createMany({ data: filas, skipDuplicates: true });
        }
      }

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

  try {
    const updated = await prisma.finAnaCosFinaPagoCat.update({
      where: { id: input.id },
      data: {
        nombre,
        asociadoTerminal: input.asociadoTerminal,
        asociadoBanco: input.asociadoBanco,
      },
      select: SELECT_PAGO,
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
