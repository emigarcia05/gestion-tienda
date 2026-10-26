/**
 * Balance mensual · Costos Variables que salen de libros (no de Gastos): `bal_cx_mercaderia`,
 * `bal_cx_financiero`, `bal_iva` (posición del mes, nunca negativa) y `bal_iibb`.
 * Se devuelven como filas sintéticas `BalanceGastoMensualFila` (tipo GASTO VARIABLE, sin
 * `gastoFinalId`) para que el resumen, el reparto por sucursal y los modales de detalle las
 * traten igual que una imputación. Los gastos manuales que reemplazan se excluyen.
 */
import { prisma } from "@/lib/prisma";
import {
  esGastoReemplazadoPorLibro,
  LIBROS_BALANCE_MENSUAL,
  SUCURSAL_REPARTO_LIBROS,
  TIPO_GASTO_LIBROS_BALANCE,
  type LibroBalanceMensual,
} from "@/lib/balanceMensualLibros";
import {
  isoFechaDevengo,
  listarImputacionesMensualesBalance,
  type BalanceGastoMensualFila,
} from "@/services/finBalGastoMensualBalance.service";
import {
  mapaSucursalIdPorCodigo,
  SELECT_SUCURSAL_VENTA,
  sucursalIdDeVenta,
} from "@/services/ventasMensuales.service";

/** Importe por `sucursales.id`; `null` = sin sucursal (se reparte en partes iguales). */
type MontosPorSucursal = Map<string | null, number>;

interface SucursalLibro {
  nombre: string;
  generaBalance: boolean;
  centroCosto: boolean;
}

function rangoMes(mes: number, anio: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
}

function sumar(montos: MontosPorSucursal, sucursalId: string | null | undefined, monto: number) {
  const k = sucursalId ?? null;
  montos.set(k, (montos.get(k) ?? 0) + monto);
}

/** Cx Merc. Vend.: venta (+), NC (−). */
async function cxMercaderiaPorSucursal(fecha: { gte: Date; lt: Date }): Promise<MontosPorSucursal> {
  const rows = await prisma.balCxMercaderia.groupBy({
    by: ["sucursalId", "tipoMovimiento"],
    where: { fecha },
    _sum: { costoTotal: true },
  });
  const out: MontosPorSucursal = new Map();
  for (const r of rows) {
    const signo = r.tipoMovimiento === "INGRESO" ? -1 : 1;
    sumar(out, r.sucursalId, signo * Number(r._sum.costoTotal ?? 0));
  }
  return out;
}

/** Cx Fin Cobros: cobro (+), devolución de NC (−). */
async function cxFinancieroPorSucursal(fecha: { gte: Date; lt: Date }): Promise<MontosPorSucursal> {
  const rows = await prisma.balCxFinanciero.groupBy({
    by: ["sucursalId", "tipoMovimiento"],
    where: { fecha },
    _sum: { cxTotal: true },
  });
  const out: MontosPorSucursal = new Map();
  for (const r of rows) {
    const signo = r.tipoMovimiento === "EGRESO" ? -1 : 1;
    sumar(out, r.sucursalId, signo * Number(r._sum.cxTotal ?? 0));
  }
  return out;
}

/**
 * IVA a pagar del mes (Σ débito − Σ crédito de las filas de ese mes). Sucursal por origen: venta →
 * la de la venta; gasto → la de la imputación; Cx Fin → la del movimiento; compra y ajuste → reparto.
 * Si el total del mes da ≤ 0 (saldo a favor) no suma nada.
 */
async function ivaPorSucursal(
  fecha: { gte: Date; lt: Date },
  sucursalIdPorCodigo: Map<string, string>
): Promise<MontosPorSucursal> {
  const rows = await prisma.balIva.findMany({
    where: { fecha },
    select: {
      debito: true,
      credito: true,
      comprobanteVta: { select: SELECT_SUCURSAL_VENTA },
      gastoMensual: {
        select: { imputacionSucursalId: true, gastoFinal: { select: { sucursalId: true } } },
      },
      tesoreriaMovimiento: { select: { sucursalId: true } },
    },
  });
  const out: MontosPorSucursal = new Map();
  let total = 0;
  for (const r of rows) {
    const neto = Number(r.debito) - Number(r.credito);
    total += neto;
    const sucursalId = r.comprobanteVta
      ? sucursalIdDeVenta(r.comprobanteVta, sucursalIdPorCodigo)
      : r.gastoMensual
        ? (r.gastoMensual.imputacionSucursalId ?? r.gastoMensual.gastoFinal.sucursalId)
        : r.tesoreriaMovimiento?.sucursalId;
    sumar(out, sucursalId, neto);
  }
  return total > 0 ? out : new Map();
}

