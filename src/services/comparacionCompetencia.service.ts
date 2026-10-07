import type { Prisma } from "@prisma/client";
import { matchByMultiTerm } from "@/lib/busqueda";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export interface ProductoTiendaParaComparacionRow {
  id: string;
  codTienda: string;
  descripcionTienda: string;
  marca: string | null;
  rubro: string | null;
}

const CAMPOS_BUSQUEDA_COMPARACION = [
  "descripcionTienda",
  "codTienda",
  "marca",
  "rubro",
] as const;

const MAX_BUSQUEDA_COMPARACION_DB = 500;

function buildWhereBusquedaProductosTienda(q: string): Prisma.ProdPropioWhereInput {
  const andParts: Prisma.ProdPropioWhereInput[] = [{ compararCompetencia: false }];
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    andParts.push({
      AND: tokens.map((token) => ({
        OR: CAMPOS_BUSQUEDA_COMPARACION.map((campo) => ({
          [campo]: { contains: token, mode: "insensitive" as const },
        })),
      })),
    });
  } else {
    andParts.push(
      { descripcionTienda: { not: null } },
      { descripcionTienda: { not: "" } }
    );
  }
  return { AND: andParts };
}

function mapRowProductoComparacion(r: {
  codTienda: string;
  descripcionTienda: string | null;
  marca: string | null;
  rubro: string | null;
}): ProductoTiendaParaComparacionRow {
  return {
    id: r.codTienda,
    codTienda: r.codTienda,
    descripcionTienda: (r.descripcionTienda ?? "").trim(),
    marca: r.marca,
    rubro: r.rubro,
  };
}

export async function buscarProductosTiendaParaComparacion(params: {
  q?: string;
  take?: number;
}): Promise<ServiceResult<{ items: ProductoTiendaParaComparacionRow[]; total: number }>> {
  const take = Math.max(1, Math.floor(Number(params.take) || 100));
  const q = (params.q ?? "").trim();
  const hasSearch = q.length > 0;
  const where = buildWhereBusquedaProductosTienda(q);

  try {
    if (!hasSearch) {
      const [rows, total] = await Promise.all([
        prisma.prodPropio.findMany({
          where,
          select: {
            codTienda: true,
            descripcionTienda: true,
            marca: true,
            rubro: true,
          },
          orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
          take,
        }),
        prisma.prodPropio.count({ where }),
      ]);

      return {
        success: true,
        data: {
          items: rows.map(mapRowProductoComparacion),
          total,
        },
      };
    }

    const rows = await prisma.prodPropio.findMany({
      where,
      select: {
        codTienda: true,
        descripcionTienda: true,
        marca: true,
        rubro: true,
      },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      take: Math.max(take, MAX_BUSQUEDA_COMPARACION_DB),
    });

    const filtered = rows
      .map(mapRowProductoComparacion)
      .filter((row) =>
        matchByMultiTerm([row.descripcionTienda, row.codTienda, row.marca, row.rubro], q)
      );

    const items = filtered.slice(0, take);

    return {
      success: true,
      data: {
        items,
        total: filtered.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al buscar productos para comparar.",
    };
  }
}

export async function agregarProductoComparacionCompetencia(
  codTienda: string
): Promise<ServiceResult<void>> {
  try {
    const existente = await prisma.prodPropio.findUnique({
      where: { codTienda },
      select: { compararCompetencia: true },
    });
    if (!existente) {
      return { success: false, error: "Producto no encontrado en tienda." };
    }
    if (existente.compararCompetencia) {
      return { success: false, error: "El producto ya está en comparación." };
    }

    await prisma.prodPropio.update({
      where: { codTienda },
      data: { compararCompetencia: true },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo agregar el producto a comparación.",
    };
  }
}

export async function quitarProductoComparacionCompetencia(
  codTienda: string
): Promise<ServiceResult<void>> {
  try {
    const existente = await prisma.prodPropio.findUnique({
      where: { codTienda },
      select: { compararCompetencia: true },
    });
    if (!existente) {
      return { success: false, error: "Producto no encontrado en tienda." };
    }
    if (!existente.compararCompetencia) {
      return { success: false, error: "El producto no está en comparación." };
    }

    await prisma.prodPropio.update({
      where: { codTienda },
      data: { compararCompetencia: false },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo quitar el producto de comparación.",
    };
  }
}
