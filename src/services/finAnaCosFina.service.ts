import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActualizarFinAnaCosFinaInput } from "@/lib/validations/finAnaCosFina";
import {
  ensureFinAnaCosFinaTerminalesMarcasSeed,
  listarFinAnaCosFinaTerminalesMarcas,
} from "@/services/finAnaCosFinaTerminalMarca.service";
import {
  ensureFinAnaCosFinaPagosSeed,
  listarFinAnaCosFinaPagos,
} from "@/services/finAnaCosFinaPago.service";
import { filtrarPagosCostosFinancieros } from "@/lib/finAnaCosFinaPagos";

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
    const byTerminal = a.terminalOrden - b.terminalOrden;
    if (byTerminal !== 0) return byTerminal;
    return a.pagoOrden - b.pagoOrden;
  });
}

/** Asegura la matriz marca × pago (idempotente; útil si la migración no corrió en un entorno). */
export async function ensureFinAnaCosFinaSeed(): Promise<void> {
  await ensureFinAnaCosFinaTerminalesMarcasSeed();
  await ensureFinAnaCosFinaPagosSeed();
  const marcas = await listarFinAnaCosFinaTerminalesMarcas();
  const pagos = filtrarPagosCostosFinancieros(await listarFinAnaCosFinaPagos());

  const existentes = await prisma.finAnaCosFina.findMany({
    select: { terminalId: true, pagoId: true },
  });
  const claves = new Set(existentes.map((row) => `${row.terminalId}:${row.pagoId}`));
  const faltantes: { terminalId: string; pagoId: string }[] = [];

  for (const marca of marcas) {
    for (const pago of pagos) {
      if (!claves.has(`${marca.id}:${pago.id}`)) {
        faltantes.push({ terminalId: marca.id, pagoId: pago.id });
      }
    }
  }

  if (faltantes.length === 0) return;

  await prisma.finAnaCosFina.createMany({
    data: faltantes.map((row) => ({
      terminalId: row.terminalId,
      pagoId: row.pagoId,
      habilitado: true,
      impCheque: false,
      arancel: new Prisma.Decimal(0),
      costoFinanciero: new Prisma.Decimal(0),
    })),
    skipDuplicates: true,
  });
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