/** IIBB del mes: venta → sucursal de la venta; ajuste → reparto. */
async function iibbPorSucursal(
  fecha: { gte: Date; lt: Date },
  sucursalIdPorCodigo: Map<string, string>
): Promise<MontosPorSucursal> {
  const rows = await prisma.balIibb.findMany({
    where: { fecha },
    select: { debito: true, comprobanteVta: { select: SELECT_SUCURSAL_VENTA } },
  });
  const out: MontosPorSucursal = new Map();
  for (const r of rows) {
    const sucursalId = r.comprobanteVta
      ? sucursalIdDeVenta(r.comprobanteVta, sucursalIdPorCodigo)
      : null;
    sumar(out, sucursalId, Number(r.debito));
  }
  return out;
}

function filasDeLibro(
  libro: LibroBalanceMensual,
  montos: MontosPorSucursal,
  sucursales: Map<string, SucursalLibro>,
  mes: number,
  anio: number
): BalanceGastoMensualFila[] {
  const def = LIBROS_BALANCE_MENSUAL[libro];
  const fechaIso = isoFechaDevengo(anio, mes, 1);
  const out: BalanceGastoMensualFila[] = [];
  for (const [sucursalId, montoRaw] of montos) {
    const monto = Math.round(montoRaw);
    if (monto === 0) continue;
    const suc = sucursalId ? sucursales.get(sucursalId) : undefined;
    out.push({
      id: `libro:${libro}:${sucursalId ?? "reparto"}`,
      gastoFinalId: "",
      mes,
      anio,
      fechaDevengoIso: fechaIso,
      sucursalNombre: suc?.nombre ?? SUCURSAL_REPARTO_LIBROS,
      sucursalGeneraBalance: suc?.generaBalance ?? false,
      sucursalCentroCosto: suc?.centroCosto ?? true,
      tipoGastoNombre: TIPO_GASTO_LIBROS_BALANCE,
      esGastoMensual: true,
      rubroNombre: def.rubro,
      gastoNombre: def.gasto,
      gastoFinalComentarios: null,
      proveedorNombre: def.fuente,
      monto,
      pagado: 0,
      fechaVencimientoIso: fechaIso,
      montoVencido: 0,
      discriminaIva: false,
    });
  }
  return out;
}

/** Filas sintéticas de Cx Merc., Cx Fin, IVA e IIBB del mes (una por libro × sucursal). */
export async function listarFilasLibrosBalanceMensual(
  mes: number,
  anio: number
): Promise<BalanceGastoMensualFila[]> {
  const fecha = rangoMes(mes, anio);
  const [sucursalesRows, sucursalIdPorCodigo] = await Promise.all([
    prisma.sucursal.findMany({
      select: { id: true, nombre: true, generaBalance: true, centroCosto: true },
    }),
    mapaSucursalIdPorCodigo(),
  ]);
  const sucursales = new Map(
    sucursalesRows.map((s) => [
      s.id,
      { nombre: s.nombre.toUpperCase(), generaBalance: s.generaBalance, centroCosto: s.centroCosto },
    ])
  );
  const [cxMercaderia, cxFinanciero, iva, iibb] = await Promise.all([
    cxMercaderiaPorSucursal(fecha),
    cxFinancieroPorSucursal(fecha),
    ivaPorSucursal(fecha, sucursalIdPorCodigo),
    iibbPorSucursal(fecha, sucursalIdPorCodigo),
  ]);
  return [
    ...filasDeLibro("cxMercaderia", cxMercaderia, sucursales, mes, anio),
    ...filasDeLibro("cxFinanciero", cxFinanciero, sucursales, mes, anio),
    ...filasDeLibro("iva", iva, sucursales, mes, anio),
    ...filasDeLibro("iibb", iibb, sucursales, mes, anio),
  ];
}

/**
 * Filas del Balance mensual de un mes: imputaciones de Gastos (sin las que reemplaza un libro:
 * `esGastoReemplazadoPorLibro`) + filas de libros.
 */
export async function listarFilasBalanceMensual(
  mes: number,
  anio: number
): Promise<BalanceGastoMensualFila[]> {
  const [imputaciones, libros] = await Promise.all([
    listarImputacionesMensualesBalance({ meses: [mes], anio }),
    listarFilasLibrosBalanceMensual(mes, anio),
  ]);
  return [
    ...imputaciones.filter((f) => !esGastoReemplazadoPorLibro(f.tipoGastoNombre, f.gastoNombre)),
    ...libros,
  ];
}
