/**
 * Catálogo prod_precios_rex — precios por proveedor desde conversión PDF matriz.
 * Upsert por clave (id_proveedor, descripcion normalizada).
 */

import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { normalizarDescripcionPrecioRex } from "@/lib/listaPreciosPdfMatriz";
import type { FilaPdfMatrizNormalizadaDto } from "@/lib/validations/parseListaPreciosPdfMatriz";
import type { Prisma } from "@prisma/client";

export interface UpsertPreciosRexResult {
  creados: number;
  actualizados: number;
  /** Filas `proveedor_prod_lista` cuyo `px_lista_proveedor` se actualizó desde REX vinculado. */
  listaPreciosSincronizadas: number;
  errores: string[];
}

const CHUNK_PREFETCH = 500;

/**
 * Copia `prod_precios_rex.px_lista_proveedor` → `proveedor_prod_lista.px_lista_proveedor`
 * en todas las filas lista con `id_precio_rex` apuntando a esos REX.
 */
export async function sincronizarPxListaProveedorDesdePreciosRex(
  idsPrecioRex: string[]
): Promise<{ filasActualizadas: number }> {
  const uniqueIds = [...new Set(idsPrecioRex.filter(Boolean))];
  if (uniqueIds.length === 0) return { filasActualizadas: 0 };

  const filasActualizadas = await prisma.$executeRaw`
    UPDATE proveedor_prod_lista AS lp
    SET px_lista_proveedor = r.px_lista_proveedor
    FROM prod_precios_rex AS r
    WHERE lp.id_precio_rex = r.id
      AND r.id = ANY(${uniqueIds}::text[])
  `;

  return { filasActualizadas: Number(filasActualizadas) };
}

function deduplicarFilasPorDescripcion(
  filas: FilaPdfMatrizNormalizadaDto[]
): Array<{ descripcion: string; precio: number }> {
  const porDescripcion = new Map<string, number>();
  for (const fila of filas) {
    const descripcion = normalizarDescripcionPrecioRex(fila.descripcionExport);
    if (!descripcion) continue;
    porDescripcion.set(descripcion, fila.precio);
  }
  return [...porDescripcion.entries()].map(([descripcion, precio]) => ({ descripcion, precio }));
}

/**
 * Inserta o actualiza precios REX para un proveedor.
 * Misma descripción en el lote: gana el último precio.
 */
export async function upsertPreciosRexDesdeFilasPdf(
  proveedorId: string,
  filas: FilaPdfMatrizNormalizadaDto[]
): Promise<UpsertPreciosRexResult> {
  const filasUnicas = deduplicarFilasPorDescripcion(filas);
  if (filasUnicas.length === 0) {
    return {
      creados: 0,
      actualizados: 0,
      listaPreciosSincronizadas: 0,
      errores: ["No hay filas con descripción válida para guardar."],
    };
  }

  const existentesSet = new Set<string>();
  const descripciones = filasUnicas.map((f) => f.descripcion);

  for (let i = 0; i < descripciones.length; i += CHUNK_PREFETCH) {
    const chunk = descripciones.slice(i, i + CHUNK_PREFETCH);
    const existentes = await prisma.prodPrecioRex.findMany({
      where: { idProveedor: proveedorId, descripcion: { in: chunk } },
      select: { descripcion: true },
    });
    for (const row of existentes) existentesSet.add(row.descripcion);
  }

  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];
  const idsPrecioRexActualizados: string[] = [];

  for (const fila of filasUnicas) {
    try {
      const existia = existentesSet.has(fila.descripcion);

      const rex = await prisma.prodPrecioRex.upsert({
        where: {
          idProveedor_descripcion: {
            idProveedor: proveedorId,
            descripcion: fila.descripcion,
          },
        },
        create: {
          idProveedor: proveedorId,
          descripcion: fila.descripcion,
          pxListaProveedor: fila.precio,
        },
        update: {
          pxListaProveedor: fila.precio,
        },
        select: { id: true },
      });

      if (existia) {
        actualizados++;
        idsPrecioRexActualizados.push(rex.id);
      } else {
        creados++;
        existentesSet.add(fila.descripcion);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      errores.push(`${fila.descripcion}: ${msg}`);
    }
  }

  const { filasActualizadas: listaPreciosSincronizadas } =
    idsPrecioRexActualizados.length > 0
      ? await sincronizarPxListaProveedorDesdePreciosRex(idsPrecioRexActualizados)
      : { filasActualizadas: 0 };

  return { creados, actualizados, listaPreciosSincronizadas, errores };
}

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
