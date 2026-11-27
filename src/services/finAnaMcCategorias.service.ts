import { prisma } from "@/lib/prisma";
import {
  normalizarNombreCategoriaMc,
  validarContinuidadRangosMcCategorias,
  type FinAnaMcCategoriaItem,
} from "@/lib/finAnaMcCategorias";
import type { ReemplazarFinAnaMcCategoriasInput } from "@/lib/validations/finAnaMcCategorias";
import type { ServiceResult } from "@/types";

const CATEGORIAS_SEMILLA: {
  id: string;
  categoria: string;
  desdePct: number;
  hastaPct: number;
  orden: number;
}[] = [
  { id: "clfinamccat0000000000001", categoria: "MUY BAJO", desdePct: 0, hastaPct: 20, orden: 10 },
  { id: "clfinamccat0000000000002", categoria: "BAJO", desdePct: 20, hastaPct: 40, orden: 20 },
  { id: "clfinamccat0000000000003", categoria: "MEDIO", desdePct: 40, hastaPct: 60, orden: 30 },
  { id: "clfinamccat0000000000004", categoria: "ALTO", desdePct: 60, hastaPct: 80, orden: 40 },
  { id: "clfinamccat0000000000005", categoria: "MUY ALTO", desdePct: 80, hastaPct: 100, orden: 50 },
];

function mapCategoria(row: {
  id: string;
  categoria: string;
  desdePct: number;
  hastaPct: number;
  orden: number;
}): FinAnaMcCategoriaItem {
  return {
    id: row.id,
    categoria: row.categoria.toLocaleUpperCase("es-AR"),
    desdePct: row.desdePct,
    hastaPct: row.hastaPct,
    orden: row.orden,
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe una categoría con ese nombre.";
    if (code === "P2025") return "Categoría no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

/** Semilla idempotente de categorías M.C. Solo si la tabla está vacía. */
export async function ensureFinAnaMcCategoriasSeed(): Promise<void> {
  const count = await prisma.finAnaMcCategoria.count();
  if (count > 0) return;

  await prisma.finAnaMcCategoria.createMany({
    data: CATEGORIAS_SEMILLA,
    skipDuplicates: true,
  });
}

export async function listarFinAnaMcCategorias(): Promise<FinAnaMcCategoriaItem[]> {
  await ensureFinAnaMcCategoriasSeed();
  const rows = await prisma.finAnaMcCategoria.findMany({
    orderBy: [{ desdePct: "asc" }, { orden: "asc" }],
    select: {
      id: true,
      categoria: true,
      desdePct: true,
      hastaPct: true,
      orden: true,
    },
  });
  return rows.map(mapCategoria);
}

/** Reemplaza el catálogo completo (transacción). Rangos continuos, sin exigir 0…100. */
export async function reemplazarFinAnaMcCategorias(
  input: ReemplazarFinAnaMcCategoriasInput
): Promise<ServiceResult<FinAnaMcCategoriaItem[]>> {
  const normalizadas = input.categorias.map((row, index) => ({
    categoria: normalizarNombreCategoriaMc(row.categoria),
    desdePct: row.desdePct,
    hastaPct: row.hastaPct,
    orden: (index + 1) * 10,
  }));

  for (const row of normalizadas) {
    if (!row.categoria) {
      return { success: false, error: "El nombre no puede quedar vacío." };
    }
  }

  const nombres = normalizadas.map((row) => row.categoria);
  if (new Set(nombres).size !== nombres.length) {
    return { success: false, error: "Hay nombres de categoría duplicados." };
  }

  const errorContinuidad = validarContinuidadRangosMcCategorias(normalizadas);
  if (errorContinuidad) {
    return { success: false, error: errorContinuidad };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.finAnaMcCategoria.deleteMany({});
      await tx.finAnaMcCategoria.createMany({
        data: normalizadas,
      });
    });
    return { success: true, data: await listarFinAnaMcCategorias() };
  } catch (e) {
    return {
      success: false,
      error: mapDbError(e, "Error al guardar categorías."),
    };
  }
}
