/**
 * Cx. Mercadería Vendida (`bal_cx_mercaderia`): una fila valorizada por cada línea de
 * `stock_movimientos` de venta (EGRESO) o NC (INGRESO). Costo sin IVA, congelado al registrar.
 * Venta: costo vigente (`resolverCostoCompraTiendaConOrigen`).
 * NC: costo unitario de la venta asociada (`cbte_asoc_id`) para ese ítem; si no hay, costo vigente.
 */
import type {
  BalCxMercaderiaOrigenCosto,
  Prisma,
  StockMovimientoTipo,
} from "@prisma/client";
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
import {
  cxMercVendParamsSchema,
  VISTA_CX_MERC_VEND_DEFAULT,
  type VistaCxMercVend,
} from "@/lib/validations/balCxMercaderia";
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

export interface FilaResumenCxMercVend {
  /** `YYYY-MM` (vista sucursal) o id de rubro (vista rubro). */
  clave: string;
  etiqueta: string;
  total: number;
  porSucursal: Record<string, number>;
}

/** Matriz de las vistas resumidas: filas (meses o rubros) × sucursales; CX con signo. */
export interface ResumenCxMercVend {
  columnas: OpcionFiltroCxMercVend[];
  filas: FilaResumenCxMercVend[];
  totales: { total: number; porSucursal: Record<string, number> };
}

export interface CxMercVendData {
  vista: VistaCxMercVend;
  /** Solo vista `detalle` (vacío en las resumidas). */
  filas: FilaCxMercVend[];
  total: number;
  totalPaginas: number;
  /** Suma con signo de todas las filas que cumplen los filtros (no solo la página). */
  totalCx: number;
  /** Solo vistas `sucursal` / `rubro`. */
  resumen: ResumenCxMercVend | null;
  periodos: OpcionFiltroCxMercVend[];
  rubros: OpcionFiltroCxMercVend[];
  sucursales: OpcionFiltroCxMercVend[];
  /** Mes calendario AR actual (`YYYY-MM`): valor al limpiar FECHA. */
  periodoDefault: string;
  filtros: {
    vista: VistaCxMercVend;
    periodo: string;
    rubro: string;
    sucursal: string;
    q: string;
    pagina: number;
  };
}

const CLAVE_SIN_RUBRO = "__sin_rubro__";

function cxConSigno(tipo: StockMovimientoTipo, costoTotal: Prisma.Decimal | null): number {
  const monto = Number(costoTotal ?? 0);
  return tipo === "INGRESO" ? -monto : monto;
}

function redondearResumen(resumen: ResumenCxMercVend): ResumenCxMercVend {
  const r2 = (n: number) => redondear(n, 2);
  const porSuc = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, r2(v)]));
  return {
    columnas: resumen.columnas,
    filas: resumen.filas.map((f) => ({
      ...f,
      total: r2(f.total),
      porSucursal: porSuc(f.porSucursal),
    })),
    totales: {
      total: r2(resumen.totales.total),
      porSucursal: porSuc(resumen.totales.porSucursal),
    },
  };
}

/** Arma la matriz sumando cada grupo en su fila, su sucursal y los totales. */
function armarResumen(
  columnas: OpcionFiltroCxMercVend[],
  filasBase: OpcionFiltroCxMercVend[],
  grupos: { clave: string; sucursalId: string; cx: number }[],
  filaExtra?: OpcionFiltroCxMercVend
): ResumenCxMercVend {
  const columnasIds = new Set(columnas.map((c) => c.value));
  const filas = new Map<string, FilaResumenCxMercVend>(
    filasBase.map((f) => [f.value, { clave: f.value, etiqueta: f.label, total: 0, porSucursal: {} }])
  );
  const totales = { total: 0, porSucursal: {} as Record<string, number> };
  for (const g of grupos) {
    if (!columnasIds.has(g.sucursalId)) continue;
    let fila = filas.get(g.clave);
    if (!fila && filaExtra && g.clave === filaExtra.value) {
      fila = { clave: filaExtra.value, etiqueta: filaExtra.label, total: 0, porSucursal: {} };
      filas.set(g.clave, fila);
    }
    if (!fila) continue;
    fila.total += g.cx;
    fila.porSucursal[g.sucursalId] = (fila.porSucursal[g.sucursalId] ?? 0) + g.cx;
    totales.total += g.cx;
    totales.porSucursal[g.sucursalId] = (totales.porSucursal[g.sucursalId] ?? 0) + g.cx;
  }
  return redondearResumen({ columnas, filas: [...filas.values()], totales });
}

