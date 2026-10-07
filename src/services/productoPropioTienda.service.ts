import { prisma } from "@/lib/prisma";

const MENSAJE_CON_VINCULOS =
  "Este ítem tiene vínculos con proveedores. Desvinculá todos antes de marcarlo como producto propio.";

export async function setProductoPropioTienda(
  codTienda: string,
  esProductoPropio: boolean
): Promise<{ esProductoPropio: boolean }> {
  const existe = await prisma.prodPropio.findUnique({
    where: { codTienda },
    select: { codTienda: true },
  });
  if (!existe) {
    throw new Error("Ítem de tienda no encontrado.");
  }

  if (esProductoPropio) {
    const vinculos = await prisma.listaPrecioProveedor.count({
      where: { codTiendaVinculo: codTienda },
    });
    if (vinculos > 0) {
      throw new Error(MENSAJE_CON_VINCULOS);
    }
  }

  await prisma.prodPropio.update({
    where: { codTienda },
    data: { esProductoPropio },
  });

  return { esProductoPropio };
}
