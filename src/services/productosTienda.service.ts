import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { RUBRO_TINTOMETRICO } from "@/lib/codColorTintometrico";
import { esProveedorHabilitadoTintometrico } from "@/services/tintometrico.service";
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
  /**
   * Si viene, solo ítems vinculados a ese proveedor.
   * Proveedor tintométrico: también el rubro TINTOMETRICO.
   */
  proveedorId?: string;
}): Promise<ServiceResult<{ items: ProductoTiendaRowBusqueda[]; total: number }>> {
  const q = params.q ?? "";
  const take = Math.max(1, Math.floor(Number(params.take) || 100));
  const proveedorId = params.proveedorId?.trim() ?? "";

  try {
    const query = q.trim();
    const tokens = normalizeTokens(query);

    // Si no hay búsqueda, mostramos un subset estable para que el modal sea útil.
    // Recepción: vínculo del proveedor. Si además es tintométrico, suma el rubro TINTOMETRICO.
    const incluyeRubroTintometrico = proveedorId
      ? await esProveedorHabilitadoTintometrico(proveedorId)
      : false;
    const alcanceProveedor: Prisma.ProdPropioWhereInput | null = !proveedorId
      ? null
      : incluyeRubroTintometrico
        ? {
            OR: [
              { listaPreciosProveedores: { some: { idProveedor: proveedorId } } },
              {
                rubroRelation: {
                  nombre: { equals: RUBRO_TINTOMETRICO, mode: "insensitive" },
                },
              },
            ],
          }
        : {
            listaPreciosProveedores: { some: { idProveedor: proveedorId } },
          };

    const base: Prisma.ProdPropioWhereInput[] = [
      { habilitado: true },
      { descripcionTienda: { not: null } },
      { descripcionTienda: { not: "" } },
      ...(alcanceProveedor ? [alcanceProveedor] : []),
    ];

    const whereDescripcion: Prisma.ProdPropioWhereInput =
      tokens.length === 0
        ? { AND: base }
        : {
            AND: [
              ...base,
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

