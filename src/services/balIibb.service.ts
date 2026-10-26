/**
 * Finanzas · Balance · Balance IIBB (`bal_iibb`): libro de movimientos que generan IIBB débito.
 * Sin crédito: el saldo no se persiste, saldo = Σ débito acumulado en orden fecha → alta.
 */
import { Prisma, type OrigenBalIibb } from "@prisma/client";
import { clavePeriodoEstPorProd, parseClavePeriodoEstPorProd } from "@/lib/estPorProdPeriodo";
import { isoYmdFromPrismaDateOnly, prismaDateOnlyFromIsoYmd } from "@/lib/fechaArgentina";
import { prisma } from "@/lib/prisma";
import { balIibbParamsSchema, type CrearAjusteBalIibbInput } from "@/lib/validations/balIibb";
import type { ServiceResult } from "@/types/service.types";
import {
  opcionesPeriodoCx,
  rangoFechaPeriodoCx,
  type OpcionFiltroCxMercVend,
} from "@/services/balCxMercaderia.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

export interface FilaBalanceIibb {
  id: string;
  fechaIso: string;
  /** VENTA, NOTA CREDITO (débito < 0) o AJUSTE. */
  movimiento: string;
  /** Ajuste manual (AJUSTE SALDO): se puede borrar desde la fila. */
  esAjuste: boolean;
  /** Comprobante y receptor (sin el tipo). */
  descripcion: string;
  debito: number;
  /** Saldo acumulado tras este movimiento (incluye el saldo inicial del mes). */
  saldo: number;
  /** Venta / NC que generó la fila (botón VER); `null` en ajustes. */
  comprobanteVtaId: string | null;
}

export interface BalanceIibbData {
  /** Más reciente primero; `saldo` de cada fila acumulado en orden cronológico. */
  filas: FilaBalanceIibb[];
  /** Saldo acumulado de todos los movimientos anteriores al mes elegido. */
  saldoInicial: number;
  totalDebito: number;
  saldoFinal: number;
  periodos: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: { periodo: string };
}

function etiquetaMovimiento(origen: OrigenBalIibb, debito: number): string {
  if (origen === "AJUSTE") return "AJUSTE";
  return debito < 0 ? "NOTA CREDITO" : "VENTA";
}

export async function listarBalanceIibbData(raw: { periodo?: string }): Promise<BalanceIibbData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = balIibbParamsSchema.safeParse({ periodo: raw.periodo || periodoDefault });
  const periodo =
    (parsed.success ? parseClavePeriodoEstPorProd(parsed.data.periodo) : null) ?? actual;
  const rango = rangoFechaPeriodoCx(periodo);

  const [agg, anteriores, rows] = await Promise.all([
    prisma.balIibb.aggregate({ _min: { fecha: true }, _max: { fecha: true } }),
    prisma.balIibb.aggregate({ where: { fecha: { lt: rango.gte } }, _sum: { debito: true } }),
    prisma.balIibb.findMany({
      where: { fecha: rango },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, origen: true, fecha: true, descripcion: true, debito: true, comprobanteVtaId: true },
    }),
  ]);

  const saldoInicial = Number(anteriores._sum.debito ?? 0);
  let saldo = saldoInicial;
  let totalDebito = 0;
  const filas = rows.map((r) => {
    const debito = Number(r.debito);
    totalDebito += debito;
    saldo += debito;
    return {
      id: r.id,
      fechaIso: isoYmdFromPrismaDateOnly(r.fecha),
      movimiento: etiquetaMovimiento(r.origen, debito),
      esAjuste: r.origen === "AJUSTE",
      descripcion: r.descripcion,
      debito,
      saldo,
      comprobanteVtaId: r.comprobanteVtaId,
    };
  });

  return {
    filas: filas.reverse(),
    saldoInicial,
    totalDebito,
    saldoFinal: saldo,
    periodos: opcionesPeriodoCx(agg._min.fecha, agg._max.fecha, actual),
    periodoDefault,
    filtros: { periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
}

/** AJUSTE SALDO: fila manual (sin origen) en DÉBITO; RESTA se guarda en negativo. */
export async function crearAjusteBalIibb(
  input: CrearAjusteBalIibbInput
): Promise<ServiceResult<{ id: string }>> {
  const fecha = prismaDateOnlyFromIsoYmd(input.fechaIso);
  if (!fecha) return { success: false, error: "Fecha inválida." };
  const row = await prisma.balIibb.create({
    data: {
      origen: "AJUSTE",
      fecha,
      descripcion: "",
      debito: new Prisma.Decimal(input.sentido === "RESTA" ? -input.monto : input.monto),
    },
    select: { id: true },
  });
  return { success: true, data: { id: row.id } };
}

/** Borra un AJUSTE; las filas de venta no se borran a mano. */
export async function eliminarAjusteBalIibb(id: string): Promise<ServiceResult<void>> {
  const { count } = await prisma.balIibb.deleteMany({ where: { id, origen: "AJUSTE" } });
  if (count === 0) return { success: false, error: "El ajuste no existe o ya se borró." };
  return { success: true, data: undefined };
}
