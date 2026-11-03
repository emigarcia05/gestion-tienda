import { Prisma } from "@prisma/client";
import {
  calcPxListaDesdeMargenSinIvaPct,
  roundPrecioListaTienda,
} from "@/lib/calculos";
import { margenDesdePrecioDux } from "@/lib/pxListasPreciosCelda";
import {
  preciosPxListaEnterosIguales,
  roundMargenPxListaPct,
  roundPxListaEntero,
} from "@/lib/pxListasPreciosFormat";
import { prisma } from "@/lib/prisma";
import {
  resolverCostoCompraTienda,
  SELECT_COSTO_COMPRA_TIENDA,
} from "@/services/costoListaTienda.service";
import type { ServiceResult } from "@/types/service.types";

type ResultadoPrecioListaEdicion = {
  margenManual: number | null;
  pxEdicion: number | null;
  pxEfectivo: number | null;
};

async function obtenerContextoPrecioListaEdicion(
  codTienda: string,
  idLista: number
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      costoCompra: number;
      pxDux: number | null;
    }
> {
  const listaExiste = await prisma.prodPropioListaPrecioNombre.findUnique({
    where: { idLista },
    select: { idLista: true },
  });
  if (!listaExiste) {
    return { ok: false, error: "Lista de precio no encontrada." };
  }

  const producto = await prisma.prodPropio.findUnique({
    where: { codTienda },
    select: { codTienda: true, ...SELECT_COSTO_COMPRA_TIENDA },
  });
  if (!producto) {
    return { ok: false, error: "Producto tienda no encontrado." };
  }

  const dux = await prisma.prodPropioListaPrecio.findUnique({
    where: { codTienda_idLista: { codTienda, idLista } },
    select: { precio: true },
  });
  const pxDux = dux ? Number(dux.precio) : null;

  return {
    ok: true,
    costoCompra: resolverCostoCompraTienda(producto),
    pxDux,
  };
}

async function eliminarStagingPrecioLista(
  codTienda: string,
  idLista: number,
  pxDux: number | null
): Promise<ResultadoPrecioListaEdicion> {
  await prisma.prodPropioListaPrecioEdicion.deleteMany({
    where: { codTienda, idLista },
  });
  return { margenManual: null, pxEdicion: null, pxEfectivo: pxDux };
}

async function persistirStagingPrecioLista(
  codTienda: string,
  idLista: number,
  pxEntero: number
): Promise<void> {
  const precioPersistir = new Prisma.Decimal(roundPrecioListaTienda(pxEntero));
  await prisma.prodPropioListaPrecioEdicion.upsert({
    where: { codTienda_idLista: { codTienda, idLista } },
    create: {
      codTienda,
      idLista,
      precio: precioPersistir,
    },
    update: {
      precio: precioPersistir,
    },
  });
}

/**
 * Guarda el PX calculado desde el margen en `prod_lista_precios_edicion` (staging hasta Act. Px).
 * `margenManual: null` elimina la fila pendiente.
 */
export async function guardarPrecioListaEdicionDesdeMargen(
  codTienda: string,
  idLista: number,
  margenManual: number | null
): Promise<ServiceResult<ResultadoPrecioListaEdicion>> {
  const ctx = await obtenerContextoPrecioListaEdicion(codTienda, idLista);
  if (!ctx.ok) {
    return { success: false, error: ctx.error };
  }

  const { costoCompra, pxDux } = ctx;

  if (margenManual === null) {
    const data = await eliminarStagingPrecioLista(codTienda, idLista, pxDux);
    return { success: true, data };
  }

  if (!(costoCompra > 0)) {
    return {
      success: false,
      error: "Sin costo de compra no se puede calcular el precio desde el margen.",
    };
  }

  const margenRedondeado = roundMargenPxListaPct(margenManual);
  const pxCalculado = calcPxListaDesdeMargenSinIvaPct(margenRedondeado, costoCompra);
  if (pxCalculado == null || !(pxCalculado > 0)) {
    return {
      success: false,
      error: "No se pudo calcular el precio desde el margen.",
    };
  }

  const pxEntero = roundPxListaEntero(pxCalculado);
  if (preciosPxListaEnterosIguales(pxEntero, pxDux)) {
    const data = await eliminarStagingPrecioLista(codTienda, idLista, pxDux);
    return { success: true, data };
  }

  await persistirStagingPrecioLista(codTienda, idLista, pxEntero);

  return {
    success: true,
    data: {
      margenManual: margenRedondeado,
      pxEdicion: pxEntero,
      pxEfectivo: pxEntero,
    },
  };
}

