/**
 * Finanzas · Balance · Balance IVA (`bal_iva`): libro de movimientos que generan IVA débito o crédito.
 * El saldo no se persiste: saldo = Σ débito − Σ crédito, acumulado en orden fecha → alta.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clavePeriodoEstPorProd, parseClavePeriodoEstPorProd } from "@/lib/estPorProdPeriodo";
import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";
import { balIvaParamsSchema } from "@/lib/validations/balIva";
import {
  opcionesPeriodoCx,
  rangoFechaPeriodoCx,
  type OpcionFiltroCxMercVend,
} from "@/services/balCxMercaderia.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

export interface FilaBalanceIva {
  id: string;
  fechaIso: string;
  descripcion: string;
  debito: number;
  credito: number;
  /** Saldo acumulado tras este movimiento (incluye el saldo inicial del mes). */
  saldo: number;
}

export interface BalanceIvaData {
  filas: FilaBalanceIva[];
  /** Saldo acumulado de todos los movimientos anteriores al mes elegido. */
  saldoInicial: number;
  totalDebito: number;
  totalCredito: number;
  saldoFinal: number;
  periodos: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: { periodo: string };
}

function saldoDesdeSumas(sumas: {
  _sum: { debito: Prisma.Decimal | null; credito: Prisma.Decimal | null };
}): number {
  return Number(sumas._sum.debito ?? 0) - Number(sumas._sum.credito ?? 0);
}

export async function listarBalanceIvaData(raw: { periodo?: string }): Promise<BalanceIvaData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = balIvaParamsSchema.safeParse({ periodo: raw.periodo || periodoDefault });
  const periodo =
    (parsed.success ? parseClavePeriodoEstPorProd(parsed.data.periodo) : null) ?? actual;
  const rango = rangoFechaPeriodoCx(periodo);

  const [agg, anteriores, rows] = await Promise.all([
    prisma.balIva.aggregate({ _min: { fecha: true }, _max: { fecha: true } }),
    prisma.balIva.aggregate({
      where: { fecha: { lt: rango.gte } },
      _sum: { debito: true, credito: true },
    }),
    prisma.balIva.findMany({
      where: { fecha: rango },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, fecha: true, descripcion: true, debito: true, credito: true },
    }),
  ]);

  const saldoInicial = saldoDesdeSumas(anteriores);
  let saldo = saldoInicial;
  let totalDebito = 0;
  let totalCredito = 0;
  const filas = rows.map((r) => {
    const debito = Number(r.debito);
    const credito = Number(r.credito);
    totalDebito += debito;
    totalCredito += credito;
    saldo += debito - credito;
    return {
      id: r.id,
      fechaIso: isoYmdFromPrismaDateOnly(r.fecha),
      descripcion: r.descripcion,
      debito,
      credito,
      saldo,
    };
  });

  return {
    filas,
    saldoInicial,
    totalDebito,
    totalCredito,
    saldoFinal: saldo,
    periodos: opcionesPeriodoCx(agg._min.fecha, agg._max.fecha, actual),
    periodoDefault,
    filtros: { periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
}

/** Saldo acumulado (débito − crédito) hasta el mes calendario AR actual inclusive. */
export async function calcularSaldoAcumuladoBalIva(): Promise<number> {
  const { lt: finMesActual } = rangoFechaPeriodoCx(mesAnioCalendarioArgentina());
  const sumas = await prisma.balIva.aggregate({
    where: { fecha: { lt: finMesActual } },
    _sum: { debito: true, credito: true },
  });
  return saldoDesdeSumas(sumas);
}

/** Huella de cambios del libro (altas, ediciones y bajas) para el polling de pedidos. */
export async function huellaBalIva(): Promise<string> {
  const agg = await prisma.balIva.aggregate({
    _max: { updatedAt: true },
    _count: { _all: true },
  });
  return `${agg._count._all}:${agg._max.updatedAt?.toISOString() ?? ""}`;
}
