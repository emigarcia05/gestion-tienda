import {
  calcMargenSinIvaPct,
} from "@/lib/calculos";
import {
  roundMargenPxListaPct,
} from "@/lib/pxListasPreciosFormat";
import type { PrecioListaPxListasCelda } from "@/lib/pxListasPrecios";

export function margenDesdePrecioDux(
  pxDux: number | null,
  costoCompra: number
): number | null {
  if (pxDux == null || !(pxDux > 0) || !(costoCompra > 0)) return null;
  const margen = calcMargenSinIvaPct(pxDux, costoCompra);
  return margen == null ? null : roundMargenPxListaPct(margen);
}

/** Pendiente de Act. Px mientras exista fila en `prod_propios_listas_precios_edicion`. */
export function celdaRequiereActualizar(celda: PrecioListaPxListasCelda): boolean {
  return celda.pxEdicion != null;
}

export function armarCeldaPrecioPxListas(params: {
  idLista: number;
  costoCompra: number;
  pxDux: number | null;
  pxEdicion: number | null;
}): PrecioListaPxListasCelda {
  const { idLista, costoCompra, pxDux, pxEdicion } = params;
  const margenDux = margenDesdePrecioDux(pxDux, costoCompra);
  const tieneEdicion = pxEdicion != null && pxEdicion > 0;

  let pxEfectivo: number | null;
  let margenManual: number | null;
  let margenPct: number | null;

  if (tieneEdicion) {
    pxEfectivo = pxEdicion;
    margenManual = margenDesdePrecioDux(pxEdicion, costoCompra);
    margenPct =
      margenManual != null ? roundMargenPxListaPct(margenManual) : null;
  } else {
    pxEfectivo = pxDux;
    margenManual = null;
    margenPct = margenDux;
  }

  const celda: PrecioListaPxListasCelda = {
    idLista,
    pxDux,
    pxEdicion: tieneEdicion ? pxEdicion : null,
    margenManual,
    margenDux,
    pxEfectivo,
    margenPct,
    requiereActualizar: false,
  };

  return {
    ...celda,
    requiereActualizar: celdaRequiereActualizar(celda),
  };
}

export function filtrarItemPorActualizar(
  item: { preciosPorLista: PrecioListaPxListasCelda[] },
  filtro: "si" | "no"
): boolean {
  const tienePendiente = item.preciosPorLista.some((c) => c.pxEdicion != null);
  return filtro === "si" ? tienePendiente : !tienePendiente;
}
