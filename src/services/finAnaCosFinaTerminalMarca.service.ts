import { prisma } from "@/lib/prisma";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
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
    if (code === "P2002") return "Ya existe una entidad con ese nombre.";
    if (code === "P2003") return "No se puede eliminar: hay registros asociados.";
    if (code === "P2025") return "Entidad no encontrada.";
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

    const marca = await prisma.finAnaCosFinaTerminalMarca.create({
      data: { nombre, orden },
      select: MARCA_SELECT,
    });

    return { success: true, data: mapMarca(marca) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo crear la entidad.") };
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
    return { success: false, error: mapDbError(error, "No se pudo editar la entidad.") };
  }
}

export async function eliminarFinAnaCosFinaTerminalMarca(
  id: string
): Promise<ServiceResult<void>> {
  try {
    const pagosSoloEsta = await prisma.cobrosFormaPagoEntidad.findMany({
      where: { entidadId: id },
      select: { pagoId: true },
    });
    for (const link of pagosSoloEsta) {
      const n = await prisma.cobrosFormaPagoEntidad.count({
        where: { pagoId: link.pagoId },
      });
      if (n <= 1) {
        return {
          success: false,
          error:
            "No se puede eliminar: es la única entidad de al menos una forma de pago. Asociá otra entidad desde Gestionar Formas Pago.",
        };
      }
    }

    const cajas = await prisma.cajaTesoreria.count({ where: { entidadId: id } });
    if (cajas > 0) {
      return {
        success: false,
        error: "No se puede eliminar: hay cajas de tesorería que usan esta entidad.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.cobrosFormaPagoEntidad.deleteMany({ where: { entidadId: id } });
      await tx.finAnaCosFina.deleteMany({ where: { terminalId: id } });
      await tx.finAnaCosFinaTerminalMarca.delete({ where: { id } });
    });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar la entidad.") };
  }
}
