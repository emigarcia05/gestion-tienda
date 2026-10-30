import {
  calcMargenSinIvaPct,
  calcPxListaDesdeMargenSinIvaPct,
} from "@/lib/calculos";
import {
  roundMargenPxListaPct,
  roundPxListaEntero,
} from "@/lib/pxListasPreciosFormat";
import type { PrecioListaPxListasCelda } from "@/lib/pxListasPrecios";
import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";

export function margenDesdePrecioDux(
  pxDux: number | null,
  costoCompra: number
): number | null {
  if (pxDux == null || !(pxDux > 0) || !(costoCompra > 0)) return null;
  const margen = calcMargenSinIvaPct(pxDux, costoCompra);
  return margen == null ? null : roundMargenPxListaPct(margen);
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

  return {
    idLista,
    pxDux,
    pxEdicion: tieneEdicion ? pxEdicion : null,
    margenManual,
    margenDux,
    pxEfectivo,
    margenPct,
  };
}

/** Clave de un cambio pendiente de Px Listas (producto × lista). */
export function claveCambioPxListas(codTienda: string, idLista: number): string {
  return `${codTienda}|${idLista}`;
}

/** Celda tal como se ve con un cambio pendiente (aún no guardado) aplicado sobre la de la BD. */
export function celdaConCambioPxListas(
  celda: PrecioListaPxListasCelda,
  costoCompra: number,
  cambio: CambioPxListas
): PrecioListaPxListasCelda {
  const base = { idLista: celda.idLista, costoCompra, pxDux: celda.pxDux };
  if (cambio.tipo === "px") {
    return armarCeldaPrecioPxListas({ ...base, pxEdicion: cambio.pxEdicion });
  }
  if (cambio.margenManual == null) {
    return armarCeldaPrecioPxListas({ ...base, pxEdicion: null });
  }
  const margen = roundMargenPxListaPct(cambio.margenManual);
  const px = calcPxListaDesdeMargenSinIvaPct(margen, costoCompra);
  if (px == null || !(px > 0)) return celda;
  return {
    ...armarCeldaPrecioPxListas({ ...base, pxEdicion: roundPxListaEntero(px) }),
    margenPct: margen,
  };
}

export function filtrarItemPorActualizar(
  item: { preciosPorLista: PrecioListaPxListasCelda[] },
  filtro: "si" | "no"
): boolean {
  const tienePendiente = item.preciosPorLista.some((c) => c.pxEdicion != null);
  return filtro === "si" ? tienePendiente : !tienePendiente;
}
