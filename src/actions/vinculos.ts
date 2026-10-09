"use server";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import type { ServiceResult } from "@/types";
import type { ProductoCompleto } from "@/types";
import {
  autoAsignarCodExtCostoListaTrasVincular,
  establecerCodExtCostoLista,
  limpiarCodExtCostoLista,
  limpiarCodExtCostoListaSiCoincide,
} from "@/services/costoListaTienda.service";
import { getProductosVinculadosPorItemTienda } from "@/services/producto.service";
import { listarProductosProveedoresParaVincular, type ProductoProveedorParaVincular } from "@/services/listaPrecios.service";
import { getProveedoresMercaderia } from "@/services/proveedor.service";
import { listaPreciosCodExtSchema, listaPreciosCodTiendaSchema, prismaCuidSchema } from "@/lib/validations/common";
import { z } from "zod";

const listarParaVincularFiltrosSchema = z.object({
  proveedorId: prismaCuidSchema.optional(),
  q: z.string().max(500).optional(),
});

export type VinculosItemTiendaPayload = {
  productos: ProductoCompleto[];
  costoCompraCodExt: string | null;
  esProductoPropio: boolean;
};

export async function getVinculos(
  itemTiendaCod: string
): Promise<ServiceResult<VinculosItemTiendaPayload>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return { success: false, error: "Sin acceso a tienda." };
  }
  const parsedId = listaPreciosCodTiendaSchema.safeParse(itemTiendaCod);
  if (!parsedId.success) return { success: false, error: "Cód. tienda inválido." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const [productosRes, tienda] = await Promise.all([
      getProductosVinculadosPorItemTienda(parsedId.data),
      prisma.prodPropio.findUnique({
        where: { codTienda: parsedId.data },
        select: { costoCompraCodExt: true, esProductoPropio: true },
      }),
    ]);
    if (!productosRes.success) return productosRes;
    if (!tienda) return { success: false, error: "Ítem tienda no encontrado." };
    return {
      success: true,
      data: {
        productos: productosRes.data,
        costoCompraCodExt: tienda.costoCompraCodExt,
        esProductoPropio: tienda.esProductoPropio,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Proveedores de mercadería (para modal de vinculación y otros). */
export async function getProveedores() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) return [];
  return getProveedoresMercaderia();
}

/** Lista ítems de proveedor_prod_lista para modal "Vincular nuevo producto". Filtros: proveedor, descripción (q). */
export async function listarProductosParaVincular(
  proveedorId?: string,
  q?: string
): Promise<ServiceResult<ProductoProveedorParaVincular[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return { success: false, error: "Sin acceso a tienda." };
  }
  const parsed = listarParaVincularFiltrosSchema.safeParse({ proveedorId, q });
  if (!parsed.success) {
    return { success: false, error: "Parámetros de búsqueda inválidos." };
  }
  try {
    const data = await listarProductosProveedoresParaVincular(
      parsed.data.proveedorId,
      parsed.data.q
    );
    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export async function vincularProducto(
  itemTiendaCod: string,
  productoListaCodExt: string
): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return { ok: false, error: "Sin acceso a tienda." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };
  const parsedItem = listaPreciosCodTiendaSchema.safeParse(itemTiendaCod);
  const parsedProducto = listaPreciosCodExtSchema.safeParse(productoListaCodExt);
  if (!parsedItem.success || !parsedProducto.success) {
    return { ok: false, error: "Datos de vínculo inválidos." };
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    const tienda = await prisma.prodPropio.findUnique({
      where: { codTienda: parsedItem.data },
      select: { esProductoPropio: true },
    });
    if (!tienda) return { ok: false, error: "Ítem de tienda no encontrado." };
    if (tienda.esProductoPropio) {
      return {
        ok: false,
        error:
          "Este ítem está marcado como producto propio TiendaColor. Quitá esa marca antes de vincular proveedores.",
      };
    }
    const producto = await prisma.listaPrecioProveedor.findUnique({
      where: { codExt: parsedProducto.data },
      select: { idProveedor: true },
    });
    if (!producto) return { ok: false, error: "Producto no encontrado." };
    const yaVinculadoMismoProveedor = await prisma.listaPrecioProveedor.findFirst({
      where: {
        codTiendaVinculo: parsedItem.data,
        idProveedor: producto.idProveedor,
        codExt: { not: parsedProducto.data },
      },
    });
    if (yaVinculadoMismoProveedor) {
      return {
        ok: false,
        error:
          "Ya existe un vínculo con ese proveedor. No se puede tener dos vinculaciones del mismo proveedor.",
      };
    }
    await prisma.listaPrecioProveedor.update({
      where: { codExt: parsedProducto.data },
      data: { codTiendaVinculo: parsedItem.data },
    });
    await autoAsignarCodExtCostoListaTrasVincular(parsedItem.data);
    revalidatePath("/administrador/productos/cx-compra");
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al vincular el producto.";
    return { ok: false, error: message };
  }
}

export async function desvincularProducto(
  itemTiendaCod: string,
  productoListaCodExt: string
): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return { ok: false, error: "Sin acceso a tienda." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };
  const parsedItem = listaPreciosCodTiendaSchema.safeParse(itemTiendaCod);
  const parsed = listaPreciosCodExtSchema.safeParse(productoListaCodExt);
  if (!parsedItem.success || !parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    const { prisma } = await import("@/lib/prisma");
    const itemTienda = await prisma.prodPropio.findUnique({
      where: { codTienda: parsedItem.data },
      select: { codTienda: true },
    });
    if (!itemTienda) return { ok: false, error: "Ítem tienda no encontrado." };
    const producto = await prisma.listaPrecioProveedor.findUnique({
      where: { codExt: parsed.data },
      select: {
        codExt: true,
        codTiendaVinculo: true,
        proveedor: { select: { nombre: true, prefijo: true } },
      },
    });
    if (!producto || producto.codTiendaVinculo !== itemTienda.codTienda) {
      return { ok: false, error: "Producto no encontrado o no vinculado a este ítem." };
    }
    await limpiarCodExtCostoListaSiCoincide(itemTienda.codTienda, parsed.data);
    await prisma.listaPrecioProveedor.update({
      where: { codExt: parsed.data },
      data: { codTiendaVinculo: null },
    });
    revalidatePath("/administrador/productos/cx-compra");
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al desvincular el producto.";
    return { ok: false, error: message };
  }
}

