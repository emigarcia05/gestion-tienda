import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActualizarFinAnaCosFinaInput } from "@/lib/validations/finAnaCosFina";
import { ensureFinAnaCosFinaTerminalesMarcasSeed } from "@/services/finAnaCosFinaTerminalMarca.service";
import { ensureFinAnaCosFinaPagosSeed } from "@/services/finAnaCosFinaPago.service";
import { sincronizarMatrizFinAnaCosFina } from "@/services/finAnaCosFinaMatriz.service";

export type FinAnaCosFinaItem = {
  id: string;
  habilitado: boolean;
  impCheque: boolean;
  terminalId: string;
  terminalNombre: string;
  terminalOrden: number;
  pagoId: string;
  pagoNombre: string;
  cuotaId: string | null;
  /** Etiqueta del catálogo `cobros_cuotas.cuotas`; null si la forma no acepta cuotas. */
  cuotas: string | null;
  diasAcreditacion: number | null;
  arancel: number;
  costoFinanciero: number;
};

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

const FIN_ANA_COS_FINA_INCLUDE = {
  terminal: { select: { nombre: true, orden: true } },
  pago: { select: { nombre: true } },
  cuota: { select: { cuotas: true } },
} as const;

type FinAnaCosFinaRow = {
  id: string;
  habilitado: boolean;
  impCheque: boolean;
  terminalId: string;
  pagoId: string;
  cuotaId: string | null;
  diasAcreditacion: number | null;
  arancel: Prisma.Decimal;
  costoFinanciero: Prisma.Decimal;
  terminal: { nombre: string; orden: number };
  pago: { nombre: string };
  cuota: { cuotas: string } | null;
};

function mapRow(row: FinAnaCosFinaRow): FinAnaCosFinaItem {
  return {
    id: row.id,
    habilitado: row.habilitado,
    impCheque: row.impCheque,
    terminalId: row.terminalId,
    terminalNombre: row.terminal.nombre.toUpperCase(),
    terminalOrden: row.terminal.orden,
    pagoId: row.pagoId,
    pagoNombre: row.pago.nombre.toUpperCase(),
    cuotaId: row.cuotaId,
    cuotas: row.cuota?.cuotas ?? null,
    diasAcreditacion: row.diasAcreditacion,
    arancel: decimalToNumber(row.arancel),
    costoFinanciero: decimalToNumber(row.costoFinanciero),
  };
}

function sortItems(items: FinAnaCosFinaItem[]): FinAnaCosFinaItem[] {
  return [...items].sort((a, b) => {
    const byPago = a.pagoNombre.localeCompare(b.pagoNombre, "es", { sensitivity: "base" });
    if (byPago !== 0) return byPago;
    const byEntidad = a.terminalNombre.localeCompare(b.terminalNombre, "es", {
      sensitivity: "base",
    });
    if (byEntidad !== 0) return byEntidad;
    return (a.cuotas ?? "").localeCompare(b.cuotas ?? "", "es", { sensitivity: "base" });
  });
}

/** Sincroniza la matriz con vínculos N:M y `acepta_cuotas`. */
export async function ensureFinAnaCosFinaSeed(): Promise<void> {
  await ensureFinAnaCosFinaTerminalesMarcasSeed();
  await ensureFinAnaCosFinaPagosSeed();
  await prisma.$transaction(async (tx) => {
    await sincronizarMatrizFinAnaCosFina(tx);
  });
}

export async function listarFinAnaCosFina(): Promise<FinAnaCosFinaItem[]> {
  await ensureFinAnaCosFinaSeed();
  const rows = await prisma.finAnaCosFina.findMany({
    include: FIN_ANA_COS_FINA_INCLUDE,
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
    include: FIN_ANA_COS_FINA_INCLUDE,
  });

  return mapRow(updated);
}
