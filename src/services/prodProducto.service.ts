import type { Prisma } from "@prisma/client";
import { nombreDeProducto, normalizarCodFliaItem, textoCodFliaItem } from "@/lib/prodProducto";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

const selectSku = {
  codTienda: true,
  descripcionTienda: true,
  idMarca: true,
  idProducto: true,
  productoManual: true,
  terminacion: true,
  presentacion: { select: { texto: true } },
  color: { select: { nombre: true } },
} as const;

type SkuProducto = Prisma.ProdPropioGetPayload<{ select: typeof selectSku }>;

export type ProductoDelSku = {
  nombre: string | null;
  manual: boolean;
};

export type SkuMismoProducto = {
  codTienda: string;
  descripcion: string;
};

async function leerSku(
  tx: Prisma.TransactionClient,
  codTienda: string
): Promise<SkuProducto | null> {
  return tx.prodPropio.findUnique({ where: { codTienda }, select: selectSku });
}

async function borrarSiQuedaVacio(tx: Prisma.TransactionClient, idProducto: string): Promise<void> {
  const quedan = await tx.prodPropio.count({ where: { idProducto } });
  if (quedan === 0) await tx.prodProducto.delete({ where: { id: idProducto } });
}

async function quedarEn(
  tx: Prisma.TransactionClient,
  sku: SkuProducto,
  idProducto: string,
  manual: boolean
): Promise<void> {
  const anterior = sku.idProducto;
  await tx.prodPropio.update({
    where: { codTienda: sku.codTienda },
    data: { idProducto, productoManual: manual },
  });
  if (anterior && anterior !== idProducto) await borrarSiQuedaVacio(tx, anterior);
}

async function asegurarPorNombre(
  tx: Prisma.TransactionClient,
  sku: SkuProducto
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!sku.idMarca) return { ok: false, error: "El ítem no tiene marca." };
  const descripcion = (sku.descripcionTienda ?? "").trim();
  if (descripcion.length === 0) return { ok: false, error: "El ítem no tiene descripción." };
  const nombre = nombreDeProducto({
    descripcion,
    presentacion: sku.presentacion?.texto ?? null,
    color: sku.color?.nombre ?? null,
    terminacion: sku.terminacion,
  });
  const producto = await tx.prodProducto.upsert({
    where: { idMarca_nombre: { idMarca: sku.idMarca, nombre } },
    create: { idMarca: sku.idMarca, nombre },
    update: {},
    select: { id: true },
  });
  await quedarEn(tx, sku, producto.id, false);
  return { ok: true, id: producto.id };
}

/**
 * Deja el SKU en su producto. Sin elección, el nombre sale de la descripción
 * sin presentación, color ni terminación. `codMismoProducto` lo une a ese ítem
 * y no se vuelve a calcular. `soltar` vuelve al cálculo.
 */
