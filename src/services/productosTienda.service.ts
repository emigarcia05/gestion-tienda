import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ServiceResult } from "@/types";

export interface ProductoTiendaRowBusqueda {
  id: string;
  codTienda: string;
  descripcionTienda: string;
}

function normalizeTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function buscarProductosTiendaPorDescripcion(params: {
  q?: string;
  take?: number;
}): Promise<ServiceResult<{ items: ProductoTiendaRowBusqueda[]; total: number }>> {
  const q = params.q ?? "";
  const take = Math.max(1, Math.floor(Number(params.take) || 100));

  try {
    const query = q.trim();
    const tokens = normalizeTokens(query);

    // Si no hay búsqueda, mostramos un subset estable para que el modal sea útil.
    const whereDescripcion: Prisma.ProdPropioWhereInput =
      tokens.length === 0
        ? {
            AND: [
              { descripcionTienda: { not: null } },
              { descripcionTienda: { not: "" } },
            ],
          }
        : {
            AND: [
              { descripcionTienda: { not: null } },
              { descripcionTienda: { not: "" } },
              {
                // Cada token debe estar presente en la descripción.
                // Esto hace el filtrado predecible (no “demasiado amplio”).
                AND: tokens.map((t) => ({
                  descripcionTienda: { contains: t, mode: "insensitive" as const },
                })),
              },
            ],
          };

    const [rows, total] = await Promise.all([
      prisma.prodPropio.findMany({
        where: whereDescripcion,
        select: { codTienda: true, descripcionTienda: true },
        orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
        take,
      }),
      prisma.prodPropio.count({ where: whereDescripcion }),
    ]);

    const items: ProductoTiendaRowBusqueda[] = rows.map((r) => ({
      id: r.codTienda,
      codTienda: r.codTienda,
      descripcionTienda: (r.descripcionTienda ?? "").trim(),
    }));

    return { success: true, data: { items, total } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al buscar productos en tienda.";
    return { success: false, error: msg };
  }
}

