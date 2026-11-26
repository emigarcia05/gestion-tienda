import { prisma } from "@/lib/prisma";
import { pxVentaVigente } from "@/lib/pxListasPreciosCelda";
import { mapCostoCompraPorCodTienda } from "@/services/costoListaTienda.service";

/** `id_lista` de la lista principal en `prod_lista_precios` (id heredado de DUX). */
const ID_LISTA_PRECIO_PRINCIPAL = 56994;

export function getIdPrecioListaPrincipal(): number {
  return ID_LISTA_PRECIO_PRINCIPAL;
}

/**
 * PX de una lista para cada ítem. Con PORC. UTILIDAD guardado, el importe
 * sale del costo de compra vigente. Sin porcentaje, usa el importe guardado.
 */
export async function mapPxVentaDeLista(
  codTiendas: string[],
  idLista: number
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codTiendas.length === 0) return map;
  const [rows, costos] = await Promise.all([
    prisma.prodPropioListaPrecio.findMany({
      where: { codTienda: { in: codTiendas }, idLista },
      select: { codTienda: true, precio: true, porcUtilidad: true },
    }),
    mapCostoCompraPorCodTienda(codTiendas),
  ]);
  for (const r of rows) {
    const px = pxVentaVigente(
      r.porcUtilidad == null ? null : Number(r.porcUtilidad),
      Number(r.precio),
      costos.get(r.codTienda) ?? 0
    );
    if (px != null && px > 0) map.set(r.codTienda, px);
  }
  return map;
}

/** Mapa cod_tienda → precio de lista principal (0 si no hay fila). */
export async function buildMapPrecioListaPrincipal(
  codTiendas: string[]
): Promise<Map<string, number>> {
  const vigentes = await mapPxVentaDeLista(codTiendas, getIdPrecioListaPrincipal());
  const map = new Map<string, number>();
  for (const cod of codTiendas) map.set(cod, vigentes.get(cod) ?? 0);
  return map;
}
