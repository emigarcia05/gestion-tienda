/**
 * Finanzas · Balance · Balance IVA (`bal_iva`): libro de movimientos que generan IVA débito o crédito.
 * El saldo no se persiste: saldo = Σ débito − Σ crédito, acumulado en orden fecha → alta.
 */
import { Prisma, type OrigenBalIva } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clavePeriodoEstPorProd, parseClavePeriodoEstPorProd } from "@/lib/estPorProdPeriodo";
import { isoYmdFromPrismaDateOnly, prismaDateOnlyFromIsoYmd } from "@/lib/fechaArgentina";
import { balIvaParamsSchema, type CrearAjusteBalIvaInput } from "@/lib/validations/balIva";
import type { ServiceResult } from "@/types/service.types";
import {
  opcionesPeriodoCx,
  rangoFechaPeriodoCx,
  type OpcionFiltroCxMercVend,
} from "@/services/balCxMercaderia.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

/**
 * Comprobante que generó la fila (botón VER): venta / NC (venta y Cx Fin del cobro) o la recepción
 * del pedido (compra). `null`: gasto, o NC de compra sin pedido (bonificación).
 */
export type ComprobanteOrigenBalIva =
  | { tipo: "venta"; comprobanteVtaId: string }
  | { tipo: "compra"; pedidoHistoriaId: string }
  | null;

export interface FilaBalanceIva {
  id: string;
  fechaIso: string;
  /** Tipo según origen y signo: CX. FINANCIERO COBRO, VENTA, NOTA CREDITO (venta o compra), COMPRA MERC, GASTO, AJUSTE. */
  movimiento: string;
  /** Ajuste manual (AJUSTE SALDO): se puede borrar desde la fila. */
  esAjuste: boolean;
  /** Comprobante y contraparte (sin el tipo). */
  descripcion: string;
  debito: number;
  credito: number;
  /** Saldo acumulado tras este movimiento (incluye el saldo inicial del mes). */
  saldo: number;
  comprobante: ComprobanteOrigenBalIva;
}

function etiquetaMovimiento(origen: OrigenBalIva, debito: number, credito: number): string {
  switch (origen) {
    case "VENTA":
      return debito < 0 ? "NOTA CREDITO" : "VENTA";
    case "COMPRA_MERCADERIA":
      return credito < 0 ? "NOTA CREDITO" : "COMPRA MERC";
    case "GASTO":
      return "GASTO";
    case "CX_FINANCIERO":
      return "CX. FINANCIERO COBRO";
    case "AJUSTE":
      return "AJUSTE";
  }
}

const SELECT_FILA_BAL_IVA = {
  id: true,
  origen: true,
  fecha: true,
  descripcion: true,
  debito: true,
  credito: true,
  comprobanteVtaId: true,
  comprobanteCompra: { select: { pedidoHistoriaId: true } },
  tesoreriaMovimiento: { select: { comprobanteId: true } },
} satisfies Prisma.BalIvaSelect;

function comprobanteOrigen(
  r: Prisma.BalIvaGetPayload<{ select: typeof SELECT_FILA_BAL_IVA }>
): ComprobanteOrigenBalIva {
  const ventaId = r.comprobanteVtaId ?? r.tesoreriaMovimiento?.comprobanteId;
  if (ventaId) return { tipo: "venta", comprobanteVtaId: ventaId };
  const pedidoHistoriaId = r.comprobanteCompra?.pedidoHistoriaId;
  if (pedidoHistoriaId) return { tipo: "compra", pedidoHistoriaId };
  return null;
}

export interface BalanceIvaData {
  /** Más reciente primero; `saldo` de cada fila acumulado en orden cronológico. */
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
      select: SELECT_FILA_BAL_IVA,
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
      movimiento: etiquetaMovimiento(r.origen, debito, credito),
      esAjuste: r.origen === "AJUSTE",
      descripcion: r.descripcion,
      debito,
      credito,
      saldo,
      comprobante: comprobanteOrigen(r),
    };
  });

  return {
    filas: filas.reverse(),
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

/** AJUSTE SALDO: fila manual (sin origen) en DÉBITO o CRÉDITO por un monto entero positivo. */
export async function crearAjusteBalIva(
  input: CrearAjusteBalIvaInput
): Promise<ServiceResult<{ id: string }>> {
  const fecha = prismaDateOnlyFromIsoYmd(input.fechaIso);
  if (!fecha) return { success: false, error: "Fecha inválida." };
  const monto = new Prisma.Decimal(input.monto);
  const cero = new Prisma.Decimal(0);
  const row = await prisma.balIva.create({
    data: {
      origen: "AJUSTE",
      fecha,
      descripcion: "",
      debito: input.columna === "DEBITO" ? monto : cero,
      credito: input.columna === "CREDITO" ? monto : cero,
    },
    select: { id: true },
  });
  return { success: true, data: { id: row.id } };
}

/** Borra un AJUSTE; las filas con origen (venta, compra, …) no se borran a mano. */
export async function eliminarAjusteBalIva(id: string): Promise<ServiceResult<void>> {
  const { count } = await prisma.balIva.deleteMany({ where: { id, origen: "AJUSTE" } });
  if (count === 0) return { success: false, error: "El ajuste no existe o ya se borró." };
  return { success: true, data: undefined };
}

/** Huella de cambios del libro (altas, ediciones y bajas) para el polling de pedidos. */
export async function huellaBalIva(): Promise<string> {
  const agg = await prisma.balIva.aggregate({
    _max: { updatedAt: true },
    _count: { _all: true },
  });
  return `${agg._count._all}:${agg._max.updatedAt?.toISOString() ?? ""}`;
}
