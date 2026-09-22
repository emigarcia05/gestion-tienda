import { Prisma, type IvaProveedor } from "@prisma/client";
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
import { fechaFacturaIsoSchema } from "@/services/exportRecepcionPedidoExcel.service";

const COD_TIENDA_FALLBACK = "1503";
const LISTA_NC_MAX = 200;

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

export type PedidoHistoriaEstado = "PENDIENTE" | "RECEPCIONADO";

function normalizarEstadoPedidoHistoria(
  estado: string | null | undefined
): PedidoHistoriaEstado {
  return estado === "RECEPCIONADO" ? "RECEPCIONADO" : "PENDIENTE";
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
  /**
   * Política de IVA del proveedor (`global_proveedores.iva`). El frontend la
   * usa para decidir si abre el modal "¿La compra genera comprobante fiscal?"
   * antes de exportar el Excel de recepción (regla `iva → tipoComprobante`).
   */
  proveedorIva: IvaProveedor;
  sucursalId: string;
  sucursalNombre: string;
  items: PedidoHistoriaItemDetalle[];
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

  const iva = String(d.proveedorIva) as IvaProveedor;

  return {
    id: String(d.id),
    generadoAt,
    registradoAt,
    fechaRecepcionIso: d.fechaRecepcionIso,
    total: total == null || !Number.isFinite(total) ? null : total,
    estado: d.estado,
    proveedorId: String(d.proveedorId),
    proveedorNombre: String(d.proveedorNombre),
    proveedorIva: iva,
    sucursalId: String(d.sucursalId),
    sucursalNombre: String(d.sucursalNombre),
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
          estado: "PENDIENTE",
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
      if (params.estado === "PENDIENTE") {
        where.estado = { in: ["PENDIENTE", "SIN RECEPCION"] };
      } else {
        where.estado = params.estado;
      }
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

export type PedidoHistoriaRecepcionadoNc = {
  id: string;
  fechaRecepcionIso: string | null;
  proveedorNombre: string;
  total: number | null;
};

/** Pedidos RECEPCIONADO para el picker de nota de crédito (más recientes primero). */
export async function listarPedidosHistoriaRecepcionadosParaNotaCredito(): Promise<
  ServiceResult<PedidoHistoriaRecepcionadoNc[]>
> {
  try {
    const rows = await prisma.pedidoHistoria.findMany({
      where: { estado: "RECEPCIONADO" },
      orderBy: [
        { fechaRecepcion: { sort: "desc", nulls: "last" } },
        { registradoAt: "desc" },
      ],
      take: LISTA_NC_MAX,
      select: {
        id: true,
        fechaRecepcion: true,
        registradoAt: true,
        total: true,
        proveedor: { select: { nombre: true } },
      },
    });

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        fechaRecepcionIso: fechaRecepcionIsoDesdePedido(r.fechaRecepcion, r.registradoAt),
        proveedorNombre: r.proveedor?.nombre ?? "",
        total: r.total == null ? null : Number(r.total),
      })),
    };
  } catch (e) {
    logServiceError("listarPedidosHistoriaRecepcionadosParaNotaCredito", e);
    const msg =
      e instanceof Error ? e.message : "Error al listar pedidos recepcionados.";
    return { success: false, error: msg };
  }
}

export async function guardarRecepcionPedidoHistoria(params: {
  pedidoHistoriaId: string;
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

    await prisma.$transaction(async (tx) => {
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
    });

    return { success: true, data: undefined };
  } catch (e) {
    logServiceError("guardarRecepcionPedidoHistoria", e);
    const msg =
      e instanceof Error ? e.message : "Error al guardar la recepción del pedido.";
    return { success: false, error: msg };
  }
}

export async function marcarPedidoHistoriaRegistrado(params: {
  pedidoHistoriaId: string;
  totalPedido: number;
  fechaRecepcionIso: string;
}): Promise<ServiceResult<void>> {
  const { pedidoHistoriaId, totalPedido, fechaRecepcionIso } = params;
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

    await prisma.pedidoHistoria.update({
      where: { id },
      data: {
        estado: "RECEPCIONADO",
        registradoAt: new Date(),
        fechaRecepcion: dateFromIsoYmd(fechaParsed.data),
        total: new Prisma.Decimal(totalPedido.toFixed(2)),
      },
    });
    return { success: true, data: undefined };
  } catch (e) {
    logServiceError("marcarPedidoHistoriaRegistrado", e);
    const msg = e instanceof Error ? e.message : "Error al marcar el pedido como registrado.";
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

    await prisma.pedidoHistoria.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (e) {
    logServiceError("eliminarPedidoHistoria", e);
    const msg = e instanceof Error ? e.message : "Error al borrar el pedido.";
    return { success: false, error: msg };
  }
}

