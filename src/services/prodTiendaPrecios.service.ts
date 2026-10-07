import { getIdPrecioListaPrincipal } from "@/lib/duxApi";
import { prisma } from "@/lib/prisma";

export { getIdPrecioListaPrincipal };

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
