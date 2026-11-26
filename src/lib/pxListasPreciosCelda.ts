import {
  calcMargenSinIvaPct,
  calcPxListaDesdeMargenSinIvaPct,
} from "@/lib/calculos";
import {
  margenesPorcUtilidadDifieren,
  preciosPxListaEnterosIguales,
  roundMargenPxListaPct,
  roundPxListaEntero,
} from "@/lib/pxListasPreciosFormat";
import type {
  ItemPxListasPreciosTabla,
  PrecioListaPxListasCelda,
} from "@/lib/pxListasPrecios";
import type { CambioPxListas } from "@/lib/validations/pxListasPrecios";

export function margenDesdePrecioDux(
  pxDux: number | null,
  costoCompra: number
): number | null {
  if (pxDux == null || !(pxDux > 0) || !(costoCompra > 0)) return null;
  const margen = calcMargenSinIvaPct(pxDux, costoCompra);
  return margen == null ? null : roundMargenPxListaPct(margen);
}

/**
 * PX vigente. Si hay PORC. UTILIDAD y costo, el importe sale de esa cuenta.
 * Sin porcentaje, queda el importe guardado.
 */
export function pxVentaVigente(
  porcUtilidad: number | null,
  precioGuardado: number | null,
  costoCompra: number
): number | null {
  if (porcUtilidad != null && costoCompra > 0) {
    const px = calcPxListaDesdeMargenSinIvaPct(porcUtilidad, costoCompra);
    if (px != null && px > 0) return px;
  }
  if (precioGuardado != null && precioGuardado > 0) return roundPxListaEntero(precioGuardado);
  return null;
}

export function armarCeldaPrecioPxListas(params: {
  idLista: number;
  costoCompra: number;
  pxDux: number | null;
  pxEdicion: number | null;
  /**
   * Porcentaje publicado. Si no viene, la celda se arma desde los importes
   * (cambio todavía no guardado en pantalla).
   */
  porcDefinitivo?: number | null;
  porcEdicion?: number | null;
  hayStaging?: boolean;
}): PrecioListaPxListasCelda {
  const { idLista, costoCompra, pxDux, pxEdicion } = params;
  if (params.porcDefinitivo === undefined && params.hayStaging === undefined) {
    return armarCeldaDesdeImportes(idLista, costoCompra, pxDux, pxEdicion);
  }

  const porcPub = params.porcDefinitivo ?? null;
  const staging = params.hayStaging === true;
  const porcTrabajo = staging ? (params.porcEdicion ?? null) : porcPub;
  const pxPublicado = pxVentaVigente(porcPub, pxDux, costoCompra);
  const pxTrabajo = staging
    ? pxVentaVigente(porcTrabajo, pxEdicion, costoCompra)
    : pxPublicado;
  const margenPub =
    porcPub ?? margenDesdePrecioDux(pxPublicado, costoCompra);
  const margenTrabajo = staging
    ? (porcTrabajo ?? margenDesdePrecioDux(pxTrabajo, costoCompra))
    : margenPub;
  const pendiente = staging && porcPendiente(porcTrabajo, porcPub, pxTrabajo, pxPublicado);

  return {
    idLista,
    pxDux: pxPublicado,
    pxEdicion: pendiente ? pxTrabajo : null,
    margenManual: pendiente ? margenTrabajo : null,
    margenDux: margenPub,
    pxEfectivo: pxTrabajo,
    margenPct: margenTrabajo,
  };
}

function porcPendiente(
  porcTrabajo: number | null,
  porcPub: number | null,
  pxTrabajo: number | null,
  pxPublicado: number | null
): boolean {
  if (porcTrabajo != null) {
    return porcPub == null || margenesPorcUtilidadDifieren(porcTrabajo, porcPub);
  }
  return !preciosPxListaEnterosIguales(pxTrabajo, pxPublicado);
}

function armarCeldaDesdeImportes(
  idLista: number,
  costoCompra: number,
  pxDux: number | null,
  pxEdicion: number | null
): PrecioListaPxListasCelda {
  const margenDux = margenDesdePrecioDux(pxDux, costoCompra);
  const tieneEdicion = pxEdicion != null && pxEdicion > 0;

  let pxEfectivo: number | null;
  let margenManual: number | null;
  let margenPct: number | null;

  if (tieneEdicion) {
    pxEfectivo = pxEdicion;
    margenManual = margenDesdePrecioDux(pxEdicion, costoCompra);
    margenPct = margenManual != null ? roundMargenPxListaPct(margenManual) : null;
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

/**
 * El precio que se ve en la grilla no es el definitivo de Ventas (`prod_lista_precios`).
 * `pxEfectivo` es edición o un cambio todavía no guardado; `pxDux` es el definitivo.
 */
export function precioListaMostradoDifiereDefinitivo(
  celda: Pick<PrecioListaPxListasCelda, "pxEfectivo" | "pxDux">
): boolean {
  const mostrado = celda.pxEfectivo;
  if (mostrado == null || !(mostrado > 0)) return false;
  if (celda.pxDux == null || !(celda.pxDux > 0)) return true;
  return !preciosPxListaEnterosIguales(mostrado, celda.pxDux);
}

/** Celda de la grilla con el cambio o la referencia pendiente, sin el borrador de tipeo. */
export function celdaPxListasEnPantalla(
  item: Pick<
    ItemPxListasPreciosTabla,
    "codTienda" | "costoCompra" | "opcionesCompetenciaRef"
  >,
  celda: PrecioListaPxListasCelda,
  cambios: ReadonlyMap<string, CambioPxListas>,
  refPendiente: string | null | undefined,
  idListaGeneral: number | null
): PrecioListaPxListasCelda {
  const cambio = cambios.get(claveCambioPxListas(item.codTienda, celda.idLista));
  if (cambio) return celdaConCambioPxListas(celda, item.costoCompra, cambio);
  if (refPendiente && idListaGeneral != null && celda.idLista === idListaGeneral) {
    const op = item.opcionesCompetenciaRef.find(
      (o) => o.competenciaId === refPendiente
    );
    if (op && op.px > 0) {
      return armarCeldaPrecioPxListas({
        idLista: celda.idLista,
        costoCompra: item.costoCompra,
        pxDux: celda.pxDux,
        pxEdicion: op.px,
      });
    }
  }
  return celda;
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