export async function asignarProductoDeSku(
  tx: Prisma.TransactionClient,
  codTienda: string,
  pedido: { codMismoProducto: string | null; soltar: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sku = await leerSku(tx, codTienda);
  if (!sku) return { ok: false, error: "El producto ya no existe." };

  if (pedido.codMismoProducto) {
    if (pedido.codMismoProducto === codTienda) return { ok: false, error: "Elegí otro ítem." };
    const referencia = await leerSku(tx, pedido.codMismoProducto);
    if (!referencia) return { ok: false, error: "El ítem elegido ya no existe." };
    if (!referencia.idMarca || referencia.idMarca !== sku.idMarca) {
      return { ok: false, error: "Elegí un ítem de la misma marca." };
    }
    let idProducto = referencia.idProducto;
    if (!idProducto) {
      const creado = await asegurarPorNombre(tx, referencia);
      if (!creado.ok) return creado;
      idProducto = creado.id;
    }
    await quedarEn(tx, sku, idProducto, true);
    return { ok: true };
  }

  const marcaDelProducto = sku.idProducto
    ? (await tx.prodProducto.findUnique({ where: { id: sku.idProducto }, select: { idMarca: true } }))
        ?.idMarca ?? null
    : null;
  const cambioDeMarca = marcaDelProducto != null && marcaDelProducto !== sku.idMarca;
  if (!pedido.soltar && sku.productoManual && sku.idProducto && !cambioDeMarca) {
    return { ok: true };
  }

  const creado = await asegurarPorNombre(tx, sku);
  if (!creado.ok) return creado;
  return { ok: true };
}

export async function borrarProductoSiQuedaVacio(
  tx: Prisma.TransactionClient,
  idProducto: string | null
): Promise<void> {
  if (idProducto) await borrarSiQuedaVacio(tx, idProducto);
}

export async function leerProductoDelSku(
  codTienda: string
): Promise<ServiceResult<ProductoDelSku>> {
  try {
    const fila = await prisma.prodPropio.findUnique({
      where: { codTienda },
      select: { productoManual: true, producto: { select: { nombre: true } } },
    });
    if (!fila) return { success: false, error: "El producto ya no existe." };
    return {
      success: true,
      data: { nombre: fila.producto?.nombre ?? null, manual: fila.productoManual },
    };
  } catch (error: unknown) {
    console.error("[prodProducto] leer:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo leer el producto." };
  }
}

/** Ítems habilitados de la misma marca, para unirlos al producto de este SKU. */
export async function buscarSkusMismoProducto(input: {
  idMarca: string;
  q: string;
  excluirCodTienda: string;
}): Promise<ServiceResult<SkuMismoProducto[]>> {
  const tokens = input.q
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return { success: true, data: [] };

  try {
    const filas = await prisma.prodPropio.findMany({
      where: {
        habilitado: true,
        idMarca: input.idMarca,
        codTienda: { not: input.excluirCodTienda },
        AND: tokens.map((token) => ({
          descripcionTienda: { contains: token, mode: "insensitive" as const },
        })),
      },
      select: { codTienda: true, descripcionTienda: true },
      orderBy: { descripcionTienda: "asc" },
      take: 15,
    });
    return {
      success: true,
      data: filas
        .map((fila) => ({
          codTienda: fila.codTienda,
          descripcion: (fila.descripcionTienda ?? "").trim(),
        }))
        .filter((fila) => fila.descripcion.length > 0),
    };
  } catch (error: unknown) {
    console.error("[prodProducto] buscar:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo buscar el ítem." };
  }
}

/** Siguiente familia: el mayor `cod_flia_item` numérico + 1, con tres dígitos. */
export async function siguienteCodFliaItem(): Promise<ServiceResult<{ codigo: string }>> {
  try {
    const filas = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT COALESCE(MAX(CAST(cod_flia_item AS INTEGER)), 0) AS max
      FROM prod_lista
      WHERE cod_flia_item ~ '^[0-9]+$'
    `;
    const max = Number(filas[0]?.max ?? 0);
    const siguiente = Number.isFinite(max) && max >= 0 ? max + 1 : 1;
    return { success: true, data: { codigo: textoCodFliaItem(siguiente) } };
  } catch (error: unknown) {
    console.error("[prodProducto] siguiente flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo calcular el código de familia." };
  }
}

/** Descripciones de los ítems que ya tienen ese código de familia. */
export async function listarDescripcionesFliaItem(
  codigo: string
): Promise<ServiceResult<{ descripciones: string[] }>> {
  const normal = normalizarCodFliaItem(codigo);
  if (!normal.ok || normal.codigo == null) return { success: true, data: { descripciones: [] } };
  try {
    const filas = await prisma.prodPropio.findMany({
      where: { codFliaItem: normal.codigo },
      select: { descripcionTienda: true },
      orderBy: { descripcionTienda: "asc" },
      take: 50,
    });
    return {
      success: true,
      data: {
        descripciones: filas
          .map((fila) => (fila.descripcionTienda ?? "").trim())
          .filter((descripcion) => descripcion.length > 0),
      },
    };
  } catch (error: unknown) {
    console.error("[prodProducto] flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudieron leer los ítems de la familia." };
  }
}
