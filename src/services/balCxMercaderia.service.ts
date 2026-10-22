/**
 * Cx. Mercadería Vendida (`bal_cx_mercaderia`): una fila valorizada por cada línea de
 * `stock_movimientos` de venta (EGRESO) o NC (INGRESO). Costo sin IVA, congelado al registrar.
 * Venta: costo vigente (`resolverCostoCompraTiendaConOrigen`).
 * NC: costo unitario de la venta asociada (`cbte_asoc_id`) para ese ítem; si no hay, costo vigente.
 */
import type { BalCxMercaderiaOrigenCosto, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { cantidadDesdePrisma } from "@/lib/cantidadUnDecimal";
import {
  clavePeriodoEstPorProd,
  etiquetaPeriodoCortoEstPorProd,
  parseClavePeriodoEstPorProd,
} from "@/lib/estPorProdPeriodo";
import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";
import { PAGE_SIZE } from "@/lib/pagination";
import { cxMercVendParamsSchema } from "@/lib/validations/balCxMercaderia";
import {
  resolverCostoCompraTiendaConOrigen,
  SELECT_COSTO_COMPRA_TIENDA,
} from "@/services/costoListaTienda.service";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import { listarRubrosCatalogoReglasDesdeProdTienda } from "@/services/rubrosProdTienda.service";

function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/** `cod_item` → costo unitario promedio de los EGRESOS de esa venta. */
async function costoUnitarioVentaOriginalPorItem(
  tx: Prisma.TransactionClient,
  comprobanteVentaId: string
): Promise<Map<string, number>> {
  const rows = await tx.balCxMercaderia.groupBy({
    by: ["codItem"],
    where: { comprobanteVtaId: comprobanteVentaId, tipoMovimiento: "EGRESO" },
    _sum: { cantidad: true, costoTotal: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const cant = cantidadDesdePrisma(r._sum.cantidad);
    if (cant <= 0) continue;
    map.set(r.codItem, Number(r._sum.costoTotal ?? 0) / cant);
  }
  return map;
}

/**
 * Valoriza las líneas del `stock_comprobantes` recién creado para la venta / NC.
 * Debe correr en la misma transacción que el ledger de stock.
 */
export async function registrarCxMercaderiaDeStockEnTx(
  tx: Prisma.TransactionClient,
  input: {
    comprobanteVtaId: string;
    stockComprobanteId: string;
    fecha: Date;
    /** NC: venta asociada (`vtas_comprobantes.cbte_asoc_id`). */
    comprobanteVentaOriginalId?: string | null;
  }
): Promise<number> {
  const movimientos = await tx.stockMovimiento.findMany({
    where: { comprobanteRelacionadoId: input.stockComprobanteId },
    select: {
      id: true,
      tipoMovimiento: true,
      codItem: true,
      sucursalId: true,
      cantidad: true,
    },
  });
  if (movimientos.length === 0) return 0;

  const codItems = [...new Set(movimientos.map((m) => m.codItem))];
  const [productos, costoVentaOriginal] = await Promise.all([
    tx.prodPropio.findMany({
      where: { codTienda: { in: codItems } },
      select: { codTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
    }),
    input.comprobanteVentaOriginalId
      ? costoUnitarioVentaOriginalPorItem(tx, input.comprobanteVentaOriginalId)
      : Promise.resolve(new Map<string, number>()),
  ]);
  const costoVigente = new Map(
    productos.map((p) => [p.codTienda, resolverCostoCompraTiendaConOrigen(p)])
  );

  const data = movimientos.map((m) => {
    const cantidad = cantidadDesdePrisma(m.cantidad);
    const original =
      m.tipoMovimiento === "INGRESO" ? costoVentaOriginal.get(m.codItem) : undefined;
    const vigente = costoVigente.get(m.codItem) ?? { costo: 0, origen: "SIN_COSTO" as const };
    const costoUnitario = redondear(original ?? vigente.costo, 4);
    const origenCosto: BalCxMercaderiaOrigenCosto =
      original !== undefined ? "VENTA_ORIGINAL" : vigente.origen;
    return {
      tipoMovimiento: m.tipoMovimiento,
      comprobanteVtaId: input.comprobanteVtaId,
      stockMovimientoId: m.id,
      codItem: m.codItem,
      sucursalId: m.sucursalId,
      fecha: input.fecha,
      cantidad,
      costoUnitario,
      costoTotal: redondear(costoUnitario * cantidad, 2),
      origenCosto,
    };
  });

  await tx.balCxMercaderia.createMany({ data });
  return data.length;
}

export interface OpcionFiltroCxMercVend {
  value: string;
  label: string;
}

export interface FilaCxMercVend {
  id: string;
  fechaIso: string;
  codItem: string;
  descripcion: string;
  /** Costo total sin IVA con signo: venta (+), NC (−). */
  cx: number;
  sucursalNombre: string;
  esNotaCredito: boolean;
}

export interface CxMercVendData {
  filas: FilaCxMercVend[];
  total: number;
  totalPaginas: number;
  /** Suma con signo de todas las filas que cumplen los filtros (no solo la página). */
  totalCx: number;
  periodos: OpcionFiltroCxMercVend[];
  rubros: OpcionFiltroCxMercVend[];
  sucursales: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: { periodo: string; rubro: string; sucursal: string; q: string; pagina: number };
}

type PeriodoMesAnio = { mes: number; anio: number };

function compararPeriodo(a: PeriodoMesAnio, b: PeriodoMesAnio): number {
  return a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes;
}

/** Periodos con registros + mes calendario AR actual, del más reciente al más antiguo. */
async function listarPeriodosCxMercVend(
  actual: PeriodoMesAnio
): Promise<OpcionFiltroCxMercVend[]> {
  const agg = await prisma.balCxMercaderia.aggregate({
    _min: { fecha: true },
    _max: { fecha: true },
  });
  const desdeFecha = (d: Date | null): PeriodoMesAnio | null =>
    d ? { mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear() } : null;
  const min = desdeFecha(agg._min.fecha) ?? actual;
  const maxData = desdeFecha(agg._max.fecha);
  const max = maxData && compararPeriodo(maxData, actual) > 0 ? maxData : actual;
  const desde = compararPeriodo(min, max) < 0 ? min : max;

  const out: OpcionFiltroCxMercVend[] = [];
  let { mes, anio } = max;
  while (compararPeriodo({ mes, anio }, desde) >= 0 && out.length < 600) {
    out.push({
      value: clavePeriodoEstPorProd(mes, anio),
      label: etiquetaPeriodoCortoEstPorProd(mes, anio).toLocaleUpperCase("es-AR"),
    });
    mes -= 1;
    if (mes < 1) {
      mes = 12;
      anio -= 1;
    }
  }
  return out;
}

function whereCxMercVend(params: {
  periodo: PeriodoMesAnio;
  rubro: string;
  sucursal: string;
  q: string;
}): Prisma.BalCxMercaderiaWhereInput {
  const { mes, anio } = params.periodo;
  const parts: Prisma.BalCxMercaderiaWhereInput[] = [
    {
      fecha: {
        gte: new Date(Date.UTC(anio, mes - 1, 1)),
        lt: new Date(Date.UTC(anio, mes, 1)),
      },
    },
  ];
  if (params.sucursal) parts.push({ sucursalId: params.sucursal });
  const prod: Prisma.ProdPropioWhereInput[] = [];
  if (params.rubro) prod.push({ idRubro: params.rubro });
  const texto = filtroTexto(params.q, ["descripcionTienda", "codTienda"]);
  if (texto.AND?.length) prod.push(texto);
  if (prod.length > 0) parts.push({ prodTienda: { AND: prod } });
  return { AND: parts };
}

/**
 * Finanzas · Balance · Cx Merc. Vend.: líneas de `bal_cx_mercaderia` del mes elegido,
 * filtrables por rubro, sucursal y texto (descripción / código). Periodo inválido → mes AR actual.
 */
export async function listarCxMercVendData(raw: {
  periodo?: string;
  rubro?: string;
  sucursal?: string;
  q?: string;
  pagina?: string;
}): Promise<CxMercVendData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = cxMercVendParamsSchema.safeParse({
    periodo: raw.periodo || periodoDefault,
    rubro: raw.rubro ?? "",
    sucursal: raw.sucursal ?? "",
    q: raw.q ?? "",
    pagina: raw.pagina ?? 1,
  });
  const filtros = parsed.success
    ? parsed.data
    : { periodo: periodoDefault, rubro: "", sucursal: "", q: "", pagina: 1 };
  const periodo = parseClavePeriodoEstPorProd(filtros.periodo) ?? actual;
  const where = whereCxMercVend({ ...filtros, periodo });

  const [rows, total, sumas, periodos, rubros, sucursales] = await Promise.all([
    prisma.balCxMercaderia.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { codItem: "asc" }],
      skip: (filtros.pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fecha: true,
        codItem: true,
        tipoMovimiento: true,
        costoTotal: true,
        prodTienda: { select: { descripcionTienda: true } },
        sucursal: { select: { nombre: true } },
      },
    }),
    prisma.balCxMercaderia.count({ where }),
    prisma.balCxMercaderia.groupBy({
      by: ["tipoMovimiento"],
      where,
      _sum: { costoTotal: true },
    }),
    listarPeriodosCxMercVend(actual),
    listarRubrosCatalogoReglasDesdeProdTienda(),
    prisma.sucursal.findMany({
      where: { cxMercaderia: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const totalCx = sumas.reduce((acc, s) => {
    const monto = Number(s._sum.costoTotal ?? 0);
    return s.tipoMovimiento === "INGRESO" ? acc - monto : acc + monto;
  }, 0);

  return {
    filas: rows.map((r) => {
      const esNotaCredito = r.tipoMovimiento === "INGRESO";
      const monto = Number(r.costoTotal);
      return {
        id: r.id,
        fechaIso: isoYmdFromPrismaDateOnly(r.fecha),
        codItem: r.codItem,
        descripcion: r.prodTienda.descripcionTienda ?? "",
        cx: esNotaCredito ? -monto : monto,
        sucursalNombre: r.sucursal.nombre.toLocaleUpperCase("es-AR"),
        esNotaCredito,
      };
    }),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totalCx: Math.round(totalCx * 100) / 100,
    periodos,
    rubros: rubros.map((r) => ({ value: r.id, label: r.nombre.toLocaleUpperCase("es-AR") })),
    sucursales: sucursales.map((s) => ({
      value: s.id,
      label: s.nombre.toLocaleUpperCase("es-AR"),
    })),
    periodoDefault,
    filtros: { ...filtros, periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
}
