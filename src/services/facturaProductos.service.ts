import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import {
  buildMapSaldoStockItemsSucursales,
  claveSaldoStock,
} from "@/services/stockMovimientos.service";
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
   * Stock de la sucursal del usuario (si se informó `sucursalCodigo`);
   * si no, suma de stocks de todas las sucursales.
   */
  stock: number;
  /** Detalle por sucursal (cada sucursal es depósito). */
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
 * Busca en `prod_propios` por descripción: cada token debe aparecer (`contains`, insensitive).
 * Máx. `take` (Factura typeahead: 10). Incluye PX **1 - GENERAL** + stock por sucursal.
 */
export async function buscarProductosParaFactura(params: {
  q: string;
  take?: number;
  /** Código sucursal del usuario (p. ej. guaymallen); define la columna Stock. */
  sucursalCodigo?: string | null;
  /** Igualdad con `prod_propios.rubro`. Vacío = sin filtro. */
  rubro?: string | null;
  /** Igualdad con `prod_propios.sub_rubro`. Vacío = sin filtro. */
  subRubro?: string | null;
  /** Igualdad con `prod_propios.marca`. Vacío = sin filtro. */
  marca?: string | null;
  /**
   * Tope de filas. Typeahead: 10 (default). Búsqueda avanzada: 100.
   */
  takeMax?: number;
}): Promise<ServiceResult<{ items: ProductoFacturaBusquedaItem[] }>> {
  const tokens = normalizeTokens(params.q);
  const rubro = params.rubro?.trim() || null;
  const subRubro = params.subRubro?.trim() || null;
  const marca = params.marca?.trim() || null;
  if (tokens.length === 0 && !rubro && !subRubro && !marca) {
    return { success: true, data: { items: [] } };
  }

  const takeMax = Math.min(100, Math.max(1, Math.floor(Number(params.takeMax) || 10)));
  const take = Math.min(takeMax, Math.max(1, Math.floor(Number(params.take) || takeMax)));
  const sucursalCodigo = params.sucursalCodigo?.trim().toLowerCase() || null;

  try {
    const [listas, sucursales] = await Promise.all([
      prisma.prodPropioListaPrecioNombre.findMany({
        select: { idLista: true, nombreLista: true },
      }),
      prisma.sucursal.findMany({
        select: { id: true, codigo: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
    ]);
    const idListaGeneral = encontrarIdListaGeneralPxListas(listas);

    const and: Prisma.ProdPropioWhereInput[] = [
      { descripcionTienda: { not: null } },
      { descripcionTienda: { not: "" } },
    ];
    if (tokens.length > 0) {
      and.push({
        AND: tokens.map((t) => ({
          descripcionTienda: { contains: t, mode: "insensitive" as const },
        })),
      });
    }
    if (rubro) and.push({ rubro: { equals: rubro, mode: "insensitive" } });
    if (subRubro) and.push({ subRubro: { equals: subRubro, mode: "insensitive" } });
    if (marca) and.push({ marca: { equals: marca, mode: "insensitive" } });

    const where: Prisma.ProdPropioWhereInput = { AND: and };

    const rows = await prisma.prodPropio.findMany({
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

    if (codigos.length > 0 && idListaGeneral != null) {
      const precios = await prisma.prodPropioListaPrecio.findMany({
        where: { idLista: idListaGeneral, codTienda: { in: codigos } },
        select: { codTienda: true, precio: true },
      });
      for (const p of precios) {
        const n = Number(p.precio);
        pxPorCod.set(p.codTienda, Number.isFinite(n) ? n : 0);
      }
    }

    const saldos = await buildMapSaldoStockItemsSucursales(
      codigos,
      sucursales.map((s) => s.id)
    );

    const items: ProductoFacturaBusquedaItem[] = rows.map((r) => {
      const stockPorSucursal: ProductoFacturaStockSucursal[] =
        sucursales.map((s) => ({
          codigo: s.codigo,
          nombre: s.nombre,
          stock: saldos.get(claveSaldoStock(r.codTienda, s.id)) ?? 0,
        }));

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