/**
 * Guarda PX entero en staging desde edición directa del precio.
 * Deriva el margen % para la respuesta; `pxEdicion: null` elimina staging.
 */
export async function guardarPrecioListaEdicionDesdePx(
  codTienda: string,
  idLista: number,
  pxEdicion: number | null
): Promise<ServiceResult<ResultadoPrecioListaEdicion>> {
  const ctx = await obtenerContextoPrecioListaEdicion(codTienda, idLista);
  if (!ctx.ok) {
    return { success: false, error: ctx.error };
  }

  const { costoCompra, pxDux } = ctx;

  if (pxEdicion === null) {
    const data = await eliminarStagingPrecioLista(codTienda, idLista, pxDux);
    return { success: true, data };
  }

  const pxEntero = roundPxListaEntero(pxEdicion);
  if (!(pxEntero > 0)) {
    return { success: false, error: "Precio inválido." };
  }

  if (preciosPxListaEnterosIguales(pxEntero, pxDux)) {
    const data = await eliminarStagingPrecioLista(codTienda, idLista, pxDux);
    return { success: true, data };
  }

  const margenManual = margenDesdePrecioDux(pxEntero, costoCompra);

  await persistirStagingPrecioLista(codTienda, idLista, pxEntero);

  return {
    success: true,
    data: {
      margenManual,
      pxEdicion: pxEntero,
      pxEfectivo: pxEntero,
    },
  };
}

export type PrecioDefinitivoPublicado = {
  codTienda: string;
  idLista: number;
  precio: number;
};

/**
 * Copia `prod_lista_precios_edicion` → `prod_lista_precios` en los productos indicados
 * cuando el entero difiere (o falta la fila definitiva). Ventas lee la tabla definitiva.
 */
export async function publicarPreciosDefinitivosDesdeEdicion(
  codTiendas: readonly string[]
): Promise<PrecioDefinitivoPublicado[]> {
  const codigos = [...new Set(codTiendas.map((c) => c.trim()).filter(Boolean))];
  if (codigos.length === 0) return [];

  const filas = await prisma.$queryRaw<
    Array<{ cod_tienda: string; id_lista: number; precio: Prisma.Decimal }>
  >`
    WITH objetivo AS (
      SELECT e.cod_tienda, e.id_lista, e.precio
      FROM prod_lista_precios_edicion e
      WHERE e.cod_tienda IN (${Prisma.join(codigos)})
        AND e.precio > 0
        AND NOT EXISTS (
          SELECT 1
          FROM prod_lista_precios p
          WHERE p.cod_tienda = e.cod_tienda
            AND p.id_lista = e.id_lista
            AND round(p.precio) = round(e.precio)
        )
    ),
    actualizados AS (
      UPDATE prod_lista_precios p
      SET precio = o.precio,
          updated_at = NOW()
      FROM objetivo o
      WHERE p.cod_tienda = o.cod_tienda
        AND p.id_lista = o.id_lista
      RETURNING p.cod_tienda, p.id_lista, p.precio
    ),
    insertados AS (
      INSERT INTO prod_lista_precios (cod_tienda, id_lista, precio, updated_at)
      SELECT o.cod_tienda, o.id_lista, o.precio, NOW()
      FROM objetivo o
      WHERE NOT EXISTS (
        SELECT 1
        FROM prod_lista_precios p
        WHERE p.cod_tienda = o.cod_tienda
          AND p.id_lista = o.id_lista
      )
      RETURNING cod_tienda, id_lista, precio
    )
    SELECT cod_tienda, id_lista, precio FROM actualizados
    UNION ALL
    SELECT cod_tienda, id_lista, precio FROM insertados
  `;

  return filas.map((fila) => ({
    codTienda: fila.cod_tienda,
    idLista: fila.id_lista,
    precio: roundPxListaEntero(Number(fila.precio)),
  }));
}