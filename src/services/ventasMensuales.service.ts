/**
 * Ventas Mensuales: suma de comprobantes de venta (`vtas_comprobantes`) por sucursal y mes.
 * Fiscal y no fiscal suman `imp_total × cotizacion`; las NC restan. Solo comprobantes con
 * `fecha >= VENTAS_MENSUALES_DESDE_ISO` (sin backfill). Fuente de las ventas del Balance mensual.
 */

import { esFacturaTipo, esFacturaTipoNotaCredito } from "@/lib/factura";
import { prismaDateOnlyFromIsoYmd } from "@/lib/fechaArgentina";
import { prisma } from "@/lib/prisma";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";

/** Primer día que se suma (los comprobantes anteriores no cuentan). */
export const VENTAS_MENSUALES_DESDE_ISO = "2026-10-26";

const TIPOS_VENTA = [
  "factura_fiscal",
  "factura_no_fiscal",
  "nota_credito_fiscal",
  "nota_credito_no_fiscal",
] as const;

export interface SucursalGeneraBalanceOption {
  id: string;
  nombre: string;
}

export interface VentasMensualesPeriodo {
  mes: number;
  anio: number;
  porSucursalId: Record<string, number>;
}

export interface VentasMensualesData {
  periodos: VentasMensualesPeriodo[];
  sucursales: SucursalGeneraBalanceOption[];
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clavePeriodo(mes: number, anio: number): string {
  return `${anio}-${mes}`;
}

function primerDiaMes(mes: number, anio: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

function fechaDesdeVentas(): Date {
  const d = prismaDateOnlyFromIsoYmd(VENTAS_MENSUALES_DESDE_ISO);
  if (!d) throw new Error("VENTAS_MENSUALES_DESDE_ISO inválida.");
  return d;
}

/** Sucursales con columna en Ventas Mensuales y Balance mensual: solo `genera_balance = true`. */
export async function listarSucursalesGeneraBalance(): Promise<SucursalGeneraBalanceOption[]> {
  const rows = await prisma.sucursal.findMany({
    where: { generaBalance: true },
    select: { id: true, nombre: true },
    orderBy: [{ nombre: "asc" }],
  });
  return rows.map((r) => ({ id: r.id, nombre: r.nombre.toLocaleUpperCase("es") }));
}

/**
 * Ventas netas (NC restan) por periodo `anio-mes` y sucursal, para fechas en `[desde, hasta)`.
 * Sucursal = la del comprobante de stock de la venta; si no tiene, la sucursal por defecto del
 * usuario que la emitió (misma regla que `aplicarStockDesdeComprobanteVta`).
 */
async function sumarVentasPorPeriodoYSucursal(
  desde: Date,
  hasta: Date
): Promise<Map<string, Record<string, number>>> {
  const inicio = desde < fechaDesdeVentas() ? fechaDesdeVentas() : desde;
  const out = new Map<string, Record<string, number>>();
  if (inicio >= hasta) return out;

  const [rows, sucursales] = await Promise.all([
    prisma.comprobanteVta.findMany({
      where: {
        tipoComprobante: { in: [...TIPOS_VENTA] },
        estado: "autorizado",
        fecha: { gte: inicio, lt: hasta },
      },
      select: {
        fecha: true,
        tipoComprobante: true,
        impTotal: true,
        cotizacion: true,
        stockComprobantes: {
          select: { sucursalId: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        personal: { select: { sucursalPorDefecto: true } },
      },
    }),
    prisma.sucursal.findMany({ select: { id: true, codigo: true } }),
  ]);
  const sucursalIdPorCodigo = new Map(sucursales.map((s) => [s.codigo.trim().toLowerCase(), s.id]));

  for (const r of rows) {
    const codigo = r.personal?.sucursalPorDefecto?.trim().toLowerCase() ?? "";
    const sucursalId = r.stockComprobantes[0]?.sucursalId ?? sucursalIdPorCodigo.get(codigo);
    if (!sucursalId || !esFacturaTipo(r.tipoComprobante)) continue;
    const signo = esFacturaTipoNotaCredito(r.tipoComprobante) ? -1 : 1;
    const importe = signo * Number(r.impTotal) * Number(r.cotizacion);
    const clave = clavePeriodo(r.fecha.getUTCMonth() + 1, r.fecha.getUTCFullYear());
    const porSucursal = out.get(clave) ?? {};
    porSucursal[sucursalId] = (porSucursal[sucursalId] ?? 0) + importe;
    out.set(clave, porSucursal);
  }
  for (const porSucursal of out.values()) {
    for (const id of Object.keys(porSucursal)) porSucursal[id] = redondear2(porSucursal[id]!);
  }
  return out;
}

/** Ventas del mes por nombre de sucursal (clave de `resumenBalanceMensualDesdeFilas`). */
export async function ventasPorSucursalNombreMes(
  mes: number,
  anio: number,
  sucursales: SucursalGeneraBalanceOption[]
): Promise<Record<string, number>> {
  const desde = primerDiaMes(mes, anio);
  const hasta = mes === 12 ? primerDiaMes(1, anio + 1) : primerDiaMes(mes + 1, anio);
  const porSucursalId = (await sumarVentasPorPeriodoYSucursal(desde, hasta)).get(clavePeriodo(mes, anio)) ?? {};
  const out: Record<string, number> = {};
  for (const s of sucursales) {
    const monto = porSucursalId[s.id];
    if (monto !== undefined) out[s.nombre] = monto;
  }
  return out;
}

/** Grilla de Ventas Mensuales: un periodo por mes, del mes AR actual hacia atrás hasta el mes de inicio. */
export async function listarVentasMensuales(): Promise<VentasMensualesData> {
  const actual = mesAnioCalendarioArgentina();
  const inicio = fechaDesdeVentas();
  const mesInicio = inicio.getUTCMonth() + 1;
  const anioInicio = inicio.getUTCFullYear();
  const hasta = actual.mes === 12 ? primerDiaMes(1, actual.anio + 1) : primerDiaMes(actual.mes + 1, actual.anio);

  const [sucursales, porPeriodo] = await Promise.all([
    listarSucursalesGeneraBalance(),
    sumarVentasPorPeriodoYSucursal(inicio, hasta),
  ]);

  const periodos: VentasMensualesPeriodo[] = [];
  let { mes, anio } = actual;
  while (anio > anioInicio || (anio === anioInicio && mes >= mesInicio)) {
    periodos.push({ mes, anio, porSucursalId: porPeriodo.get(clavePeriodo(mes, anio)) ?? {} });
    mes -= 1;
    if (mes < 1) {
      mes = 12;
      anio -= 1;
    }
  }
  return { periodos, sucursales };
}