/** Vista 1: todos los meses (más reciente primero) × sucursales; ignora FECHA. */
async function resumenCxMercVendPorSucursal(
  where: Prisma.BalCxMercaderiaWhereInput,
  columnas: OpcionFiltroCxMercVend[],
  periodos: OpcionFiltroCxMercVend[]
): Promise<ResumenCxMercVend> {
  const rows = await prisma.balCxMercaderia.groupBy({
    by: ["fecha", "sucursalId", "tipoMovimiento"],
    where,
    _sum: { costoTotal: true },
  });
  return armarResumen(
    columnas,
    periodos,
    rows.map((r) => ({
      clave: clavePeriodoEstPorProd(r.fecha.getUTCMonth() + 1, r.fecha.getUTCFullYear()),
      sucursalId: r.sucursalId,
      cx: cxConSigno(r.tipoMovimiento, r._sum.costoTotal),
    }))
  );
}

/** Vista 2: rubros × sucursales del mes elegido. */
async function resumenCxMercVendPorRubro(
  where: Prisma.BalCxMercaderiaWhereInput,
  columnas: OpcionFiltroCxMercVend[],
  rubros: OpcionFiltroCxMercVend[]
): Promise<ResumenCxMercVend> {
  const rows = await prisma.balCxMercaderia.groupBy({
    by: ["codItem", "sucursalId", "tipoMovimiento"],
    where,
    _sum: { costoTotal: true },
  });
  const codItems = [...new Set(rows.map((r) => r.codItem))];
  const productos =
    codItems.length > 0
      ? await prisma.prodPropio.findMany({
          where: { codTienda: { in: codItems } },
          select: { codTienda: true, idRubro: true },
        })
      : [];
  const rubroPorCod = new Map(productos.map((p) => [p.codTienda, p.idRubro]));
  return armarResumen(
    columnas,
    rubros,
    rows.map((r) => ({
      clave: rubroPorCod.get(r.codItem) ?? CLAVE_SIN_RUBRO,
      sucursalId: r.sucursalId,
      cx: cxConSigno(r.tipoMovimiento, r._sum.costoTotal),
    })),
    { value: CLAVE_SIN_RUBRO, label: "SIN RUBRO" }
  );
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
  /** `null` = sin filtro de fecha (vista por sucursal). */
  periodo: PeriodoMesAnio | null;
  rubro: string;
  sucursal: string;
  q: string;
}): Prisma.BalCxMercaderiaWhereInput {
  const parts: Prisma.BalCxMercaderiaWhereInput[] = [];
  if (params.periodo) {
    const { mes, anio } = params.periodo;
    parts.push({
      fecha: {
        gte: new Date(Date.UTC(anio, mes - 1, 1)),
        lt: new Date(Date.UTC(anio, mes, 1)),
      },
    });
  }
  if (params.sucursal) parts.push({ sucursalId: params.sucursal });
  const prod: Prisma.ProdPropioWhereInput[] = [];
  if (params.rubro) prod.push({ idRubro: params.rubro });
  const texto = filtroTexto(params.q, ["descripcionTienda", "codTienda"]);
  if (texto.AND?.length) prod.push(texto);
  if (prod.length > 0) parts.push({ prodTienda: { AND: prod } });
  return { AND: parts };
}

