import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import type { ServiceResult } from "@/types";

export interface ProductoFacturaBusquedaItem {
  codTienda: string;
  descripcion: string;
  /** Precio lista **1 - GENERAL**; `0` si no hay fila. */
  pxLista: number;
}

function normalizeTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Busca en `prod_tienda` por descripción: cada token debe aparecer (`contains`, insensitive).
 * Máx. `take` (Factura typeahead: 10). Incluye PX de lista **1 - GENERAL**.
 */
export async function buscarProductosParaFactura(params: {
  q: string;
  take?: number;
}): Promise<ServiceResult<{ items: ProductoFacturaBusquedaItem[] }>> {
  const tokens = normalizeTokens(params.q);
  if (tokens.length === 0) {
    return { success: true, data: { items: [] } };
  }

  const take = Math.min(10, Math.max(1, Math.floor(Number(params.take) || 10)));

  try {
    const listas = await prisma.prodTiendaListaPrecio.findMany({
      select: { idLista: true, nombreLista: true },
    });
    const idListaGeneral = encontrarIdListaGeneralPxListas(listas);

    const where: Prisma.ProdTiendaWhereInput = {
      AND: [
        { descripcionTienda: { not: null } },
        { descripcionTienda: { not: "" } },
        {
          AND: tokens.map((t) => ({
            descripcionTienda: { contains: t, mode: "insensitive" as const },
          })),
        },
      ],
    };

    const rows = await prisma.prodTienda.findMany({
      where,
      select: {
        codTienda: true,
        descripcionTienda: true,
      },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      take,
    });

    const pxPorCod = new Map<string, number>();
    if (idListaGeneral != null && rows.length > 0) {
      const precios = await prisma.prodTiendaPrecio.findMany({
        where: {
          idLista: idListaGeneral,
          codTienda: { in: rows.map((r) => r.codTienda) },
        },
        select: { codTienda: true, precio: true },
      });
      for (const p of precios) {
        const n = Number(p.precio);
        pxPorCod.set(p.codTienda, Number.isFinite(n) ? n : 0);
      }
    }

    const items: ProductoFacturaBusquedaItem[] = rows.map((r) => ({
      codTienda: r.codTienda,
      descripcion: (r.descripcionTienda ?? "").trim(),
      pxLista: pxPorCod.get(r.codTienda) ?? 0,
    }));

    return { success: true, data: { items } };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al buscar productos para factura.";
    console.error("[facturacion][buscarProductosParaFactura]", e);
    return { success: false, error: msg };
  }
}
