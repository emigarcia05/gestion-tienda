/**
 * Finanzas · Balance · Cx Fin Cobros (`bal_cx_financiero`), 3 vistas:
 * `sucursal` (meses × sucursales, ignora FECHA), `forma` (formas de pago × sucursales del mes) y
 * `detalle` (cobros paginados del mes). FORMA DE PAGO / SUC / texto aplican a todas.
 * Cobro (+), devolución de NC (−).
 */
import type { Prisma, SentidoMovimientoTesoreria } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { clavePeriodoEstPorProd, parseClavePeriodoEstPorProd } from "@/lib/estPorProdPeriodo";
import { formatoNroComprobante } from "@/lib/facturaFiscal";
import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  cxFinCobrosParamsSchema,
  VISTA_CX_FIN_COBROS_DEFAULT,
  type VistaCxFinCobros,
} from "@/lib/validations/balCxFinanciero";
import {
  armarResumen,
  opcionesPeriodoCx,
  rangoFechaPeriodoCx,
  type OpcionFiltroCxMercVend,
  type PeriodoMesAnio,
  type ResumenCxMercVend,
} from "@/services/balCxMercaderia.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

export interface FilaCxFinCobros {
  id: string;
  fechaIso: string;
  comprobante: string;
  cliente: string;
  /** Forma · entidad · cuotas. */
  formaPago: string;
  /** Monto cobrado con signo: cobro (+), devolución NC (−). */
  cobrado: number;
  costoPct: number;
  /** Cx Fin con signo. */
  cx: number;
  sucursalNombre: string;
  esDevolucion: boolean;
  /** Venta / NC del cobro (botón VER). */
  comprobanteVtaId: string;
}

export interface CxFinCobrosData {
  vista: VistaCxFinCobros;
  /** Solo vista `detalle` (vacío en las resumidas). */
  filas: FilaCxFinCobros[];
  total: number;
  totalPaginas: number;
  /** Suma con signo de todas las filas que cumplen los filtros (no solo la página). */
  totalCx: number;
  /** Solo vistas `sucursal` / `forma`. */
  resumen: ResumenCxMercVend | null;
  periodos: OpcionFiltroCxMercVend[];
  formasPago: OpcionFiltroCxMercVend[];
  sucursales: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: {
    vista: VistaCxFinCobros;
    periodo: string;
    pago: string;
    sucursal: string;
    q: string;
    pagina: number;
  };
}

function signo(tipo: SentidoMovimientoTesoreria): 1 | -1 {
  return tipo === "EGRESO" ? -1 : 1;
}

function cxConSigno(tipo: SentidoMovimientoTesoreria, cx: Prisma.Decimal | null): number {
  return signo(tipo) * Number(cx ?? 0);
}

function whereCxFinCobros(params: {
  /** `null` = sin filtro de fecha (vista por sucursal). */
  periodo: PeriodoMesAnio | null;
  pago: string;
  sucursal: string;
  q: string;
}): Prisma.BalCxFinancieroWhereInput {
  const parts: Prisma.BalCxFinancieroWhereInput[] = [];
  if (params.periodo) parts.push({ fecha: rangoFechaPeriodoCx(params.periodo) });
  if (params.sucursal) parts.push({ sucursalId: params.sucursal });
  if (params.pago) parts.push({ pagoId: params.pago });
  const texto = filtroTexto(params.q, ["receptorNombre"]);
  if (texto.AND?.length) parts.push({ comprobanteVta: texto });
  return { AND: parts };
}

/** Vista 1: todos los meses (más reciente primero) × sucursales; ignora FECHA. */
async function resumenPorSucursal(
  where: Prisma.BalCxFinancieroWhereInput,
  columnas: OpcionFiltroCxMercVend[],
  periodos: OpcionFiltroCxMercVend[]
): Promise<ResumenCxMercVend> {
  const rows = await prisma.balCxFinanciero.groupBy({
    by: ["fecha", "sucursalId", "tipoMovimiento"],
    where,
    _sum: { cxTotal: true },
  });
  return armarResumen(
    columnas,
    periodos,
    rows.map((r) => ({
      clave: clavePeriodoEstPorProd(r.fecha.getUTCMonth() + 1, r.fecha.getUTCFullYear()),
      sucursalId: r.sucursalId,
      cx: cxConSigno(r.tipoMovimiento, r._sum.cxTotal),
    }))
  );
}

/** Vista 2: formas de pago × sucursales del mes elegido. */
async function resumenPorForma(
  where: Prisma.BalCxFinancieroWhereInput,
  columnas: OpcionFiltroCxMercVend[],
  formas: OpcionFiltroCxMercVend[]
): Promise<ResumenCxMercVend> {
  const rows = await prisma.balCxFinanciero.groupBy({
    by: ["pagoId", "sucursalId", "tipoMovimiento"],
    where,
    _sum: { cxTotal: true },
  });
  return armarResumen(
    columnas,
    formas,
    rows.map((r) => ({
      clave: r.pagoId,
      sucursalId: r.sucursalId,
      cx: cxConSigno(r.tipoMovimiento, r._sum.cxTotal),
    }))
  );
}

