/**
 * Movimientos de stock tras registrar una venta (modal **MOVIMIENTOS**): proveedores a los que
 * se puede dirigir la compra de cada ítem (vínculos `proveedores_prod_lista` habilitados).
 */
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import type { ProveedorCompraVentaItem } from "@/lib/ventaMovimientosStock";
import { etiquetaProveedorCosto } from "@/services/costoListaTienda.service";

function toNum(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** `cod_tienda` → proveedores habilitados (más barato primero; el CX elegido del ítem va marcado). */
export async function listarProveedoresCompraPorCodTiendas(
  codTiendas: readonly string[]
): Promise<ServiceResult<Record<string, ProveedorCompraVentaItem[]>>> {
  const codigos = [...new Set(codTiendas.map((c) => c.trim()).filter(Boolean))];
  if (codigos.length === 0) return { success: true, data: {} };
  try {
    const [vinculos, items] = await Promise.all([
      prisma.listaPrecioProveedor.findMany({
        where: { codTiendaVinculo: { in: codigos }, habilitado: true },
        select: {
          codExt: true,
          codTiendaVinculo: true,
          pxCompraFinalSinIva: true,
          proveedor: { select: { nombre: true, prefijo: true } },
        },
      }),
      prisma.prodPropio.findMany({
        where: { codTienda: { in: codigos } },
        select: { codTienda: true, costoCompraCodExt: true },
      }),
    ]);
    const cxPorCod = new Map(items.map((i) => [i.codTienda, i.costoCompraCodExt]));
    const out: Record<string, ProveedorCompraVentaItem[]> = Object.fromEntries(codigos.map((c) => [c, []]));
    for (const v of vinculos) {
      if (!v.codTiendaVinculo) continue;
      out[v.codTiendaVinculo]?.push({
        codExt: v.codExt,
        proveedor: etiquetaProveedorCosto(v.proveedor.prefijo, v.proveedor.nombre),
        pxCompra: toNum(v.pxCompraFinalSinIva),
        esCxElegido: cxPorCod.get(v.codTiendaVinculo) === v.codExt,
      });
    }
    for (const lista of Object.values(out)) {
      lista.sort((a, b) => a.pxCompra - b.pxCompra || a.proveedor.localeCompare(b.proveedor, "es"));
    }
    return { success: true, data: out };
  } catch (e) {
    console.error("[ventaMovimientosStock.service] listarProveedoresCompraPorCodTiendas:", e);
    return { success: false, error: "No se pudieron leer los proveedores de los ítems." };
  }
}
