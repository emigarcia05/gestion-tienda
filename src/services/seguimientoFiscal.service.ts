/**
 * Administrador · COBROS & DESC. · Seguimiento Fiscal (solo lectura). Una fila por titular:
 * - COBRO: Σ monto bruto de los cobros del mes cuyo vínculo `cobros_vinc_cajas`
 *   (forma × entidad × sucursal) tiene `seguimiento_fiscal = true`, por `cobros_vinc_cajas.titular_id`.
 * - VTAS. FISCALES: Σ `imp_total × cotizacion` de los comprobantes fiscales autorizados del mes
 *   de los puntos de venta del titular (`ptos_vtas.titular`); las NC fiscales restan.
 * Además, Balance IVA (`bal_iva`) del año (enero → mes elegido) y del mes elegido.
 */
import { clavePeriodoEstPorProd, parseClavePeriodoEstPorProd } from "@/lib/estPorProdPeriodo";
import { prisma } from "@/lib/prisma";
import { seguimientoFiscalParamsSchema } from "@/lib/validations/seguimientoFiscal";
import {
  opcionesPeriodoCx,
  rangoFechaPeriodoCx,
  type OpcionFiltroCxMercVend,
} from "@/services/balCxMercaderia.service";
import { resumenBalIvaPeriodo, type ResumenBalIvaPeriodo } from "@/services/balIva.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

const TIPOS_VENTA_FISCAL = ["factura_fiscal", "nota_credito_fiscal"] as const;

export interface FilaSeguimientoFiscalTitular {
  /** `null` = cobros de vínculos con seguimiento fiscal sin titular cargado. */
  titular: string | null;
  cobro: number;
  ventasFiscales: number;
}

