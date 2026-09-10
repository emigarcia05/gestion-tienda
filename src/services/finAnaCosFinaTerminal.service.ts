import { prisma } from "@/lib/prisma";
import type { FinAnaCosFinaTerminalItem } from "@/lib/finAnaCosFinaTerminales";
import type {
  CrearFinAnaCosFinaTerminalInput,
  EditarFinAnaCosFinaTerminalInput,
} from "@/lib/validations/finAnaCosFinaTerminal";
import type { ServiceResult } from "@/types/service.types";

const TERMINAL_INCLUDE = {
  marca: { select: { nombre: true } },
  titular: { select: { ptoVenta: true, nombreTitular: true } },
} as const;

type TerminalRow = {
  id: string;
  idDux: string;
  marcaId: string;
  titularId: string;
  marca: { nombre: string };
  titular: { ptoVenta: number; nombreTitular: string };
};

function mapTerminal(row: TerminalRow): FinAnaCosFinaTerminalItem {
  return {
    id: row.id,
    idDux: row.idDux,
    marcaId: row.marcaId,
    marcaNombre: row.marca.nombre.toLocaleUpperCase("es-AR"),
    titularId: row.titularId,
    titularPtoVenta: row.titular.ptoVenta,
    titularNombre: row.titular.nombreTitular.toLocaleUpperCase("es-AR"),
  };
}

function p2002TargetIncludes(error: unknown, field: string): boolean {
  if (!error || typeof error !== "object" || !("meta" in error)) return false;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;
  if (Array.isArray(target)) {
    return target.some((t) => typeof t === "string" && t === field);
  }
  return typeof target === "string" && target.includes(field);
}

function mapDbError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      if (p2002TargetIncludes(error, "id_dux")) {
        return "Ya existe una terminal con ese ID DUX.";
      }
      return "Ya existe una terminal con esos datos.";
    }
    if (code === "P2003") return "Marca o titular inválido.";
    if (code === "P2025") return "Terminal no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarFinAnaCosFinaTerminales(): Promise<FinAnaCosFinaTerminalItem[]> {
  const rows = await prisma.finAnaCosFinaTerminal.findMany({
    include: TERMINAL_INCLUDE,
    orderBy: [{ idDux: "asc" }],
  });
  return rows.map(mapTerminal);
}

async function validarMarcaYTitular(
  marcaId: string,
  titularId: string
): Promise<ServiceResult<void>> {
  const [marca, titular] = await Promise.all([
    prisma.finAnaCosFinaTerminalMarca.findUnique({
      where: { id: marcaId },
      select: { id: true },
    }),
    prisma.globalPtoVta.findUnique({
      where: { id: titularId },
      select: { id: true },
    }),
  ]);
  if (!marca) return { success: false, error: "Marca no encontrada." };
  if (!titular) return { success: false, error: "Titular no encontrado." };
  return { success: true, data: undefined };
}

export async function crearFinAnaCosFinaTerminal(
  input: CrearFinAnaCosFinaTerminalInput
): Promise<ServiceResult<FinAnaCosFinaTerminalItem>> {
  const valid = await validarMarcaYTitular(input.marcaId, input.titularId);
  if (!valid.success) return valid;

  try {
    const created = await prisma.finAnaCosFinaTerminal.create({
      data: {
        idDux: input.idDux,
        marcaId: input.marcaId,
        titularId: input.titularId,
      },
      include: TERMINAL_INCLUDE,
    });
    return { success: true, data: mapTerminal(created) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo crear la terminal.") };
  }
}

export async function editarFinAnaCosFinaTerminal(
  input: EditarFinAnaCosFinaTerminalInput
): Promise<ServiceResult<FinAnaCosFinaTerminalItem>> {
  const valid = await validarMarcaYTitular(input.marcaId, input.titularId);
  if (!valid.success) return valid;

  try {
    const updated = await prisma.finAnaCosFinaTerminal.update({
      where: { id: input.id },
      data: {
        idDux: input.idDux,
        marcaId: input.marcaId,
        titularId: input.titularId,
      },
      include: TERMINAL_INCLUDE,
    });
    return { success: true, data: mapTerminal(updated) };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo editar la terminal.") };
  }
}

export async function eliminarFinAnaCosFinaTerminal(id: string): Promise<ServiceResult<void>> {
  try {
    await prisma.finAnaCosFinaTerminal.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo eliminar la terminal.") };
  }
}

