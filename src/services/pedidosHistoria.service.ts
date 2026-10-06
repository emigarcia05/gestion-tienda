import { Prisma, type IvaProveedor, type StockComprobanteTipo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import type {
  ItemPedidoParaPdf,
  SucursalPedidoEnvio,
} from "@/services/pedidosEnvio.service";
import { getItemsYProveedorParaEnviar } from "@/services/pedidosEnvio.service";
import { PAGE_SIZE, skipForPagina, totalPaginasFromTotal } from "@/lib/pagination";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
} from "@/lib/fechaArgentina";
import { fechaFacturaIsoSchema } from "@/lib/validations/pedidosMutaciones";
import {
  NUMERO_COMPROBANTE_COMPRA_REGEX,
  TIPO_COMP_COMPRA,
} from "@/lib/numeroComprobanteCompra";
import { cantidadDesdePrisma } from "@/lib/cantidadUnDecimal";
import {
  reservarCorrelativoCompra,
  type TipoCorrelativoCompra,
} from "@/services/comprobanteCompraNumero.service";

const COD_TIENDA_FALLBACK = "1503";

function dateFromIsoYmd(isoYmd: string): Date {
  return new Date(`${isoYmd}T12:00:00.000Z`);
}

function fechaRecepcionIsoDesdePedido(
  fechaRecepcion: Date | null,
  registradoAt: Date | null
): string | null {
  if (fechaRecepcion) return isoYmdFromPrismaDateOnly(fechaRecepcion);
  if (registradoAt) return dateToIsoYmdArgentina(registradoAt);
  return null;
}

/**
 * Prefijo de log uniforme para todo el módulo de historial de pedidos.
 * Los catch del servicio loggean con `[pedidoHistoria][<fn>]` para que
 * sea grepable contra digests en Vercel Function Logs.
 */
const LOG_TAG = "[pedidoHistoria]";