export interface SeguimientoFiscalData {
  /** Titulares A→Z; la fila sin titular va última. */
  filas: FilaSeguimientoFiscalTitular[];
  totalCobro: number;
  totalVentasFiscales: number;
  /** Balance IVA (`bal_iva`) del año (enero → mes elegido) y del mes elegido. */
  balanceIva: ResumenBalIvaPeriodo & { anio: number };
  periodos: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: { periodo: string };
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

function claveVinculo(pagoId: string, entidadId: string | null, sucursalId: string): string {
  return `${pagoId}|${entidadId ?? ""}|${sucursalId}`;
}

function claveVinculoCaja(
  pagoId: string,
  entidadId: string | null,
  sucursalId: string,
  cajaId: string
): string {
  return `${claveVinculo(pagoId, entidadId, sucursalId)}|${cajaId}`;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fechaMinima(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function fechaMaxima(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export async function listarSeguimientoFiscalData(raw: {
  periodo?: string;
}): Promise<SeguimientoFiscalData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = seguimientoFiscalParamsSchema.safeParse({ periodo: raw.periodo || periodoDefault });
  const periodo =
    (parsed.success ? parseClavePeriodoEstPorProd(parsed.data.periodo) : null) ?? actual;
  const rango = rangoFechaPeriodoCx(periodo);
  const whereCobro = { catMovimiento: "COBRO", tipoMovimiento: "INGRESO" } as const;
  const whereVentaFiscal = {
    tipoComprobante: { in: [...TIPOS_VENTA_FISCAL] },
    estado: "autorizado",
  };

  const [aggCobros, aggVentas, vinculos, ventas, balanceIva] = await Promise.all([
    prisma.tesoreriaMovimiento.aggregate({
      where: whereCobro,
      _min: { fechaRegistro: true },
      _max: { fechaRegistro: true },
    }),
    prisma.comprobanteVta.aggregate({
      where: whereVentaFiscal,
      _min: { fecha: true },
      _max: { fecha: true },
    }),
    prisma.cobrosPorSucursal.findMany({
      where: { seguimientoFiscal: true },
      orderBy: [{ createdAt: "asc" }],
      select: {
        pagoId: true,
        entidadId: true,
        sucursalId: true,
        cajaDestinoId: true,
        titular: { select: { nombre: true } },
      },
    }),
    prisma.comprobanteVta.findMany({
      where: { ...whereVentaFiscal, fecha: rango },
      select: {
        tipoComprobante: true,
        impTotal: true,
        cotizacion: true,
        ptoVta: { select: { titular: true } },
      },
    }),
    resumenBalIvaPeriodo(periodo),
  ]);

  // Varios alias del mismo trío se distinguen por la caja destino del movimiento.
  const titularPorTrio = new Map<string, string | null>();
  const titularPorCaja = new Map<string, string | null>();
  for (const v of vinculos) {
    const nombre = v.titular ? v.titular.nombre.toLocaleUpperCase("es-AR") : null;
    const trio = claveVinculo(v.pagoId, v.entidadId, v.sucursalId);
    if (!titularPorTrio.has(trio)) titularPorTrio.set(trio, nombre);
    if (!v.cajaDestinoId) continue;
    const porCaja = claveVinculoCaja(v.pagoId, v.entidadId, v.sucursalId, v.cajaDestinoId);
    if (!titularPorCaja.has(porCaja)) titularPorCaja.set(porCaja, nombre);
  }

  const movimientos =
    vinculos.length === 0
      ? []
      : await prisma.tesoreriaMovimiento.findMany({
          where: {
            ...whereCobro,
            fechaRegistro: rango,
            OR: vinculos.map((v) => ({
              pagoId: v.pagoId,
              entidadId: v.entidadId,
              sucursalId: v.sucursalId,
            })),
          },
          select: { monto: true, pagoId: true, entidadId: true, sucursalId: true, cajaId: true },
        });

  const filas = new Map<string, FilaSeguimientoFiscalTitular>();
  const filaDe = (titular: string | null): FilaSeguimientoFiscalTitular => {
    const clave = titular ?? "";
    let fila = filas.get(clave);
    if (!fila) {
      fila = { titular, cobro: 0, ventasFiscales: 0 };
      filas.set(clave, fila);
    }
    return fila;
  };

  for (const m of movimientos) {
    if (!m.pagoId) continue;
    const trio = claveVinculo(m.pagoId, m.entidadId, m.sucursalId);
    const porCaja = m.cajaId
      ? titularPorCaja.get(claveVinculoCaja(m.pagoId, m.entidadId, m.sucursalId, m.cajaId))
      : undefined;
    const titular = porCaja !== undefined ? porCaja : titularPorTrio.get(trio);
    if (titular === undefined) continue;
    filaDe(titular).cobro += m.monto;
  }

  for (const v of ventas) {
    const signo = v.tipoComprobante === "nota_credito_fiscal" ? -1 : 1;
    filaDe(v.ptoVta.titular.toLocaleUpperCase("es-AR")).ventasFiscales +=
      signo * Number(v.impTotal) * Number(v.cotizacion);
  }

  const lista = [...filas.values()]
    .map((f) => ({ ...f, cobro: redondear2(f.cobro), ventasFiscales: redondear2(f.ventasFiscales) }))
    .sort((a, b) => {
      if (a.titular == null) return b.titular == null ? 0 : 1;
      if (b.titular == null) return -1;
      return compararTexto(a.titular, b.titular);
    });

  return {
    filas: lista,
    totalCobro: redondear2(lista.reduce((acc, f) => acc + f.cobro, 0)),
    totalVentasFiscales: redondear2(lista.reduce((acc, f) => acc + f.ventasFiscales, 0)),
    balanceIva: { ...balanceIva, anio: periodo.anio },
    periodos: opcionesPeriodoCx(
      fechaMinima(aggCobros._min.fechaRegistro, aggVentas._min?.fecha ?? null),
      fechaMaxima(aggCobros._max.fechaRegistro, aggVentas._max?.fecha ?? null),
      actual
    ),
    periodoDefault,
    filtros: { periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
}
