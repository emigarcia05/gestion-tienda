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
import type { ServiceResult } from "@/types/service.types";

export type ClavePrecioListaEdicion = {
  codTienda: string;
  idLista: number;
};

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
  const listaExiste = await prisma.prodTiendaListaPrecio.findUnique({
    where: { idLista },
    select: { idLista: true },
  });
  if (!listaExiste) {
    return { ok: false, error: "Lista de precio no encontrada." };
  }

  const producto = await prisma.prodTienda.findUnique({
    where: { codTienda },
    select: { codTienda: true, costoCompra: true },
  });
  if (!producto) {
    return { ok: false, error: "Producto tienda no encontrado." };
  }

  const dux = await prisma.prodTiendaPrecio.findUnique({
    where: { codTienda_idLista: { codTienda, idLista } },
    select: { precio: true },
  });
  const pxDux = dux ? Number(dux.precio) : null;

  return {
    ok: true,
    costoCompra: Number(producto.costoCompra),
    pxDux,
  };
}

async function eliminarStagingPrecioLista(
  codTienda: string,
  idLista: number,
  pxDux: number | null
): Promise<ResultadoPrecioListaEdicion> {
  await prisma.prodTiendaPrecioEdicion.deleteMany({
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
  await prisma.prodTiendaPrecioEdicion.upsert({
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
 * Guarda el PX calculado desde el margen en `prod_tienda_precios_edicion` (staging hasta Act. Px).
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

/** Elimina filas exportadas en Act. Px (cierra la actualización pendiente). */
export async function limpiarPreciosEdicionTrasActPx(
  claves: ClavePrecioListaEdicion[]
): Promise<void> {
  if (claves.length === 0) return;

  await prisma.prodTiendaPrecioEdicion.deleteMany({
    where: {
      OR: claves.map((c) => ({
        codTienda: c.codTienda,
        idLista: c.idLista,
      })),
    },
  });
}