async function listarDetalleCxMercVend(
  where: Prisma.BalCxMercaderiaWhereInput,
  pagina: number
): Promise<Pick<CxMercVendData, "filas" | "total" | "totalPaginas" | "totalCx">> {
  const [rows, total, sumas] = await Promise.all([
    prisma.balCxMercaderia.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { codItem: "asc" }],
      skip: (pagina - 1) * PAGE_SIZE,
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
  ]);
  const totalCx = sumas.reduce((acc, s) => acc + cxConSigno(s.tipoMovimiento, s._sum.costoTotal), 0);
  return {
    filas: rows.map((r) => ({
      id: r.id,
      fechaIso: isoYmdFromPrismaDateOnly(r.fecha),
      codItem: r.codItem,
      descripcion: r.prodTienda.descripcionTienda ?? "",
      cx: cxConSigno(r.tipoMovimiento, r.costoTotal),
      sucursalNombre: r.sucursal.nombre.toLocaleUpperCase("es-AR"),
      esNotaCredito: r.tipoMovimiento === "INGRESO",
    })),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totalCx: redondear(totalCx, 2),
  };
}

/**
 * Finanzas · Balance · Cx Merc. Vend. (`bal_cx_mercaderia`), 3 vistas:
 * `sucursal` (meses × sucursales, ignora FECHA), `rubro` (rubros × sucursales del mes) y
 * `detalle` (líneas paginadas del mes). RUBRO / SUC / texto aplican a todas; SUC limita las columnas.
 * Periodo inválido → mes AR actual.
 */
export async function listarCxMercVendData(raw: {
  vista?: string;
  periodo?: string;
  rubro?: string;
  sucursal?: string;
  q?: string;
  pagina?: string;
}): Promise<CxMercVendData> {
  const actual = mesAnioCalendarioArgentina();
  const periodoDefault = clavePeriodoEstPorProd(actual.mes, actual.anio);
  const parsed = cxMercVendParamsSchema.safeParse({
    vista: raw.vista || VISTA_CX_MERC_VEND_DEFAULT,
    periodo: raw.periodo || periodoDefault,
    rubro: raw.rubro ?? "",
    sucursal: raw.sucursal ?? "",
    q: raw.q ?? "",
    pagina: raw.pagina ?? 1,
  });
  const filtros = parsed.success
    ? parsed.data
    : {
        vista: VISTA_CX_MERC_VEND_DEFAULT,
        periodo: periodoDefault,
        rubro: "",
        sucursal: "",
        q: "",
        pagina: 1,
      };
  const periodo = parseClavePeriodoEstPorProd(filtros.periodo) ?? actual;

  const [periodos, rubrosRows, sucursalesRows] = await Promise.all([
    listarPeriodosCxMercVend(actual),
    listarRubrosCatalogoReglasDesdeProdTienda(),
    prisma.sucursal.findMany({
      where: { cxMercaderia: { some: {} } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const rubros = rubrosRows.map((r) => ({
    value: r.id,
    label: r.nombre.toLocaleUpperCase("es-AR"),
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
    rubros,
    sucursales,
    periodoDefault,
    filtros: { ...filtros, periodo: clavePeriodoEstPorProd(periodo.mes, periodo.anio) },
  };
  const sinDetalle = { filas: [], total: 0, totalPaginas: 1, totalCx: 0 };

  if (filtros.vista === "sucursal") {
    const where = whereCxMercVend({ ...filtros, periodo: null });
    const resumen = await resumenCxMercVendPorSucursal(where, columnas, periodos);
    return { ...base, ...sinDetalle, totalCx: resumen.totales.total, resumen };
  }
  if (filtros.vista === "rubro") {
    const where = whereCxMercVend({ ...filtros, periodo });
    const filasRubro = filtros.rubro ? rubros.filter((r) => r.value === filtros.rubro) : rubros;
    const resumen = await resumenCxMercVendPorRubro(where, columnas, filasRubro);
    return { ...base, ...sinDetalle, totalCx: resumen.totales.total, resumen };
  }
  const detalle = await listarDetalleCxMercVend(
    whereCxMercVend({ ...filtros, periodo }),
    filtros.pagina
  );
  return { ...base, ...detalle, resumen: null };
}
