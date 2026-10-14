import { prisma } from "@/lib/prisma";

/** `id_lista` de la lista principal en `prod_listas_precios` (id heredado de DUX). */
const ID_LISTA_PRECIO_PRINCIPAL = 56994;

export function getIdPrecioListaPrincipal(): number {
  return ID_LISTA_PRECIO_PRINCIPAL;
}

/** Mapa cod_tienda → precio de lista principal (0 si no hay fila). */
export async function buildMapPrecioListaPrincipal(
  codTiendas: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codTiendas.length === 0) return map;
  const idLista = getIdPrecioListaPrincipal();
  const rows = await prisma.prodPropioListaPrecio.findMany({
    where: { codTienda: { in: codTiendas }, idLista },
    select: { codTienda: true, precio: true },
  });
  for (const r of rows) {
    map.set(r.codTienda, Number(r.precio));
  }
  return map;
}
