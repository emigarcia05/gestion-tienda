/**
 * DAL Producto – Vinculados desde proveedor_prod_lista.
 */
import type { ServiceResult } from "@/types";
import type { ProductoCompleto } from "@/types";
import { prisma } from "@/lib/prisma";

/** Productos de proveedor_prod_lista vinculados al ítem tienda (`codTiendaVinculo` = `cod_tienda`). */
export async function getProductosVinculadosPorItemTienda(codTienda: string): Promise<ServiceResult<ProductoCompleto[]>> {
  try {
    const rows = await prisma.listaPrecioProveedor.findMany({
      where: { codTiendaVinculo: codTienda },
      include: { proveedor: true },
      orderBy: { codExt: "asc" },
    });
    const data: ProductoCompleto[] = rows.map((r) => ({
      id: r.codExt,
      codProdProv: r.codProdProveedor,
      codigoExterno: r.codExt,
      descripcion: r.descripcionProveedor,
      precioLista: Number(r.pxListaProveedor),
      precioVentaSugerido: Number(r.pxVtaSugerido ?? 0),
      descuentoRubro: Number(r.dtoRubro),
      descuentoCantidad: Number(r.dtoCantidad),
      cxTransporte: Number(r.cxTransporte),
      pxCompraFinalSinIva: r.pxCompraFinalSinIva != null ? Number(r.pxCompraFinalSinIva) : null,
      disponible: true,
      proveedorId: r.proveedor.id,
      proveedor: { id: r.proveedor.id, nombre: r.proveedor.nombre, prefijo: r.proveedor.prefijo ?? "" },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