function logServiceError(scope: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${LOG_TAG}[${scope}]`, msg);
}

/**
 * Retención por `global_proveedores.es_fabrica` (días desde `generado_at`):
 * purga automática en cada escritura del historial.
 */
const DIAS_RETENCION_PEDIDOS_FABRICA = 60;
const DIAS_RETENCION_PEDIDOS_NO_FABRICA = 14;

function fechaHaceDias(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}

/**
 * Elimina cabeceras de `prod_ped_historial` por antigüedad según el proveedor:
 * - `es_fabrica = true`: >= 60 días
 * - `es_fabrica = false`: >= 14 días
 * Los ítems en `prod_ped_historial_merc` se borran en cascada (FK).
 * Sin cron ni triggers: se invoca al inicio de cada mutación del historial en este servicio.
 */
async function purgarPedidosHistoriaExpirados(
  db: Pick<typeof prisma, "pedidoHistoria">
): Promise<void> {
  const limiteFabrica = fechaHaceDias(DIAS_RETENCION_PEDIDOS_FABRICA);
  const limiteNoFabrica = fechaHaceDias(DIAS_RETENCION_PEDIDOS_NO_FABRICA);
  await db.pedidoHistoria.deleteMany({
    where: {
      // Con comprobante de compra el pedido es la fuente de **Compras** / NC: no se purga.
      comprobantesProveedor: { none: {} },
      OR: [
        {
          proveedor: { esFabrica: true },
          generadoAt: { lte: limiteFabrica },
        },
        {
          proveedor: { esFabrica: false },
          generadoAt: { lte: limiteNoFabrica },
        },
      ],
    },
  });
}

/** Límite de texto y de palabras para `q` en listado historial (evita consultas abusivas). */
const HISTORIAL_Q_MAX_LEN = 200;
const HISTORIAL_Q_MAX_TOKENS = 10;

function normalizarTokensBusquedaHistorial(q: string | undefined): string[] {
  const raw = (q ?? "").trim().slice(0, HISTORIAL_Q_MAX_LEN);
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean).slice(0, HISTORIAL_Q_MAX_TOKENS);
}

/** Valor persistido en `prod_ped_historial.estado`; en UI `ABIERTO` se muestra como **EMITIDO**. */
export type PedidoHistoriaEstado = "ABIERTO" | "RECEPCIONADO";

function normalizarEstadoPedidoHistoria(
  estado: string | null | undefined
): PedidoHistoriaEstado {
  return estado === "RECEPCIONADO" ? "RECEPCIONADO" : "ABIERTO";
}

export interface PedidoHistoriaResumen {
  id: string;
  generadoAt: Date;
  proveedorNombre: string;
  sucursalNombre: string;
  estado: PedidoHistoriaEstado;
  registradoAt: Date | null;
}

export interface PedidoHistoriaItemDetalle {
  id: string;
  codTienda: string;
  /** Identidad de la línea del snapshot (`cod_ext` de lista / TINT-… / DUX). */
  codExt: string;
  descripcionTienda: string;
  cantPedida: number;
  /** `null` hasta que en recepción se guarde una cantidad recibida. */
  cantRecibida: number | null;
}

export interface PedidoHistoriaDetalle {
  id: string;
  /**
   * En el servicio es `Date` (Prisma). En wire (`GET /api/pedidos-historia/…/detalle`
   * vía `serializarPedidoHistoriaDetalleParaCliente`) debe viajar como **ISO string**.
   */
  generadoAt: Date | string;
  /**
   * Misma regla que `generadoAt`: en wire, ISO string o `null`.
   */
  registradoAt: Date | string | null;
  /**
   * FECHA FACTURA / recepción persistida (`YYYY-MM-DD`). `null` si nunca se registró.
   */
  fechaRecepcionIso: string | null;
  total: number | null;
  estado: PedidoHistoriaEstado;
  proveedorId: string;
  proveedorNombre: string;
  /** `SIEMPRE` → fiscal; `NUNCA` → no fiscal; `PREGUNTA` → elige el usuario. */
  proveedorIva: IvaProveedor;
  sucursalId: string;
  sucursalNombre: string;
  /** Comprobante de compra creado al recepcionar (`fin_compras_comprobante`). */
  comprobanteCompra: PedidoHistoriaComprobanteCompra | null;
  items: PedidoHistoriaItemDetalle[];
}

export interface PedidoHistoriaComprobanteCompra {
  id: string;
  /** `FACTURA` (fiscal) | `COMPROBANTE_COMPRA` (no fiscal). */
  tipoComp: string;
  numero: string;
  total: number;
  montoAplicado: number;
  saldo: number;
}

export { TIPO_COMP_COMPRA };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convierte el detalle a **solo valores JSON** (strings, números, null).
 * No usa `...d` para no arrastrar getters/propiedades raras del runtime de Prisma.
 * `JSON.parse(JSON.stringify(·))` en la Action culmina la garantía para el flight de Next.js.
 */
export function serializarPedidoHistoriaDetalleParaCliente(
  d: PedidoHistoriaDetalle
): PedidoHistoriaDetalle {
  const generadoAt =
    d.generadoAt instanceof Date ? d.generadoAt.toISOString() : String(d.generadoAt);
  const registradoRaw = d.registradoAt;
  const registradoAt =
    registradoRaw == null
      ? null
      : registradoRaw instanceof Date
        ? registradoRaw.toISOString()
        : String(registradoRaw);

  const total =
    d.total == null
      ? null
      : typeof d.total === "number" && Number.isFinite(d.total)
        ? d.total
        : Number(d.total);

  return {
    id: String(d.id),
    generadoAt,
    registradoAt,
    fechaRecepcionIso: d.fechaRecepcionIso,
    total: total == null || !Number.isFinite(total) ? null : total,
    estado: d.estado,
    proveedorId: String(d.proveedorId),
    proveedorNombre: String(d.proveedorNombre),
    proveedorIva: String(d.proveedorIva) as IvaProveedor,
    sucursalId: String(d.sucursalId),
    sucursalNombre: String(d.sucursalNombre),
    comprobanteCompra: d.comprobanteCompra
      ? {
          id: String(d.comprobanteCompra.id),
          tipoComp: String(d.comprobanteCompra.tipoComp),
          numero: String(d.comprobanteCompra.numero),
          total: Number(d.comprobanteCompra.total),
          montoAplicado: Number(d.comprobanteCompra.montoAplicado),
          saldo: Number(d.comprobanteCompra.saldo),
        }
      : null,
    items: d.items.map((i) => ({
      id: String(i.id),
      codTienda: String(i.codTienda),
      codExt: String(i.codExt ?? i.codTienda),
      descripcionTienda: String(i.descripcionTienda ?? ""),
      cantPedida: Number(i.cantPedida),
      cantRecibida:
        i.cantRecibida == null ? null : Number(i.cantRecibida),
    })),
  };
}

function normalizeCodTienda(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : COD_TIENDA_FALLBACK;
}

function descripcionSnapshotDesdeRow(row: {
  descripcionProveedor: string | null;
  tintometricoDescripcion: string | null;
  descripcionTienda: string | null;
}): string {
  return (
    (row.descripcionProveedor ?? "").trim() ||
    (row.tintometricoDescripcion ?? "").trim() ||
    (row.descripcionTienda ?? "").trim()
  );
}

function claveSnapshotItem(row: { codExt: string; codTienda: string | null }): string {
  const ext = row.codExt.trim();
  if (ext) return ext;
  return normalizeCodTienda(row.codTienda);
}

export async function crearPedidoHistoriaSnapshot(params: {
  proveedorId: string;
  sucursalCodigo: SucursalPedidoEnvio;
  tipos: string[];
  /** Reposición opt-in: forzar filas al proveedor del pedido aunque otro gane por precio. */
  forzarIdsReposicionAlProveedor?: string[];
}): Promise<ServiceResult<{ id: string }>> {
  const { proveedorId, sucursalCodigo, tipos, forzarIdsReposicionAlProveedor } = params;

  if (!proveedorId.trim()) {
    return { success: false, error: "Proveedor inválido." };
  }
  if (!sucursalCodigo.trim()) {
    return { success: false, error: "Sucursal inválida." };
  }
  if (!Array.isArray(tipos) || tipos.length === 0) {
    return { success: false, error: "Tipos inválidos." };
  }

  try {
    await purgarPedidosHistoriaExpirados(prisma);

    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: sucursalCodigo },
      select: { id: true },
    });
    if (!sucursal) return { success: false, error: "Sucursal no encontrada." };

    const { rows: snapshotRows } = await getItemsYProveedorParaEnviar(
      proveedorId.trim(),
      sucursalCodigo,
      tipos,
      undefined,
      forzarIdsReposicionAlProveedor?.length
        ? {
            forzarIdsReposicionAlProveedor: new Set(forzarIdsReposicionAlProveedor),
          }
        : undefined
    );

    const itemsPorCodExt = new Map<
      string,
      { codTienda: string; descripcion: string; cantPedida: number }
    >();
    for (const row of snapshotRows) {
      const clave = claveSnapshotItem(row);
      const cant = Math.max(0, Number(row.cantPedir) || 0);
      const prev = itemsPorCodExt.get(clave);
      if (prev) {
        prev.cantPedida += cant;
        continue;
      }
      itemsPorCodExt.set(clave, {
        codTienda: normalizeCodTienda(row.codTienda),
        descripcion: descripcionSnapshotDesdeRow(row),
        cantPedida: cant,
      });
    }

    return await prisma.$transaction(async (tx) => {
      const pedidoHistoria = await tx.pedidoHistoria.create({
        data: {
          proveedorId: proveedorId.trim(),
          sucursalId: sucursal.id,
          estado: "ABIERTO",
        },
        select: { id: true },
      });

      const itemsToCreate = [...itemsPorCodExt.entries()].map(([codExt, it]) => ({
        codExt,
        codTienda: it.codTienda,
        descripcion: it.descripcion,
        cantPedida: it.cantPedida,
      }));

      if (itemsToCreate.length > 0) {
        await tx.pedidoHistoriaItem.createMany({
          data: itemsToCreate.map((it) => ({
            pedidoHistoriaId: pedidoHistoria.id,
            codExt: it.codExt,
            codTienda: it.codTienda,
            descripcion: it.descripcion,
            cantPedida: it.cantPedida,
            cantRecibida: null,
          })),
        });
      }

      return { success: true, data: { id: pedidoHistoria.id } };
    });
  } catch (e) {
    logServiceError("crearPedidoHistoriaSnapshot", e);
    const msg = e instanceof Error ? e.message : "Error al crear el snapshot del pedido.";
    return { success: false, error: msg };
  }
}

export async function getPedidoHistoriaDetalle(params: {
  pedidoHistoriaId: string;
}): Promise<ServiceResult<PedidoHistoriaDetalle>> {
  const { pedidoHistoriaId } = params;
  if (!pedidoHistoriaId.trim()) return { success: false, error: "ID inválido." };

  try {
    const pedido = await prisma.pedidoHistoria.findUnique({
      where: { id: pedidoHistoriaId.trim() },
      select: {
        id: true,
        generadoAt: true,
        estado: true,
        registradoAt: true,
        fechaRecepcion: true,
        total: true,
        proveedorId: true,
        sucursalId: true,
        proveedor: { select: { nombre: true, iva: true } },
        sucursal: { select: { nombre: true } },
        comprobantesProveedor: {
          where: { tipoComp: { not: TIPO_COMP_COMPRA.NOTA_CREDITO } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            id: true,
            tipoComp: true,
            comprobante: true,
            total: true,
            montoAplicado: true,
          },
        },
        items: {
          select: {
            id: true,
            codTienda: true,
            codExt: true,
            descripcion: true,
            cantPedida: true,
            cantRecibida: true,
          },
          orderBy: [{ descripcion: "asc" }, { codExt: "asc" }],
        },
      },
    });

    if (!pedido) return { success: false, error: "Pedido no encontrado." };

    // Defensa de shape: las FK son NOT NULL en BD, pero un cliente Prisma
    // generado contra un schema desactualizado o una corrupción podría
    // devolver `proveedor`/`sucursal` undefined. Antes esto producía
    // `TypeError: Cannot read properties of undefined (reading 'nombre')`
    // que era atrapado por el try/catch externo, pero el mensaje resultante
    // era confuso y opaco.
    if (!pedido.proveedor || !pedido.sucursal) {
      logServiceError(
        "getPedidoHistoriaDetalle",
        `relaciones incompletas para pedido ${pedido.id}: proveedor=${!!pedido.proveedor} sucursal=${!!pedido.sucursal}`
      );
      return {
        success: false,
        error: "El pedido tiene datos incompletos (proveedor/sucursal).",
      };
    }

    const codTiendaSet = Array.from(new Set(pedido.items.map((i) => i.codTienda)));
    const descRows = await prisma.prodTienda.findMany({
      where: { codTienda: { in: codTiendaSet } },
      select: { codTienda: true, descripcionTienda: true },
      orderBy: [{ codTienda: "asc" }],
    });

    const descripcionPorCodTienda = new Map<string, string>();
    for (const r of descRows) {
      const key = r.codTienda;
      if (descripcionPorCodTienda.has(key)) continue;
      const desc = (r.descripcionTienda ?? "").trim();
      if (!desc) continue;
      descripcionPorCodTienda.set(key, desc);
    }

    return {
      success: true,
      data: {
        id: pedido.id,
        generadoAt: pedido.generadoAt,
        registradoAt: pedido.registradoAt,
        fechaRecepcionIso: fechaRecepcionIsoDesdePedido(
          pedido.fechaRecepcion,
          pedido.registradoAt
        ),
        total: pedido.total == null ? null : Number(pedido.total),
        estado: normalizarEstadoPedidoHistoria(pedido.estado),
        proveedorId: pedido.proveedorId,
        proveedorNombre: pedido.proveedor.nombre,
        proveedorIva: pedido.proveedor.iva,
        sucursalId: pedido.sucursalId,
        sucursalNombre: pedido.sucursal.nombre,
        comprobanteCompra: (() => {
          const c = pedido.comprobantesProveedor[0];
          if (!c) return null;
          const total = Number(c.total);
          const montoAplicado = Number(c.montoAplicado);
          return {
            id: c.id,
            tipoComp: c.tipoComp,
            numero: c.comprobante,
            total,
            montoAplicado,
            saldo: round2(total - montoAplicado),
          };
        })(),
        items: pedido.items.map((i) => ({
          id: i.id,
          codTienda: i.codTienda,
          codExt: i.codExt,
          descripcionTienda:
            i.descripcion.trim() || descripcionPorCodTienda.get(i.codTienda) || "",
          cantPedida: i.cantPedida,
          cantRecibida: i.cantRecibida,
        })),
      },
    };
  } catch (e) {
    logServiceError("getPedidoHistoriaDetalle", e);
    const msg = e instanceof Error ? e.message : "Error al leer el detalle del pedido.";
    return { success: false, error: msg };
  }
}

export async function listarPedidosHistoria(params: {
  pagina?: number;
  estado?: PedidoHistoriaEstado | "ALL";
  proveedorId?: string;
  sucursalCodigo?: SucursalPedidoEnvio;
  /** Palabras que deben aparecer en `descripcion` del snapshot o en `descripcion_tienda` de `prod_tienda`. */
  q?: string;
}): Promise<
  ServiceResult<{
    items: PedidoHistoriaResumen[];
    total: number;
    totalPaginas: number;
    paginaActual: number;
  }>
> {
  const paginaActual = Math.max(1, Math.floor(Number(params.pagina) || 1));
  const pageSize = PAGE_SIZE;

  try {
    let sucursalId: string | undefined;
    if (params.sucursalCodigo) {
      const suc = await prisma.sucursal.findUnique({
        where: { codigo: params.sucursalCodigo },
        select: { id: true },
      });
      if (!suc) {
        return { success: true, data: { items: [], total: 0, totalPaginas: 1, paginaActual } };
      }
      sucursalId = suc.id;
    }

    const where: Prisma.PedidoHistoriaWhereInput = {};
    if (params.estado && params.estado !== "ALL") {
      where.estado = params.estado;
    }
    if (params.proveedorId?.trim()) where.proveedorId = params.proveedorId.trim();
    if (sucursalId) where.sucursalId = sucursalId;

    const tokens = normalizarTokensBusquedaHistorial(params.q);
    if (tokens.length > 0) {
      const grouped = await prisma.prodTienda.groupBy({
        by: ["codTienda"],
        where: {
          AND: tokens.map((t) => ({
            descripcionTienda: { contains: t, mode: "insensitive" },
          })),
        },
      });
      const codTiendas = grouped.map((g) => g.codTienda);
      where.items = {
        some: {
          OR: [
            {
              AND: tokens.map((t) => ({
                descripcion: { contains: t, mode: "insensitive" },
              })),
            },
            ...(codTiendas.length > 0 ? [{ codTienda: { in: codTiendas } }] : []),
          ],
        },
      };
    }

    const [total, rows] = await Promise.all([
      prisma.pedidoHistoria.count({ where }),
      prisma.pedidoHistoria.findMany({
        where,
        orderBy: { generadoAt: "desc" },
        skip: skipForPagina(paginaActual, pageSize),
        take: pageSize,
        select: {
          id: true,
          generadoAt: true,
          estado: true,
          registradoAt: true,
          proveedor: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          generadoAt: r.generadoAt,
          // Defensa de shape: normalmente las FK garantizan ambos, pero
          // ante una corrupción de datos preferimos mostrar "—" antes que
          // tirar TypeError y romper el render del listado.
          proveedorNombre: r.proveedor?.nombre ?? "—",
          sucursalNombre: r.sucursal?.nombre ?? "—",
          estado: normalizarEstadoPedidoHistoria(r.estado),
          registradoAt: r.registradoAt,
        })),
        total,
        totalPaginas: totalPaginasFromTotal(total, pageSize),
        paginaActual,
      },
    };
  } catch (e) {
    logServiceError("listarPedidosHistoria", e);
    const msg = e instanceof Error ? e.message : "Error al listar el historial de pedidos.";
    return { success: false, error: msg };
  }
}

type LineaStockRecepcion = { codItem: string; cantidad: number };

const MSG_RECEPCION_CAMBIO_CONCURRENTE =
  "El pedido cambió mientras se registraba el stock. Volvé a abrirlo y confirmá de nuevo.";

const MSG_USUARIO_INVALIDO = "Usuario de sesión inválido. Volvé a iniciar sesión.";

/** Σ `cant_recibida` > 0 por `cod_tienda` (los negativos no mueven stock). */
function recibidoPorCodTienda(
  items: Array<{ codTienda: string; cantRecibida: number | null }>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    const cant = it.cantRecibida ?? 0;
    if (cant <= 0) continue;
    const cod = normalizeCodTienda(it.codTienda);
    out.set(cod, (out.get(cod) ?? 0) + cant);
  }
  return out;
}

/** Saldo neto por `cod_item` de los comprobantes de stock del pedido de los tipos dados. */
async function netoStockPedidoPorItem(
  pedidoHistoriaId: string,
  tipos: StockComprobanteTipo[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const rows = await prisma.stockMovimiento.groupBy({
    by: ["codItem", "tipoMovimiento"],
    where: { comprobante: { pedidoHistoriaId, tipo: { in: tipos } } },
    _sum: { cantidad: true },
  });
  for (const r of rows) {
    const cant = cantidadDesdePrisma(r._sum.cantidad);
    const prev = out.get(r.codItem) ?? 0;
    out.set(r.codItem, r.tipoMovimiento === "INGRESO" ? prev + cant : prev - cant);
  }
  return out;
}

/**
 * Diferencia por `cod_tienda` entre lo recibido y lo ya ingresado por la recepción
 * (`COMPRA` + `AJUSTE_STOCK`; las NC de compra van aparte y no se compensan acá).
 */
async function calcularDiferenciaStockRecepcion(
  pedidoHistoriaId: string,
  items: Array<{ codTienda: string; cantRecibida: number | null }>
): Promise<{ ingresos: LineaStockRecepcion[]; egresos: LineaStockRecepcion[] }> {
  const objetivo = recibidoPorCodTienda(items);
  const registrado = await netoStockPedidoPorItem(pedidoHistoriaId, ["COMPRA", "AJUSTE_STOCK"]);

  const ingresos: LineaStockRecepcion[] = [];
  const egresos: LineaStockRecepcion[] = [];
  for (const codItem of new Set([...objetivo.keys(), ...registrado.keys()])) {
    const delta = (objetivo.get(codItem) ?? 0) - (registrado.get(codItem) ?? 0);
    if (delta > 0) ingresos.push({ codItem, cantidad: delta });
    else if (delta < 0) egresos.push({ codItem, cantidad: -delta });
  }
  return { ingresos, egresos };
}

/**
 * Lleva el stock de la sucursal del pedido a lo declarado en la recepción:
 * faltante → comprobante `COMPRA` (INGRESO); sobrante por corrección → `AJUSTE_STOCK` (EGRESO).
 * Un solo `update` anidado guardado por `updated_at` (sin `$transaction` interactiva):
 * si otro request tocó el pedido, P2025 y no se escribe nada.
 */
async function sincronizarStockRecepcionPedido(params: {
  pedidoHistoriaId: string;
  personalId: number;
  data?: Pick<
    Prisma.PedidoHistoriaUpdateInput,
    "estado" | "registradoAt" | "fechaRecepcion" | "total"
  >;
  comprobanteCompra?: Prisma.ComprobanteProveedorUncheckedCreateWithoutPedidoHistoriaInput;
  /** Corrección: comprobante anterior (sin monto aplicado) que se borra antes de crear el nuevo. */
  reemplazarComprobanteId?: string;
}): Promise<ServiceResult<void>> {
  const { pedidoHistoriaId: id, personalId } = params;
  const pedido = await prisma.pedidoHistoria.findUnique({
    where: { id },
    select: {
      updatedAt: true,
      sucursalId: true,
      proveedorId: true,
      items: { select: { codTienda: true, cantRecibida: true } },
    },
  });
  if (!pedido) return { success: false, error: "Pedido no encontrado." };

  const { ingresos, egresos } = await calcularDiferenciaStockRecepcion(id, pedido.items);
  if (ingresos.length === 0 && egresos.length === 0 && !params.data) {
    return { success: true, data: undefined };
  }

  const faltantes = await codTiendaInexistentes(ingresos.map((l) => l.codItem));
  if (faltantes.length > 0) {
    return {
      success: false,
      error: `Productos inexistentes en tienda: ${faltantes.join(", ")}.`,
    };
  }

  const comprobante = (
    tipo: "COMPRA" | "AJUSTE_STOCK",
    lineas: LineaStockRecepcion[]
  ): Prisma.StockComprobanteUncheckedCreateWithoutPedidoHistoriaInput => ({
    tipo,
    sucursalId: pedido.sucursalId,
    proveedorId: pedido.proveedorId,
    personalId,
    movimientos: {
      createMany: {
        data: lineas.map((l) => ({
          tipoMovimiento: tipo === "COMPRA" ? "INGRESO" : "EGRESO",
          categoriaMovimiento: tipo,
          codItem: l.codItem,
          sucursalId: pedido.sucursalId,
          cantidad: l.cantidad,
          usuarioId: personalId,
        })),
      },
    },
  });

  const comprobantes: Prisma.StockComprobanteUncheckedCreateWithoutPedidoHistoriaInput[] = [];
  if (ingresos.length > 0) comprobantes.push(comprobante("COMPRA", ingresos));
  if (egresos.length > 0) comprobantes.push(comprobante("AJUSTE_STOCK", egresos));

  const actualizarPedido = prisma.pedidoHistoria.update({
    where: { id, updatedAt: pedido.updatedAt },
    data: {
      ...params.data,
      updatedAt: new Date(),
      ...(comprobantes.length > 0
        ? { stockComprobantes: { create: comprobantes } }
        : {}),
      ...(params.comprobanteCompra
        ? { comprobantesProveedor: { create: params.comprobanteCompra } }
        : {}),
    },
  });

  try {
    if (params.reemplazarComprobanteId) {
      // Batch atómico y ordenado: el borrado va antes para liberar el unique natural si el N° no cambia.
      await prisma.$transaction([
        prisma.comprobanteProveedor.delete({
          where: { id: params.reemplazarComprobanteId, montoAplicado: 0 },
        }),
        actualizarPedido,
      ]);
    } else {
      await actualizarPedido;
    }
    return { success: true, data: undefined };
  } catch (e) {
    const err = errorEscrituraPedido(e);
    if (err) return { success: false, error: err };
    throw e;
  }
}

async function codTiendaInexistentes(codigos: string[]): Promise<string[]> {
  if (codigos.length === 0) return [];
  const existentes = await prisma.prodTienda.findMany({
    where: { codTienda: { in: codigos } },
    select: { codTienda: true },
  });
  const ok = new Set(existentes.map((r) => r.codTienda));
  return codigos.filter((c) => !ok.has(c));
}

function errorEscrituraPedido(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (e.code === "P2025") return MSG_RECEPCION_CAMBIO_CONCURRENTE;
  if (e.code === "P2003") return MSG_USUARIO_INVALIDO;
  if (e.code === "P2002") {
    return "Ya existe un comprobante con ese número para el proveedor y la fecha.";
  }
  return null;
}

/** `SIEMPRE` exige fiscal; `NUNCA`, no fiscal; `PREGUNTA` acepta lo que elija el usuario. */
function validarFiscalSegunIva(iva: IvaProveedor, fiscal: boolean): string | null {
  if (iva === "SIEMPRE" && !fiscal) return "Este proveedor siempre emite comprobante fiscal.";
  if (iva === "NUNCA" && fiscal) return "Este proveedor no emite comprobante fiscal.";
  return null;
}

/** Fiscal: N° cargado por el usuario. No fiscal: correlativo de `prod_ped_ult_comp`. */
async function resolverNumeroComprobante(
  fiscal: boolean,
  numeroManual: string | undefined,
  correlativo: TipoCorrelativoCompra
): Promise<ServiceResult<string>> {
  if (fiscal) {
    const n = (numeroManual ?? "").trim();
    if (!n) return { success: false, error: "Ingresá el N° del comprobante fiscal." };
    return { success: true, data: n };
  }
  return { success: true, data: await reservarCorrelativoCompra(correlativo) };
}

export async function guardarRecepcionPedidoHistoria(params: {
  pedidoHistoriaId: string;
  personalId: number;
  items: Array<{
    id?: string;
    codTienda: string;
    codExt?: string;
    descripcion?: string;
    cantPedida: number;
    cantRecibida: number | null;
  }>;
  fechaRecepcionIso?: string;
}): Promise<ServiceResult<void>> {
  const id = params.pedidoHistoriaId.trim();
  if (!id) return { success: false, error: "ID inválido." };

  const itemsNormalizados = params.items.map((item) => {
    const codTienda = normalizeCodTienda(item.codTienda);
    const codExt = (item.codExt ?? "").trim() || codTienda;
    return {
      id: item.id?.trim() || undefined,
      codTienda,
      codExt,
      descripcion: (item.descripcion ?? "").trim(),
      cantPedida: Math.max(0, Math.floor(Number(item.cantPedida) || 0)),
      cantRecibida:
        item.cantRecibida == null
          ? null
          : Math.trunc(Number(item.cantRecibida)),
    };
  });

  const keys = itemsNormalizados.map((item) => `${item.codExt}::${item.id ?? "new"}`);
  if (new Set(keys).size !== keys.length) {
    return { success: false, error: "Hay ítems duplicados en la recepción." };
  }

  try {
    await purgarPedidosHistoriaExpirados(prisma);

    const estadoPedido = await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoHistoria.findUnique({
        where: { id },
        select: { id: true, estado: true },
      });
      if (!pedido) throw new Error("Pedido no encontrado.");

      const actuales = await tx.pedidoHistoriaItem.findMany({
        where: { pedidoHistoriaId: id },
        select: { id: true },
      });
      const idsActuales = new Set(actuales.map((row) => row.id));
      const idsPayload = new Set(
        itemsNormalizados.map((item) => item.id).filter((v): v is string => Boolean(v))
      );

      for (const item of itemsNormalizados) {
        if (item.id && !idsActuales.has(item.id)) {
          throw new Error("Hay ítems inválidos en la recepción.");
        }
      }

      const idsAEliminar = [...idsActuales].filter((itemId) => !idsPayload.has(itemId));
      if (idsAEliminar.length > 0) {
        await tx.pedidoHistoriaItem.deleteMany({
          where: { pedidoHistoriaId: id, id: { in: idsAEliminar } },
        });
      }

      for (const item of itemsNormalizados) {
        if (item.id) {
          await tx.pedidoHistoriaItem.update({
            where: { id: item.id },
            data: {
              codTienda: item.codTienda,
              cantPedida: item.cantPedida,
              cantRecibida: item.cantRecibida,
            },
          });
          continue;
        }

        await tx.pedidoHistoriaItem.create({
          data: {
            pedidoHistoriaId: id,
            codTienda: item.codTienda,
            codExt: item.codExt,
            descripcion: item.descripcion,
            cantPedida: item.cantPedida,
            cantRecibida: item.cantRecibida,
          },
        });
      }

      const fechaParsed = fechaFacturaIsoSchema.safeParse(params.fechaRecepcionIso);
      if (fechaParsed.success) {
        await tx.pedidoHistoria.update({
          where: { id },
          data: { fechaRecepcion: dateFromIsoYmd(fechaParsed.data) },
        });
      }
      return normalizarEstadoPedidoHistoria(pedido.estado);
    });

    if (estadoPedido === "RECEPCIONADO") {
      const stock = await sincronizarStockRecepcionPedido({
        pedidoHistoriaId: id,
        personalId: params.personalId,
      });
      if (!stock.success) {
        return {
          success: false,
          error: `La corrección se guardó, pero el stock no se actualizó: ${stock.error} Reintentá Guardar Corrección.`,
        };
      }
    }

    return { success: true, data: undefined };
  } catch (e) {
    logServiceError("guardarRecepcionPedidoHistoria", e);
    const msg =
      e instanceof Error ? e.message : "Error al guardar la recepción del pedido.";
    return { success: false, error: msg };
  }
}

/**
 * Marca RECEPCIONADO, ingresa al stock lo recibido y crea el comprobante de compra
 * (`fin_compras_comprobante`, saldo = TOTAL PEDIDO) en el mismo `update`.
 * En la corrección de un pedido ya RECEPCIONADO, borra el comprobante anterior y crea uno nuevo
 * (rechazado si ya tiene pagos o NC aplicadas).
 */
export async function marcarPedidoHistoriaRegistrado(params: {
  pedidoHistoriaId: string;
  totalPedido: number;
  fechaRecepcionIso: string;
  personalId: number;
  fiscal: boolean;
  /** Cargado a mano por el usuario: `0000-00000000`. */
  numeroComprobante: string;
}): Promise<ServiceResult<void>> {
  const { pedidoHistoriaId, totalPedido, fechaRecepcionIso, personalId } = params;
  const id = pedidoHistoriaId.trim();
  if (!id) return { success: false, error: "ID inválido." };
  if (!Number.isFinite(totalPedido) || totalPedido === 0) {
    return { success: false, error: "Total inválido." };
  }
  const fechaParsed = fechaFacturaIsoSchema.safeParse(fechaRecepcionIso);
  if (!fechaParsed.success) {
    return { success: false, error: "Fecha de recepción inválida." };
  }

  try {
    await purgarPedidosHistoriaExpirados(prisma);

    const pedido = await prisma.pedidoHistoria.findUnique({
      where: { id },
      select: {
        estado: true,
        proveedor: { select: { iva: true, idProveedorDux: true } },
        sucursal: { select: { idDux: true } },
        comprobantesProveedor: {
          where: { tipoComp: { not: TIPO_COMP_COMPRA.NOTA_CREDITO } },
          select: { id: true, montoAplicado: true },
          take: 1,
        },
      },
    });
    if (!pedido) return { success: false, error: "Pedido no encontrado." };

    const anterior = pedido.comprobantesProveedor[0];
    if (anterior && Number(anterior.montoAplicado) > 0) {
      return {
        success: false,
        error:
          "El comprobante de compra ya tiene pagos o notas de crédito aplicadas: no se puede reemplazar.",
      };
    }

    const errIva = validarFiscalSegunIva(pedido.proveedor.iva, params.fiscal);
    if (errIva) return { success: false, error: errIva };
    const idProveedorDux = pedido.proveedor.idProveedorDux?.trim();
    const idSucursalDux = pedido.sucursal.idDux?.trim();
    if (!idProveedorDux) {
      return { success: false, error: "El proveedor no tiene ID DUX: no se puede crear el comprobante." };
    }
    if (!idSucursalDux) {
      return { success: false, error: "La sucursal no tiene ID DUX: no se puede crear el comprobante." };
    }
    const numero = (params.numeroComprobante ?? "").trim();
    if (!NUMERO_COMPROBANTE_COMPRA_REGEX.test(numero)) {
      return { success: false, error: "N° de comprobante inválido (formato 0000-00000000)." };
    }

    return await sincronizarStockRecepcionPedido({
      pedidoHistoriaId: id,
      personalId,
      data: {
        estado: "RECEPCIONADO",
        ...(pedido.estado === "RECEPCIONADO" ? {} : { registradoAt: new Date() }),
        fechaRecepcion: dateFromIsoYmd(fechaParsed.data),
        total: new Prisma.Decimal(totalPedido.toFixed(2)),
      },
      comprobanteCompra: {
        idSucursalEmpresa: idSucursalDux,
        tipoComp: params.fiscal ? TIPO_COMP_COMPRA.FISCAL : TIPO_COMP_COMPRA.NO_FISCAL,
        comprobante: numero,
        fechaComp: dateFromIsoYmd(fechaParsed.data),
        idProveedor: idProveedorDux,
        total: new Prisma.Decimal(totalPedido.toFixed(2)),
        montoAplicado: new Prisma.Decimal(0),
      },
      reemplazarComprobanteId: anterior?.id,
    });
  } catch (e) {
    logServiceError("marcarPedidoHistoriaRegistrado", e);
    const msg = e instanceof Error ? e.message : "Error al marcar el pedido como registrado.";
    return { success: false, error: msg };
  }
}

/**
 * Nota de crédito de compra sobre un pedido RECEPCIONADO, en un solo `update` del pedido:
 * - `fin_compras_comprobante` `NOTA_CREDITO` (`monto_aplicado` = total, no suma deuda)
 *   y `monto_aplicado` += total en el comprobante de la recepción (saldo $100 → $40);
 * - comprobante de stock `NOTA_CREDITO_COMPRA` con EGRESO de lo devuelto en la sucursal del pedido.
 * Lo devuelto por `cod_tienda` no puede superar lo recibido menos NC anteriores.
 */
export async function registrarNotaCreditoCompraPedido(params: {
  pedidoHistoriaId: string;
  personalId: number;
  fiscal: boolean;
  numeroComprobante?: string;
  fechaIso: string;
  total: number;
  items: Array<{ codTienda: string; cantidad: number }>;
}): Promise<ServiceResult<{ numero: string; saldo: number }>> {
  const id = params.pedidoHistoriaId.trim();
  if (!id) return { success: false, error: "ID inválido." };
  const total = round2(params.total);
  if (!Number.isFinite(total) || total <= 0) {
    return { success: false, error: "El total de la nota de crédito debe ser mayor a 0." };
  }
  const fechaParsed = fechaFacturaIsoSchema.safeParse(params.fechaIso);
  if (!fechaParsed.success) return { success: false, error: "Fecha inválida." };

  try {
    const pedido = await prisma.pedidoHistoria.findUnique({
      where: { id },
      select: {
        estado: true,
        updatedAt: true,
        sucursalId: true,
        proveedorId: true,
        proveedor: { select: { iva: true } },
        items: { select: { codTienda: true, cantRecibida: true } },
        comprobantesProveedor: {
          where: { tipoComp: { not: TIPO_COMP_COMPRA.NOTA_CREDITO } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            id: true,
            idSucursalEmpresa: true,
            idProveedor: true,
            total: true,
            montoAplicado: true,
          },
        },
      },
    });
    if (!pedido) return { success: false, error: "Pedido no encontrado." };
    if (normalizarEstadoPedidoHistoria(pedido.estado) !== "RECEPCIONADO") {
      return { success: false, error: "Solo se puede hacer nota de crédito de un pedido recepcionado." };
    }
    const original = pedido.comprobantesProveedor[0];
    if (!original) {
      return {
        success: false,
        error: "El pedido no tiene comprobante de compra (se recepcionó antes de esta función).",
      };
    }
    const errIva = validarFiscalSegunIva(pedido.proveedor.iva, params.fiscal);
    if (errIva) return { success: false, error: errIva };

    const saldo = round2(Number(original.total) - Number(original.montoAplicado));
    if (total > saldo) {
      return {
        success: false,
        error: `El total supera el saldo a pagar del comprobante ($${saldo.toLocaleString("es-AR")}).`,
      };
    }

    const devolver = new Map<string, number>();
    for (const it of params.items) {
      const cant = Math.trunc(it.cantidad);
      if (cant <= 0) continue;
      const cod = normalizeCodTienda(it.codTienda);
      devolver.set(cod, (devolver.get(cod) ?? 0) + cant);
    }
    if (devolver.size > 0) {
      const recibido = recibidoPorCodTienda(pedido.items);
      const devueltoPrevio = await netoStockPedidoPorItem(id, ["NOTA_CREDITO_COMPRA"]);
      for (const [cod, cant] of devolver) {
        const disponible = (recibido.get(cod) ?? 0) + (devueltoPrevio.get(cod) ?? 0);
        if (cant > disponible) {
          return {
            success: false,
            error: `La cantidad a devolver de ${cod} supera lo disponible (recibido menos NC anteriores: ${disponible}).`,
          };
        }
      }
    }

    const numero = await resolverNumeroComprobante(
      params.fiscal,
      params.numeroComprobante,
      "NOTA_CREDITO"
    );
    if (!numero.success) return numero;

    const totalDec = new Prisma.Decimal(total.toFixed(2));
    await prisma.pedidoHistoria.update({
      where: { id, updatedAt: pedido.updatedAt },
      data: {
        updatedAt: new Date(),
        comprobantesProveedor: {
          create: {
            idSucursalEmpresa: original.idSucursalEmpresa,
            tipoComp: TIPO_COMP_COMPRA.NOTA_CREDITO,
            comprobante: numero.data,
            fechaComp: dateFromIsoYmd(fechaParsed.data),
            idProveedor: original.idProveedor,
            total: totalDec,
            montoAplicado: totalDec,
            comprobanteAsocId: original.id,
          },
          update: {
            where: { id: original.id },
            data: { montoAplicado: { increment: totalDec } },
          },
        },
        ...(devolver.size > 0
          ? {
              stockComprobantes: {
                create: {
                  tipo: "NOTA_CREDITO_COMPRA",
                  sucursalId: pedido.sucursalId,
                  proveedorId: pedido.proveedorId,
                  personalId: params.personalId,
                  movimientos: {
                    createMany: {
                      data: [...devolver].map(([codItem, cantidad]) => ({
                        tipoMovimiento: "EGRESO" as const,
                        categoriaMovimiento: "NOTA_CREDITO_COMPRA" as const,
                        codItem,
                        sucursalId: pedido.sucursalId,
                        cantidad,
                        usuarioId: params.personalId,
                      })),
                    },
                  },
                },
              },
            }
          : {}),
      },
    });

    return { success: true, data: { numero: numero.data, saldo: round2(saldo - total) } };
  } catch (e) {
    const err = errorEscrituraPedido(e);
    if (err) return { success: false, error: err };
    logServiceError("registrarNotaCreditoCompraPedido", e);
    const msg = e instanceof Error ? e.message : "Error al registrar la nota de crédito.";
    return { success: false, error: msg };
  }
}

/**
 * Arma los datos para regenerar la nota de pedido PDF desde el snapshot (`prod_ped_historial` + ítems)
 * y el catálogo vigente (`prod_precios_provee` por `cod_ext`).
 */
export async function getPedidoHistoriaPdfPayload(params: {
  pedidoHistoriaId: string;
}): Promise<
  ServiceResult<{
    items: ItemPedidoParaPdf[];
    proveedorNombre: string;
    proveedorPrefijo: string;
    sucursalCodigo: string;
    generadoAt: Date;
  }>
> {
  const id = params.pedidoHistoriaId.trim();
  if (!id) return { success: false, error: "ID inválido." };

  try {
    const pedido = await prisma.pedidoHistoria.findUnique({
      where: { id },
      select: {
        generadoAt: true,
        proveedorId: true,
        proveedor: { select: { nombre: true, prefijo: true } },
        sucursal: { select: { codigo: true } },
        items: { select: { codTienda: true, codExt: true, descripcion: true, cantPedida: true } },
      },
    });
    if (!pedido) return { success: false, error: "Pedido no encontrado." };
    if (pedido.items.length === 0) {
      return { success: false, error: "El pedido no tiene ítems para el PDF." };
    }

    const extSet = Array.from(
      new Set(pedido.items.map((it) => it.codExt.trim()).filter(Boolean))
    );

    const provRows =
      extSet.length > 0
        ? await prisma.listaPrecioProveedor.findMany({
            where: {
              idProveedor: pedido.proveedorId,
              codExt: { in: extSet },
            },
            select: {
              codExt: true,
              codProdProveedor: true,
              descripcionProveedor: true,
              prodTienda: { select: { codTienda: true, descripcionTienda: true } },
            },
          })
        : [];

    const byCodExt = new Map<string, (typeof provRows)[number]>();
    for (const row of provRows) {
      const k = row.codExt.trim();
      if (k && !byCodExt.has(k)) byCodExt.set(k, row);
    }

    const items: ItemPedidoParaPdf[] = pedido.items
      .map((it) => {
        const key = it.codExt.trim() || normalizeCodTienda(it.codTienda);
        const match = byCodExt.get(it.codExt.trim());
        const descProv = (match?.descripcionProveedor ?? "").trim();
        const descTienda = (match?.prodTienda?.descripcionTienda ?? "").trim();
        const descSnapshot = it.descripcion.trim();
        return {
          codExt: (match?.codExt ?? it.codExt).trim(),
          codProveedor: (match?.codProdProveedor ?? "").trim(),
          descripcion: descSnapshot || descProv || descTienda || `Producto ${key}`,
          cantPedir: Math.max(0, Number(it.cantPedida) || 0),
        };
      })
      .filter((row) => row.cantPedir > 0);

    if (items.length === 0) {
      return {
        success: false,
        error: "No hay líneas con cantidad pedida para el PDF.",
      };
    }

    if (!pedido.proveedor || !pedido.sucursal) {
      logServiceError(
        "getPedidoHistoriaPdfPayload",
        `relaciones incompletas para pedido ${id}: proveedor=${!!pedido.proveedor} sucursal=${!!pedido.sucursal}`
      );
      return {
        success: false,
        error: "El pedido tiene datos incompletos (proveedor/sucursal).",
      };
    }

    return {
      success: true,
      data: {
        items,
        proveedorNombre: pedido.proveedor.nombre,
        proveedorPrefijo: (pedido.proveedor.prefijo ?? "").trim(),
        sucursalCodigo: pedido.sucursal.codigo,
        generadoAt: pedido.generadoAt,
      },
    };
  } catch (e) {
    logServiceError("getPedidoHistoriaPdfPayload", e);
    const msg = e instanceof Error ? e.message : "Error al armar el PDF del pedido.";
    return { success: false, error: msg };
  }
}

export async function eliminarPedidoHistoria(params: {
  pedidoHistoriaId: string;
}): Promise<ServiceResult<void>> {
  const id = params.pedidoHistoriaId.trim();
  if (!id) return { success: false, error: "ID inválido." };

  try {
    await purgarPedidosHistoriaExpirados(prisma);

    const borrado = await prisma.pedidoHistoria.deleteMany({
      where: { id, comprobantesProveedor: { none: {} } },
    });
    if (borrado.count === 0) {
      const existe = await prisma.pedidoHistoria.findUnique({ where: { id }, select: { id: true } });
      return {
        success: false,
        error: existe
          ? "El pedido ya tiene comprobante de compra (ver Compras); no se puede borrar."
          : "Pedido no encontrado.",
      };
    }
    return { success: true, data: undefined };
  } catch (e) {
    logServiceError("eliminarPedidoHistoria", e);
    const msg = e instanceof Error ? e.message : "Error al borrar el pedido.";
    return { success: false, error: msg };
  }
}

