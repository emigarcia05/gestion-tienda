/**
 * Cx. Mercadería Vendida (`bal_cx_mercaderia`): 1–2 filas valorizadas por cada línea de
 * `stock_movimientos` de venta (EGRESO) o NC (INGRESO). Costo sin IVA, congelado al registrar.
 * Venta: lote DESC. POR STOCK con saldo y luego costo vigente (`resolverCostoCompraTiendaConOrigen`).
 * NC: devuelve al lote lo que la venta asociada (`cbte_asoc_id`) consumió de él; el resto al
 * costo de esa venta; si no hay venta asociada, costo vigente.
 */
import {
  Prisma,
  type BalCxMercaderiaOrigenCosto,
  type StockMovimientoTipo,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { cantidadDesdePrisma, redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
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

/** Porción de un lote DESC. POR STOCK (vendida o con saldo) para un ítem. */
type PorcionLote = { descPromoId: string; cantidad: number; costoUnitario: number };

/** Costos de la venta original de una NC, separados en porciones de lote y resto. */
type CostoVentaOriginalItem = {
  lotes: PorcionLote[];
  /** Promedio de las filas sin lote (si hubo). */
  costoNormal: number | null;
  /** Promedio de todas las filas del ítem. */
  costoPromedio: number;
};

function claveLote(descPromoId: string, codItem: string): string {
  return `${descPromoId}:${codItem}`;
}

/**
 * `cod_item` → costos de los EGRESOS de esa venta. Las porciones de lote ya descuentan
 * lo devuelto por NC anteriores de la misma venta.
 */
async function costosVentaOriginalPorItem(
  tx: Prisma.TransactionClient,
  comprobanteVentaId: string
): Promise<Map<string, CostoVentaOriginalItem>> {
  const ncs = await tx.comprobanteVta.findMany({
    where: { cbteAsocId: comprobanteVentaId },
    select: { id: true },
  });
  const [rows, devueltos] = await Promise.all([
    tx.balCxMercaderia.groupBy({
      by: ["codItem", "descPromoId"],
      where: { comprobanteVtaId: comprobanteVentaId, tipoMovimiento: "EGRESO" },
      _sum: { cantidad: true, costoTotal: true },
    }),
    ncs.length === 0
      ? Promise.resolve([])
      : tx.balCxMercaderia.groupBy({
          by: ["codItem", "descPromoId"],
          where: {
            comprobanteVtaId: { in: ncs.map((n) => n.id) },
            tipoMovimiento: "INGRESO",
            descPromoId: { not: null },
          },
          _sum: { cantidad: true },
        }),
  ]);
  const devuelto = new Map<string, number>();
  for (const d of devueltos) {
    if (!d.descPromoId) continue;
    devuelto.set(claveLote(d.descPromoId, d.codItem), cantidadDesdePrisma(d._sum.cantidad));
  }

  const acum = new Map<
    string,
    { cant: number; total: number; cantNormal: number; totalNormal: number; lotes: PorcionLote[] }
  >();
  for (const r of rows) {
    const cant = cantidadDesdePrisma(r._sum.cantidad);
    if (cant <= 0) continue;
    const total = Number(r._sum.costoTotal ?? 0);
    const a = acum.get(r.codItem) ?? { cant: 0, total: 0, cantNormal: 0, totalNormal: 0, lotes: [] };
    a.cant += cant;
    a.total += total;
    if (r.descPromoId) {
      const disponible = redondearCantidadUnDecimal(
        cant - (devuelto.get(claveLote(r.descPromoId, r.codItem)) ?? 0)
      );
      if (disponible > 0) {
        a.lotes.push({ descPromoId: r.descPromoId, cantidad: disponible, costoUnitario: total / cant });
      }
    } else {
      a.cantNormal += cant;
      a.totalNormal += total;
    }
    acum.set(r.codItem, a);
  }
  const map = new Map<string, CostoVentaOriginalItem>();
  for (const [codItem, a] of acum) {
    map.set(codItem, {
      lotes: a.lotes,
      costoNormal: a.cantNormal > 0 ? a.totalNormal / a.cantNormal : null,
      costoPromedio: a.total / a.cant,
    });
  }
  return map;
}

/**
 * Lotes DESC. POR STOCK con saldo de esos ítems, bloqueados (`FOR UPDATE`) hasta el fin de
 * la tx. Orden: prioridad del descuento (1 = primero en consumirse).
 */
async function lotesConSaldoParaVenta(
  tx: Prisma.TransactionClient,
  codItems: readonly string[]
): Promise<Map<string, PorcionLote[]>> {
  const out = new Map<string, PorcionLote[]>();
  if (codItems.length === 0) return out;
  const rows = await tx.$queryRaw<
    {
      promo_id: string;
      cod_tienda: string;
      saldo: Prisma.Decimal;
      costo_unitario: Prisma.Decimal;
    }[]
  >`
    SELECT i.promo_id, i.cod_tienda,
           (i.cantidad - i.cantidad_consumida) AS saldo, i.costo_unitario
    FROM desc_promo_items i
    INNER JOIN desc_promo d ON d.id = i.promo_id
    WHERE d.categoria = 'STOCK'
      AND i.cod_tienda IN (${Prisma.join([...codItems])})
      AND i.cantidad IS NOT NULL
      AND i.cantidad > i.cantidad_consumida
    ORDER BY d.prioridad ASC, d.id ASC
    FOR UPDATE OF i
  `;
  for (const r of rows) {
    const lista = out.get(r.cod_tienda) ?? [];
    lista.push({
      descPromoId: r.promo_id,
      cantidad: cantidadDesdePrisma(r.saldo),
      costoUnitario: r.costo_unitario.toNumber(),
    });
    out.set(r.cod_tienda, lista);
  }
  return out;
}

/** Suma (venta) o resta (NC / reversión) unidades consumidas de un lote; nunca sale de [0, cantidad]. */
async function moverConsumoLote(
  tx: Prisma.TransactionClient,
  descPromoId: string,
  codItem: string,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  await tx.$executeRaw`
    UPDATE desc_promo_items
    SET cantidad_consumida = LEAST(cantidad, GREATEST(0, cantidad_consumida + ${delta}))
    WHERE promo_id = ${descPromoId}
      AND cod_tienda = ${codItem}
      AND cantidad IS NOT NULL
  `;
}

type FilaCxNueva = Prisma.BalCxMercaderiaCreateManyInput;

/**
 * Valoriza las líneas del `stock_comprobantes` recién creado para la venta / NC.
 * Debe correr en la misma transacción que el ledger de stock.
 * Venta: consume lotes DESC. POR STOCK con saldo (fila propia a `costo_unitario` del lote);
 * el resto, costo vigente. NC: devuelve primero al lote lo que esa venta consumió de él.
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
  const codItemsEgreso = [
    ...new Set(movimientos.filter((m) => m.tipoMovimiento === "EGRESO").map((m) => m.codItem)),
  ];
  const [productos, costoVentaOriginal, lotesVenta] = await Promise.all([
    tx.prodPropio.findMany({
      where: { codTienda: { in: codItems } },
      select: { codTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
    }),
    input.comprobanteVentaOriginalId
      ? costosVentaOriginalPorItem(tx, input.comprobanteVentaOriginalId)
      : Promise.resolve(new Map<string, CostoVentaOriginalItem>()),
    lotesConSaldoParaVenta(tx, codItemsEgreso),
  ]);
  const costoVigente = new Map(
    productos.map((p) => [p.codTienda, resolverCostoCompraTiendaConOrigen(p)])
  );

  const data: FilaCxNueva[] = [];
  const deltaLotes = new Map<string, { descPromoId: string; codItem: string; delta: number }>();
  const fila = (
    m: (typeof movimientos)[number],
    cantidad: number,
    costo: number,
    origenCosto: BalCxMercaderiaOrigenCosto,
    descPromoId: string | null
  ): FilaCxNueva => {
    const costoUnitario = redondear(costo, 4);
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
      descPromoId,
    };
  };
  const consumir = (porciones: PorcionLote[], m: (typeof movimientos)[number], resto: number, signo: 1 | -1) => {
    for (const p of porciones) {
      if (resto <= 0) break;
      const tomar = redondearCantidadUnDecimal(Math.min(resto, p.cantidad));
      if (tomar <= 0) continue;
      p.cantidad = redondearCantidadUnDecimal(p.cantidad - tomar);
      resto = redondearCantidadUnDecimal(resto - tomar);
      data.push(fila(m, tomar, p.costoUnitario, "DESC_STOCK", p.descPromoId));
      const clave = claveLote(p.descPromoId, m.codItem);
      const actual = deltaLotes.get(clave) ?? { descPromoId: p.descPromoId, codItem: m.codItem, delta: 0 };
      actual.delta = redondearCantidadUnDecimal(actual.delta + signo * tomar);
      deltaLotes.set(clave, actual);
    }
    return resto;
  };

  for (const m of movimientos) {
    const cantidad = cantidadDesdePrisma(m.cantidad);
    const vigente = costoVigente.get(m.codItem) ?? { costo: 0, origen: "SIN_COSTO" as const };
    if (m.tipoMovimiento === "EGRESO") {
      const resto = consumir(lotesVenta.get(m.codItem) ?? [], m, cantidad, 1);
      if (resto > 0) data.push(fila(m, resto, vigente.costo, vigente.origen, null));
      continue;
    }
    const original = costoVentaOriginal.get(m.codItem);
    if (!original) {
      data.push(fila(m, cantidad, vigente.costo, vigente.origen, null));
      continue;
    }
    const resto = consumir(original.lotes, m, cantidad, -1);
    if (resto > 0) {
      data.push(
        fila(m, resto, original.costoNormal ?? original.costoPromedio, "VENTA_ORIGINAL", null)
      );
    }
  }

  await tx.balCxMercaderia.createMany({ data });
  for (const d of deltaLotes.values()) {
    await moverConsumoLote(tx, d.descPromoId, d.codItem, d.delta);
  }
  return data.length;
}

/**
 * Antes de borrar el ledger de una venta / NC: deshace lo que movió en lotes DESC. POR STOCK
 * (venta devuelve saldo; NC lo vuelve a consumir).
 */
export async function revertirConsumoLotesDescPromoEnTx(
  tx: Prisma.TransactionClient,
  comprobanteVtaId: string
): Promise<void> {
  const rows = await tx.balCxMercaderia.groupBy({
    by: ["descPromoId", "codItem", "tipoMovimiento"],
    where: { comprobanteVtaId, descPromoId: { not: null } },
    _sum: { cantidad: true },
  });
  for (const r of rows) {
    if (!r.descPromoId) continue;
    const cant = cantidadDesdePrisma(r._sum.cantidad);
    await moverConsumoLote(
      tx,
      r.descPromoId,
      r.codItem,
      r.tipoMovimiento === "EGRESO" ? -cant : cant
    );
  }
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
  /** Venta / NC que generó el movimiento (botón VER). */
  comprobanteVtaId: string;
}

export interface FilaResumenCxMercVend {
  /** `YYYY-MM` (vista sucursal), id de rubro o `__sin_rubro__` (vista rubro), id de forma (Cx Fin). */
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

/** Fila / filtro RUBRO de productos sin rubro (`prod_tienda.id_rubro` null). */
const CLAVE_SIN_RUBRO = "__sin_rubro__";
const OPCION_SIN_RUBRO: OpcionFiltroCxMercVend = { value: CLAVE_SIN_RUBRO, label: "SIN RUBRO" };

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

/** Arma la matriz sumando cada grupo en su fila, su sucursal y los totales (también Cx Fin Cobros). */
export function armarResumen(
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
    OPCION_SIN_RUBRO
  );
}

export type PeriodoMesAnio = { mes: number; anio: number };

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
  return opcionesPeriodoCx(agg._min.fecha, agg._max.fecha, actual);
}

/** Meses entre la fecha mínima y máxima (o el mes actual si es posterior), del más reciente al más antiguo. */
export function opcionesPeriodoCx(
  minFecha: Date | null,
  maxFecha: Date | null,
  actual: PeriodoMesAnio
): OpcionFiltroCxMercVend[] {
  const desdeFecha = (d: Date | null): PeriodoMesAnio | null =>
    d ? { mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear() } : null;
  const min = desdeFecha(minFecha) ?? actual;
  const maxData = desdeFecha(maxFecha);
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

/** Rango `[1° del mes, 1° del mes siguiente)` sobre una columna DATE. */
export function rangoFechaPeriodoCx(p: PeriodoMesAnio): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(p.anio, p.mes - 1, 1)),
    lt: new Date(Date.UTC(p.anio, p.mes, 1)),
  };
}

