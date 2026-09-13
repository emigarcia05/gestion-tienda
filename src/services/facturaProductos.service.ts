import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import type { ServiceResult } from "@/types";

export interface ProductoFacturaStockSucursal {
  codigo: string;
  nombre: string;
  stock: number;
}

export interface ProductoFacturaBusquedaItem {
  codTienda: string;
  descripcion: string;
  /** Precio lista **1 - GENERAL**; `0` si no hay fila. */
  pxLista: number;
  /**
   * Stock de la sucursal del usuario (si se informó `sucursalCodigo` con depósito);
   * si no, suma de stocks de sucursales con depósito.
   */
  stock: number;
  /** Detalle por sucursal con `id_deposito` (modal lupa). */
  stockPorSucursal: ProductoFacturaStockSucursal[];
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
 * Máx. `take` (Factura typeahead: 10). Incluye PX **1 - GENERAL** + stock por sucursal.
 */
export async function buscarProductosParaFactura(params: {
  q: string;
  take?: number;
  /** Código sucursal del usuario (p. ej. guaymallen); define la columna Stock. */
  sucursalCodigo?: string | null;
}): Promise<ServiceResult<{ items: ProductoFacturaBusquedaItem[] }>> {
  const tokens = normalizeTokens(params.q);
  if (tokens.length === 0) {
    return { success: true, data: { items: [] } };
  }

  const take = Math.min(10, Math.max(1, Math.floor(Number(params.take) || 10)));
  const sucursalCodigo = params.sucursalCodigo?.trim().toLowerCase() || null;

  try {
    const [listas, sucursalesConDeposito] = await Promise.all([
      prisma.prodTiendaListaPrecio.findMany({
        select: { idLista: true, nombreLista: true },
      }),
      prisma.sucursal.findMany({
        where: { idDeposito: { not: null } },
        select: { codigo: true, nombre: true, idDeposito: true },
        orderBy: { nombre: "asc" },
      }),
    ]);
    const idListaGeneral = encontrarIdListaGeneralPxListas(listas);
    const depositos = sucursalesConDeposito
      .map((s) => s.idDeposito)
      .filter((id): id is number => id != null);

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

    const codigos = rows.map((r) => r.codTienda);
    const pxPorCod = new Map<string, number>();
    const stockPorCodDeposito = new Map<string, number>();

    if (codigos.length > 0) {
      const jobs: Promise<void>[] = [];

      if (idListaGeneral != null) {
        jobs.push(
          prisma.prodTiendaPrecio
            .findMany({
              where: { idLista: idListaGeneral, codTienda: { in: codigos } },
              select: { codTienda: true, precio: true },
            })
            .then((precios) => {
              for (const p of precios) {
                const n = Number(p.precio);
                pxPorCod.set(p.codTienda, Number.isFinite(n) ? n : 0);
              }
            })
        );
      }

      if (depositos.length > 0) {
        jobs.push(
          prisma.prodTiendaStock
            .findMany({
              where: {
                codTienda: { in: codigos },
                idDeposito: { in: depositos },
              },
              select: { codTienda: true, idDeposito: true, stockReal: true },
            })
            .then((stocks) => {
              for (const s of stocks) {
                stockPorCodDeposito.set(
                  `${s.codTienda}:${s.idDeposito}`,
                  s.stockReal
                );
              }
            })
        );
      }

      await Promise.all(jobs);
    }

    const items: ProductoFacturaBusquedaItem[] = rows.map((r) => {
      const stockPorSucursal: ProductoFacturaStockSucursal[] =
        sucursalesConDeposito.map((s) => {
          const idDep = s.idDeposito!;
          return {
            codigo: s.codigo,
            nombre: s.nombre,
            stock: stockPorCodDeposito.get(`${r.codTienda}:${idDep}`) ?? 0,
          };
        });

      const stockUsuario =
        sucursalCodigo != null
          ? stockPorSucursal.find((x) => x.codigo === sucursalCodigo)?.stock
          : undefined;
      const stock =
        stockUsuario ??
        stockPorSucursal.reduce((acc, x) => acc + x.stock, 0);

      return {
        codTienda: r.codTienda,
        descripcion: (r.descripcionTienda ?? "").trim(),
        pxLista: pxPorCod.get(r.codTienda) ?? 0,
        stock,
        stockPorSucursal,
      };
    });

    return { success: true, data: { items } };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Error al buscar productos para factura.";
    console.error("[facturacion][buscarProductosParaFactura]", e);
    return { success: false, error: msg };
  }
}