/**
 * Define qué fila `proveedor_prod_lista` alimenta CX. COMPRA / costo base de comparación.
 * - `productoListaCodExt = string` → fija FK `costo_compra_cod_ext` al `codExt` indicado.
 * - `productoListaCodExt = null` → destilda: limpia la FK (vuelve a Cx. Prom. / sin base).
 */
export async function establecerCostoListaTiendaAction(
  itemTiendaCod: string,
  productoListaCodExt: string | null
): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return { ok: false, error: "Sin acceso a tienda." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };
  const parsedItem = listaPreciosCodTiendaSchema.safeParse(itemTiendaCod);
  if (!parsedItem.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  if (productoListaCodExt === null) {
    const res = await limpiarCodExtCostoLista(parsedItem.data);
    if (!res.success) return { ok: false, error: res.error };
  } else {
    const parsedProducto = listaPreciosCodExtSchema.safeParse(productoListaCodExt);
    if (!parsedProducto.success) {
      return { ok: false, error: "Datos inválidos." };
    }
    const res = await establecerCodExtCostoLista(parsedItem.data, parsedProducto.data);
    if (!res.success) return { ok: false, error: res.error };
  }
  revalidatePath(GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra);
  revalidatePath(GP_ROUTES.analisisPrecios.listaPropia.listaProductos);
  return { ok: true, data: undefined };
}
