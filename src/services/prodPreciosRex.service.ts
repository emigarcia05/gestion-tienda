/**
 * Catálogo `prod_precios_rex`: ítems individualizados (descripción + presentación) de la lista PDF
 * matricial por proveedor. Lo escribe `importListaPdf.service.ts`; acá vive la vinculación manual
 * fila de lista ↔ ítem PDF (N:1).
 */

import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import type { Prisma } from "@prisma/client";

export interface VinculoListaPrecioRexResumen {
  codExt: string;
  descripcionProveedor: string;
}

export interface PrecioRexParaVincular {
  id: string;
  descripcion: string;
  pxListaProveedor: number;
  /** Otros ítems de lista que ya apuntan a este REX (informativo). */
  otrosVinculosLista: VinculoListaPrecioRexResumen[];
  /** Este REX ya está vinculado a la fila en edición. */
  vinculadoAFilaActual: boolean;
}

const MAX_PRECIOS_REX_VINCULAR = 500;

/** Lista ítems REX del mismo proveedor para modal de vinculación en Lista Precios. */
export async function listarPreciosRexParaVincular(
  proveedorId: string,
  codExtLista: string,
  q?: string
): Promise<PrecioRexParaVincular[]> {
  const andParts: Prisma.ProdPrecioRexWhereInput[] = [{ idProveedor: proveedorId }];
  const textFilter = filtroTexto(q ?? "", ["descripcion"]);
  if (textFilter.AND?.length) andParts.push(textFilter);
  const where: Prisma.ProdPrecioRexWhereInput = { AND: andParts };

  const rows = await prisma.prodPrecioRex.findMany({
    where,
    include: {
      listaPreciosProveedor: {
        select: { codExt: true, descripcionProveedor: true },
      },
    },
    orderBy: { descripcion: "asc" },
    take: MAX_PRECIOS_REX_VINCULAR,
  });

  return rows.map((r) => ({
    id: r.id,
    descripcion: r.descripcion,
    pxListaProveedor: Number(r.pxListaProveedor),
    otrosVinculosLista: r.listaPreciosProveedor
      .filter((lp) => lp.codExt !== codExtLista)
      .map((lp) => ({
        codExt: lp.codExt,
        descripcionProveedor: lp.descripcionProveedor,
      })),
    vinculadoAFilaActual: r.listaPreciosProveedor.some((lp) => lp.codExt === codExtLista),
  }));
}

export type VincularListaPrecioConPrecioRexResult =
  | { ok: true }
  | { ok: false; error: string };

/** Vincula una fila lista proveedor con un ítem REX del mismo proveedor (N:1). */
export async function vincularListaPrecioConPrecioRex(
  codExtLista: string,
  idPrecioRex: string
): Promise<VincularListaPrecioConPrecioRexResult> {
  const [lista, rex] = await Promise.all([
    prisma.listaPrecioProveedor.findUnique({
      where: { codExt: codExtLista },
      select: { codExt: true, idProveedor: true, idPrecioRex: true },
    }),
    prisma.prodPrecioRex.findUnique({
      where: { id: idPrecioRex },
      select: { id: true, idProveedor: true, pxListaProveedor: true },
    }),
  ]);

  if (!lista) {
    return { ok: false, error: "Producto de lista no encontrado." };
  }
  if (!rex) {
    return { ok: false, error: "Precio REX no encontrado." };
  }
  if (lista.idProveedor !== rex.idProveedor) {
    return { ok: false, error: "El precio REX pertenece a otro proveedor." };
  }

  await prisma.listaPrecioProveedor.update({
    where: { codExt: codExtLista },
    data: {
      idPrecioRex,
      pxListaProveedor: rex.pxListaProveedor,
    },
  });

  return { ok: true };
}
