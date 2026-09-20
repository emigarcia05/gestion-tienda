import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActualizarFinAnaCosFinaInput } from "@/lib/validations/finAnaCosFina";
import { ensureFinAnaCosFinaTerminalesMarcasSeed } from "@/services/finAnaCosFinaTerminalMarca.service";
import { ensureFinAnaCosFinaPagosSeed } from "@/services/finAnaCosFinaPago.service";

export type FinAnaCosFinaItem = {
  id: string;
  habilitado: boolean;
  impCheque: boolean;
  terminalId: string;
  terminalNombre: string;
  terminalOrden: number;
  pagoId: string;
  pagoNombre: string;
  pagoOrden: number;
  diasAcreditacion: number | null;
  arancel: number;
  costoFinanciero: number;
};

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

function mapRow(row: {
  id: string;
  habilitado: boolean;
  impCheque: boolean;
  terminalId: string;
  pagoId: string;
  diasAcreditacion: number | null;
  arancel: Prisma.Decimal;
  costoFinanciero: Prisma.Decimal;
  terminal: { nombre: string; orden: number };
  pago: { nombre: string; orden: number };
}): FinAnaCosFinaItem {
  return {
    id: row.id,
    habilitado: row.habilitado,
    impCheque: row.impCheque,
    terminalId: row.terminalId,
    terminalNombre: row.terminal.nombre.toUpperCase(),
    terminalOrden: row.terminal.orden,
    pagoId: row.pagoId,
    pagoNombre: row.pago.nombre.toUpperCase(),
    pagoOrden: row.pago.orden,
    diasAcreditacion: row.diasAcreditacion,
    arancel: decimalToNumber(row.arancel),
    costoFinanciero: decimalToNumber(row.costoFinanciero),
  };
}

function sortItems(items: FinAnaCosFinaItem[]): FinAnaCosFinaItem[] {
  return [...items].sort((a, b) => {
    // Alfabetico: Forma de pago → Entidad (Cuotas cuando se cablee FK).
    const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", { sensitivity: "base" });
    if (byPago !== 0) return byPago;
    return a.terminalNombre.localeCompare(b.terminalNombre, "es", { sensitivity: "base" });
  });
}

/**
 * Sincroniza `fin_ana_cos_fina` con `cobros_forma_pago_entidades`:
 * una fila por cada par forma de pago (en costos) × entidad vinculada.
 * Crea faltantes y elimina huérfanas (producto cartesiano legacy).
 */
export async function ensureFinAnaCosFinaSeed(): Promise<void> {
  await ensureFinAnaCosFinaTerminalesMarcasSeed();
  await ensureFinAnaCosFinaPagosSeed();

  const vinculos = await prisma.cobrosFormaPagoEntidad.findMany({
    where: { pago: { enCostosFinancieros: true } },
    select: { pagoId: true, entidadId: true },
  });
  const deseados = new Set(vinculos.map((v) => `${v.entidadId}:${v.pagoId}`));

  const existentes = await prisma.finAnaCosFina.findMany({
    select: { id: true, terminalId: true, pagoId: true },
  });
  const clavesExistentes = new Set(
    existentes.map((row) => `${row.terminalId}:${row.pagoId}`)
  );

  const faltantes = vinculos.filter(
    (v) => !clavesExistentes.has(`${v.entidadId}:${v.pagoId}`)
  );
  if (faltantes.length > 0) {
    await prisma.finAnaCosFina.createMany({
      data: faltantes.map((row) => ({
        terminalId: row.entidadId,
        pagoId: row.pagoId,
        habilitado: true,
        impCheque: false,
        arancel: new Prisma.Decimal(0),
        costoFinanciero: new Prisma.Decimal(0),
      })),
      skipDuplicates: true,
    });
  }

  const huerfanosIds = existentes
    .filter((row) => !deseados.has(`${row.terminalId}:${row.pagoId}`))
    .map((row) => row.id);
  if (huerfanosIds.length > 0) {
    await prisma.finAnaCosFina.deleteMany({
      where: { id: { in: huerfanosIds } },
    });
  }
}

export async function listarFinAnaCosFina(): Promise<FinAnaCosFinaItem[]> {
  await ensureFinAnaCosFinaSeed();
  const rows = await prisma.finAnaCosFina.findMany({
    include: {
      terminal: { select: { nombre: true, orden: true } },
      pago: { select: { nombre: true, orden: true } },
    },
  });
  return sortItems(rows.map(mapRow));
}

export async function actualizarFinAnaCosFina(
  input: ActualizarFinAnaCosFinaInput
): Promise<FinAnaCosFinaItem> {
  const { id, campos } = input;
  const data: Prisma.FinAnaCosFinaUpdateInput = {};

  if (campos.habilitado !== undefined) {
    data.habilitado = campos.habilitado;
  }
  if (campos.impCheque !== undefined) {
    data.impCheque = campos.impCheque;
  }
  if (campos.diasAcreditacion !== undefined) {
    data.diasAcreditacion = campos.diasAcreditacion;
  }
  if (campos.arancel !== undefined) {
    data.arancel = new Prisma.Decimal(campos.arancel);
  }
  if (campos.costoFinanciero !== undefined) {
    data.costoFinanciero = new Prisma.Decimal(campos.costoFinanciero);
  }

  const updated = await prisma.finAnaCosFina.update({
    where: { id },
    data,
    include: {
      terminal: { select: { nombre: true, orden: true } },
      pago: { select: { nombre: true, orden: true } },
    },
  });

  return mapRow(updated);
}