function whereCxMercVend(params: {
  /** `null` = sin filtro de fecha (vista por sucursal). */
  periodo: PeriodoMesAnio | null;
  rubro: string;
  sucursal: string;
  q: string;
}): Prisma.BalCxMercaderiaWhereInput {
  const parts: Prisma.BalCxMercaderiaWhereInput[] = [];
  if (params.periodo) parts.push({ fecha: rangoFechaPeriodoCx(params.periodo) });
  if (params.sucursal) parts.push({ sucursalId: params.sucursal });
  const prod: Prisma.ProdPropioWhereInput[] = [];
  if (params.rubro) prod.push({ idRubro: params.rubro === CLAVE_SIN_RUBRO ? null : params.rubro });
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
        comprobanteVtaId: true,
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
      comprobanteVtaId: r.comprobanteVtaId,
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
  const rubrosCatalogo = rubrosRows.map((r) => ({
    value: r.id,
    label: r.nombre.toLocaleUpperCase("es-AR"),
  }));
  const rubros = [...rubrosCatalogo, OPCION_SIN_RUBRO];
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
    const filasRubro = filtros.rubro
      ? rubrosCatalogo.filter((r) => r.value === filtros.rubro)
      : rubrosCatalogo;
    const resumen = await resumenCxMercVendPorRubro(where, columnas, filasRubro);
    return { ...base, ...sinDetalle, totalCx: resumen.totales.total, resumen };
  }
  const detalle = await listarDetalleCxMercVend(
    whereCxMercVend({ ...filtros, periodo }),
    filtros.pagina
  );
  return { ...base, ...detalle, resumen: null };
}
