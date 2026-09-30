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
  /** Igualdad con `prod_tienda.rubro`. Vacío = sin filtro. */
  rubro?: string | null;
  /** Igualdad con `prod_tienda.sub_rubro`. Vacío = sin filtro. */
  subRubro?: string | null;
  /** Igualdad con `prod_tienda.marca`. Vacío = sin filtro. */
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

    const and: Prisma.ProdTiendaWhereInput[] = [
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

    const where: Prisma.ProdTiendaWhereInput = { AND: and };

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