async function listarDetalle(
  where: Prisma.BalCxFinancieroWhereInput,
  pagina: number
): Promise<Pick<CxFinCobrosData, "filas" | "total" | "totalPaginas" | "totalCx">> {
  const [rows, total, sumas] = await Promise.all([
    prisma.balCxFinanciero.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fecha: true,
        tipoMovimiento: true,
        montoCobrado: true,
        costoPct: true,
        cxTotal: true,
        comprobanteVtaId: true,
        comprobanteVta: { select: { ptoVenta: true, cbteNro: true, receptorNombre: true } },
        pago: { select: { nombre: true } },
        entidad: { select: { nombre: true } },
        cuota: { select: { cuotas: true } },
        sucursal: { select: { nombre: true } },
      },
    }),
    prisma.balCxFinanciero.count({ where }),
    prisma.balCxFinanciero.groupBy({
      by: ["tipoMovimiento"],
      where,
      _sum: { cxTotal: true },
    }),
  ]);
  const totalCx = sumas.reduce((acc, s) => acc + cxConSigno(s.tipoMovimiento, s._sum.cxTotal), 0);
  return {
    filas: rows.map((r) => ({
      id: r.id,
      fechaIso: isoYmdFromPrismaDateOnly(r.fecha),
      comprobante: formatoNroComprobante(r.comprobanteVta.ptoVenta, r.comprobanteVta.cbteNro),
      cliente: r.comprobanteVta.receptorNombre.toLocaleUpperCase("es-AR"),
      formaPago: [r.pago.nombre, r.entidad?.nombre, r.cuota?.cuotas]
        .filter(Boolean)
        .join(" · ")
        .toLocaleUpperCase("es-AR"),
      cobrado: signo(r.tipoMovimiento) * r.montoCobrado,
      costoPct: Number(r.costoPct),
      cx: cxConSigno(r.tipoMovimiento, r.cxTotal),
      sucursalNombre: r.sucursal.nombre.toLocaleUpperCase("es-AR"),
      esDevolucion: r.tipoMovimiento === "EGRESO",
      comprobanteVtaId: r.comprobanteVtaId,
    })),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totalCx: Math.round(totalCx * 100) / 100,
  };
}

/** Periodo inválido → mes AR actual. */
export async function listarCxFinCobrosData(raw: {
  vista?: string;
  periodo?: string;
  pago?: string;
  sucursal?: string;
  q?: string;
  pagina?: string;
}): Promise<CxFinCobrosData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = cxFinCobrosParamsSchema.safeParse({
    vista: raw.vista || VISTA_CX_FIN_COBROS_DEFAULT,
    periodo: raw.periodo || periodoDefault,
    pago: raw.pago ?? "",
    sucursal: raw.sucursal ?? "",
    q: raw.q ?? "",
    pagina: raw.pagina ?? 1,
  });
  const filtros = parsed.success
    ? parsed.data
    : {
        vista: VISTA_CX_FIN_COBROS_DEFAULT,
        periodo: periodoDefault,
        pago: "",
        sucursal: "",
        q: "",
        pagina: 1,
      };
  const periodo = parseClavePeriodoEstPorProd(filtros.periodo) ?? actual;

  const [agg, formasRows, sucursalesRows] = await Promise.all([
    prisma.balCxFinanciero.aggregate({ _min: { fecha: true }, _max: { fecha: true } }),
    prisma.finAnaCosFinaPagoCat.findMany({
      where: { cxFinanciero: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.sucursal.findMany({
      where: { cxFinanciero: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const periodos = opcionesPeriodoCx(agg._min.fecha, agg._max.fecha, actual);
  const formasPago = formasRows.map((f) => ({
    value: f.id,
    label: f.nombre.toLocaleUpperCase("es-AR"),
  }));
  const sucursales = sucursalesRows.map((s) => ({
    value: s.id,
    label: s.nombre.toLocaleUpperCase("es-AR"),
  }));
  const columnas = filtros.sucursal
    ? sucursales.filter((s) => s.value === filtros.sucursal)
    : sucursales;

  const base = {
    vista: filtros.vista,
    periodos,
    formasPago,
    sucursales,
    periodoDefault,
    filtros: { ...filtros, periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
  const sinDetalle = { filas: [], total: 0, totalPaginas: 1, totalCx: 0 };

  if (filtros.vista === "sucursal") {
    const where = whereCxFinCobros({ ...filtros, periodo: null });
    const resumen = await resumenPorSucursal(where, columnas, periodos);
    return { ...base, ...sinDetalle, totalCx: resumen.totales.total, resumen };
  }
  if (filtros.vista === "forma") {
    const where = whereCxFinCobros({ ...filtros, periodo });
    const filasForma = filtros.pago
      ? formasPago.filter((f) => f.value === filtros.pago)
      : formasPago;
    const resumen = await resumenPorForma(where, columnas, filasForma);
    return { ...base, ...sinDetalle, totalCx: resumen.totales.total, resumen };
  }
  const detalle = await listarDetalle(whereCxFinCobros({ ...filtros, periodo }), filtros.pagina);
  return { ...base, ...detalle, resumen: null };
}
