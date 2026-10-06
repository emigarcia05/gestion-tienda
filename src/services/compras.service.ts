import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import { PAGE_SIZE, skipForPagina, totalPaginasFromTotal } from "@/lib/pagination";
import { isoYmdFromPrismaDateOnly } from "@/lib/fechaArgentina";
import type { SucursalPedidoEnvio } from "@/services/pedidosEnvio.service";
import { TIPO_COMP_COMPRA } from "@/services/pedidosHistoria.service";

const COMPRAS_Q_MAX_LEN = 50;

/** Fila del módulo **Compras**: comprobante de compra creado al recepcionar un pedido. */
export interface CompraRecepcionadaFila {
  id: string;
  pedidoHistoriaId: string;
  fechaIso: string;
  proveedorNombre: string;
  sucursalNombre: string;
  numero: string;
  fiscal: boolean;
  total: number;
  montoAplicado: number;
  saldo: number;
  notasCredito: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Comprobantes de compra (`fin_compras_comprobante`, no NC) con pedido de recepción vinculado.
 * Los importados de DUX o de pedidos ya purgados no tienen `pedido_historia_id` y no se listan.
 */
export async function listarComprasRecepcionadas(params: {
  pagina?: number;
  proveedorId?: string;
  sucursalCodigo?: SucursalPedidoEnvio;
  /** Contiene en el N° de comprobante. */
  q?: string;
}): Promise<
  ServiceResult<{
    items: CompraRecepcionadaFila[];
    total: number;
    totalPaginas: number;
    paginaActual: number;
  }>
> {
  const paginaActual = Math.max(1, Math.floor(Number(params.pagina) || 1));
  const q = (params.q ?? "").trim().slice(0, COMPRAS_Q_MAX_LEN);

  const pedidoWhere: Prisma.PedidoHistoriaWhereInput = {};
  if (params.proveedorId?.trim()) pedidoWhere.proveedorId = params.proveedorId.trim();
  if (params.sucursalCodigo) pedidoWhere.sucursal = { codigo: params.sucursalCodigo };

  const where: Prisma.ComprobanteProveedorWhereInput = {
    pedidoHistoriaId: { not: null },
    tipoComp: { not: TIPO_COMP_COMPRA.NOTA_CREDITO },
    pedidoHistoria: pedidoWhere,
    ...(q ? { comprobante: { contains: q, mode: "insensitive" } } : {}),
  };

  try {
    const [total, rows] = await Promise.all([
      prisma.comprobanteProveedor.count({ where }),
      prisma.comprobanteProveedor.findMany({
        where,
        orderBy: [{ fechaComp: "desc" }, { createdAt: "desc" }],
        skip: skipForPagina(paginaActual, PAGE_SIZE),
        take: PAGE_SIZE,
        select: {
          id: true,
          pedidoHistoriaId: true,
          fechaComp: true,
          tipoComp: true,
          comprobante: true,
          total: true,
          montoAplicado: true,
          proveedor: { select: { nombre: true } },
          pedidoHistoria: { select: { sucursal: { select: { nombre: true } } } },
          _count: { select: { notasCredito: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: rows.map((r) => {
          const totalNum = Number(r.total);
          const aplicado = Number(r.montoAplicado);
          return {
            id: r.id,
            pedidoHistoriaId: r.pedidoHistoriaId ?? "",
            fechaIso: isoYmdFromPrismaDateOnly(r.fechaComp),
            proveedorNombre: r.proveedor?.nombre ?? "—",
            sucursalNombre: r.pedidoHistoria?.sucursal?.nombre ?? "—",
            numero: r.comprobante,
            fiscal: r.tipoComp === TIPO_COMP_COMPRA.FISCAL,
            total: totalNum,
            montoAplicado: aplicado,
            saldo: round2(totalNum - aplicado),
            notasCredito: r._count.notasCredito,
          };
        }),
        total,
        totalPaginas: totalPaginasFromTotal(total, PAGE_SIZE),
        paginaActual,
      },
    };
  } catch (e) {
    console.error("[compras][listarComprasRecepcionadas]", e instanceof Error ? e.message : e);
    return { success: false, error: "Error al listar las compras." };
  }
}
