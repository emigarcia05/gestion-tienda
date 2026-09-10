import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtrarPagosCostosFinancieros } from "@/lib/finAnaCosFinaPagos";
import type { FinAnaCosFinaTerminalItem } from "@/lib/finAnaCosFinaTerminales";
import {
  ensureFinAnaCosFinaPagosSeed,
  listarFinAnaCosFinaPagos,
} from "@/services/finAnaCosFinaPago.service";
import type {
  CrearFinAnaCosFinaTerminalInput,
  EditarFinAnaCosFinaTerminalInput,
} from "@/lib/validations/finAnaCosFinaTerminal";

type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

const TERMINAL_SELECT = { id: true, nombre: true, idDux: true, orden: true } as const;

function mapTerminal(row: {
  id: string;
  nombre: string;
  idDux: string | null;
  orden: number;
}): FinAnaCosFinaTerminalItem {
  return {
    id: row.id,
    nombre: row.nombre.toUpperCase(),
    idDux: row.idDux,
    orden: row.orden,
  };
}

function normalizarNombreTerminal(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
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
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") {
      if (p2002TargetIncludes(error, "id_dux")) {
        return "Ya existe una terminal con ese ID DUX.";
      }
      return "Ya existe una terminal con ese nombre.";
    }
    if (code === "P2025") return "Terminal no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function listarFinAnaCosFinaTerminales(): Promise<FinAnaCosFinaTerminalItem[]> {
  const rows = await prisma.finAnaCosFinaTerminal.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: TERMINAL_SELECT,
  });
  return rows.map(mapTerminal);
}

/** Semilla idempotente de terminales base si la tabla está vacía. */
export async function ensureFinAnaCosFinaTerminalesSeed(): Promise<void> {
  const count = await prisma.finAnaCosFinaTerminal.count();
  if (count > 0) return;

  const semilla: { id: string; nombre: string; orden: number }[] = [
    { id: "clfinacosfintermmp00001", nombre: "MERCADOPAGO", orden: 0 },
    { id: "clfinacosfintermpw00001", nombre: "PAYWAY", orden: 1 },
    { id: "clfinacosfintermnv00001", nombre: "NAVE", orden: 2 },
  ];

  await prisma.finAnaCosFinaTerminal.createMany({
    data: semilla,
    skipDuplicates: true,
  });
}

export async function crearFinAnaCosFinaTerminal(
  input: CrearFinAnaCosFinaTerminalInput
): Promise<ServiceResult<FinAnaCosFinaTerminalItem>> {
  const nombre = normalizarNombreTerminal(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const maxOrden = await prisma.finAnaCosFinaTerminal.aggregate({ _max: { orden: true } });
    const orden = (maxOrden._max.orden ?? -1) + 1;

    const terminal = await prisma.$transaction(async (tx) => {
      const created = await tx.finAnaCosFinaTerminal.create({
        data: { nombre, orden, idDux: input.idDux },
        select: TERMINAL_SELECT,
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

    return { success: true, data: mapTerminal(terminal) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la terminal."),
    };
  }
}

export async function editarFinAnaCosFinaTerminal(
  input: EditarFinAnaCosFinaTerminalInput
): Promise<ServiceResult<FinAnaCosFinaTerminalItem>> {
  const nombre = normalizarNombreTerminal(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }

  try {
    const updated = await prisma.finAnaCosFinaTerminal.update({
      where: { id: input.id },
      data: { nombre, idDux: input.idDux },
      select: TERMINAL_SELECT,
    });
    return { success: true, data: mapTerminal(updated) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo editar la terminal."),
    };
  }
}

export async function eliminarFinAnaCosFinaTerminal(id: string): Promise<ServiceResult<void>> {
  try {
    await prisma.finAnaCosFinaTerminal.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la terminal."),
    };
  }
}
