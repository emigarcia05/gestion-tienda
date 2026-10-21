/**
 * Movimientos de stock tras registrar una venta (modal **MOVIMIENTOS**): proveedores a los que
 * se puede dirigir la compra de cada ítem. Rubro Tintométrico → proveedores con COEF. TINTOMÉTRICO > 1
 * (pedido TINTOMETRICO); resto → vínculos `proveedores_prod_lista` habilitados (PEDIDO URGENTE).
 */
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import { esRubroTintometrico } from "@/lib/codColorTintometrico";
import type { ProveedorCompraVentaItem } from "@/lib/ventaMovimientosStock";
import { etiquetaProveedorCosto } from "@/services/costoListaTienda.service";
import { listarProveedoresCoefTintometrico } from "@/services/tintometrico.service";

function toNum(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** `cod_tienda` → proveedores elegibles (lista: más barato primero, CX elegido marcado). */
export async function listarProveedoresCompraPorCodTiendas(
  codTiendas: readonly string[]
): Promise<ServiceResult<Record<string, ProveedorCompraVentaItem[]>>> {
  const codigos = [...new Set(codTiendas.map((c) => c.trim()).filter(Boolean))];
  if (codigos.length === 0) return { success: true, data: {} };
  try {
    const items = await prisma.prodPropio.findMany({
      where: { codTienda: { in: codigos } },
      select: { codTienda: true, costoCompraCodExt: true, rubroRelation: { select: { nombre: true } } },
    });
    const tintometricos = new Set(
      items.filter((i) => esRubroTintometrico(i.rubroRelation?.nombre)).map((i) => i.codTienda)
    );
    const codigosLista = codigos.filter((c) => !tintometricos.has(c));

    const [vinculos, provTint] = await Promise.all([
      codigosLista.length > 0
        ? prisma.listaPrecioProveedor.findMany({
            where: { codTiendaVinculo: { in: codigosLista }, habilitado: true },
            select: {
              codExt: true,
              codTiendaVinculo: true,
              pxCompraFinalSinIva: true,
              proveedor: { select: { nombre: true, prefijo: true } },
            },
          })
        : Promise.resolve([]),
      tintometricos.size > 0 ? listarProveedoresCoefTintometrico() : Promise.resolve([]),
    ]);

    const cxPorCod = new Map(items.map((i) => [i.codTienda, i.costoCompraCodExt]));
    const out: Record<string, ProveedorCompraVentaItem[]> = Object.fromEntries(codigos.map((c) => [c, []]));
    for (const v of vinculos) {
      if (!v.codTiendaVinculo) continue;
      out[v.codTiendaVinculo]?.push({
        tipo: "lista",
        id: v.codExt,
        proveedor: etiquetaProveedorCosto(v.proveedor.prefijo, v.proveedor.nombre),
        pxCompra: toNum(v.pxCompraFinalSinIva),
        esCxElegido: cxPorCod.get(v.codTiendaVinculo) === v.codExt,
      });
    }
    for (const cod of codigosLista) {
      out[cod]?.sort(
        (a, b) =>
          (a.tipo === "lista" && b.tipo === "lista" ? a.pxCompra - b.pxCompra : 0) ||
          a.proveedor.localeCompare(b.proveedor, "es")
      );
    }
    const listaTint: ProveedorCompraVentaItem[] = provTint.map((p) => ({
      tipo: "tintometrico",
      id: p.id,
      proveedor: p.nombre.trim(),
    }));
    for (const cod of tintometricos) out[cod] = listaTint.map((p) => ({ ...p }));
    return { success: true, data: out };
  } catch (e) {
    console.error("[ventaMovimientosStock.service] listarProveedoresCompraPorCodTiendas:", e);
    return { success: false, error: "No se pudieron leer los proveedores de los ítems." };
  }
}
