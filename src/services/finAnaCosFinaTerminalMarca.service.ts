import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtrarPagosCostosFinancieros } from "@/lib/finAnaCosFinaPagos";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import {
  ensureFinAnaCosFinaPagosSeed,
  listarFinAnaCosFinaPagos,
} from "@/services/finAnaCosFinaPago.service";
import type {
  CrearFinAnaCosFinaTerminalMarcaInput,
  EditarFinAnaCosFinaTerminalMarcaInput,
} from "@/lib/validations/finAnaCosFinaTerminalMarca";
import type { ServiceResult } from "@/types/service.types";

const MARCA_SELECT = { id: true, nombre: true, orden: true } as const;

function mapMarca(row: {
  id: string;
  nombre: string;
  orden: number;
}): FinAnaCosFinaTerminalMarcaItem {
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    orden: row.orden,
  };
}

function normalizarNombreMarca(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return "Ya existe una marca con ese nombre.";
    if (code === "P2003") return "No se puede eliminar: hay terminales asociadas.";
    if (code === "P2025") return "Marca no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarFinAnaCosFinaTerminalesMarcas(): Promise<
  FinAnaCosFinaTerminalMarcaItem[]
> {
  const rows = await prisma.finAnaCosFinaTerminalMarca.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: MARCA_SELECT,
  });
  return rows.map(mapMarca);
}

/** Semilla idempotente de marcas base si la tabla está vacía. */
export async function ensureFinAnaCosFinaTerminalesMarcasSeed(): Promise<void> {
  const count = await prisma.finAnaCosFinaTerminalMarca.count();
  if (count > 0) return;

  const semilla: { id: string; nombre: string; orden: number }[] = [
    { id: "clfinacosfintermmp00001", nombre: "MERCADOPAGO", orden: 0 },
    { id: "clfinacosfintermpw00001", nombre: "PAYWAY", orden: 1 },
    { id: "clfinacosfintermnv00001", nombre: "NAVE", orden: 2 },
  ];

  await prisma.finAnaCosFinaTerminalMarca.createMany({
    data: semilla,
    skipDuplicates: true,
  });
}

export async function crearFinAnaCosFinaTerminalMarca(
  input: CrearFinAnaCosFinaTerminalMarcaInput
): Promise<ServiceResult<FinAnaCosFinaTerminalMarcaItem>> {
  const nombre = normalizarNombreMarca(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const maxOrden = await prisma.finAnaCosFinaTerminalMarca.aggregate({
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;

    const marca = await prisma.$transaction(async (tx) => {
      const created = await tx.finAnaCosFinaTerminalMarca.create({
        data: { nombre, orden },
        select: MARCA_SELECT,
      });

      await ensureFinAnaCosFinaPagosSeed();
      const pagosCostos = filtrarPagosCostosFinancieros(await listarFinAnaCosFinaPagos());

      await tx.finAnaCosFina.createMany({
        data: pagosCostos.map((pago) => ({
          terminalId: created.id,
          pagoId: pago.id,
          habilitado: true,
          impCheque: false,
          arancel: new Prisma.Decimal(0),
          costoFinanciero: new Prisma.Decimal(0),
        })),
        skipDuplicates: true,
      });

      return created;
    });

    return { success: true, data: mapMarca(marca) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo crear la marca.") };
  }
}

export async function editarFinAnaCosFinaTerminalMarca(
  input: EditarFinAnaCosFinaTerminalMarcaInput
): Promise<ServiceResult<FinAnaCosFinaTerminalMarcaItem>> {
  const nombre = normalizarNombreMarca(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const updated = await prisma.finAnaCosFinaTerminalMarca.update({
      where: { id: input.id },
      data: { nombre },
      select: MARCA_SELECT,
    });
    return { success: true, data: mapMarca(updated) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo editar la marca.") };
  }
}

export async function eliminarFinAnaCosFinaTerminalMarca(
  id: string
): Promise<ServiceResult<void>> {
  try {
    await prisma.finAnaCosFinaTerminalMarca.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar la marca.") };
  }
}
