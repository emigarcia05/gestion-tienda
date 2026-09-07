/** Clamp de porcentaje 0–100 con hasta 2 decimales (para dto_*, cx_transporte). */
export function clampPercent(value: number): number {
  const capped = Math.max(0, Math.min(100, value));
  return Math.round(capped * 100) / 100;
}

/** Base en pesos desde lista proveedor (aplica cotización si `pxDolares`). */
export function listaPrecioBasePesos(
  pxListaProveedor: number,
  pxDolares: boolean,
  cotizacionDolar: number
): number {
  const cotizacion = pxDolares && cotizacionDolar > 0 ? cotizacionDolar : 1;
  return pxListaProveedor * cotizacion;
}

/**
 * Precio de compra **sin IVA** (misma lógica que la columna generada `prod_precios_provee.px_compra_final_sin_iva`).
 * Todos los dto y cx_transporte son porcentajes.
 * Fórmula con descuento acumulado:
 *   precioLista × (1 - dtoTotal/100) × (1 + cxTransporte/100)
 * donde dtoTotal = dtoProveedor + dtoMarca + dtoRubro + dtoCantidad + dtoFinanciero + descEspecial (+ dtoExtraComparacion si aplica; capado 0-100).
 *
 * Si `pxPromoFijo` > 0: **no** se aplican descuentos ni dto extra; Px Final =
 *   pxPromoFijo (moneda del ítem) × (cotización si `pxDolares`) × (1 + cxTransporte/100).
 * Parámetros opcionales default 0/`null` para compatibilidad.
 */
export function calcPxCompraFinal(
  precioLista: number,
  dtoRubro: number,
  dtoCantidad: number,
  cxTransporte: number,
  dtoProveedor: number = 0,
  dtoMarca: number = 0,
  dtoFinanciero: number = 0,
  dtoExtraComparacion: number = 0,
  descEspecial: number = 0,
  pxPromoFijo: number | null = null,
  cotizacionDolar: number = 1,
  pxDolares: boolean = false
): number {
  if (pxPromoFijo != null && pxPromoFijo > 0) {
    const basePromo = listaPrecioBasePesos(pxPromoFijo, pxDolares, cotizacionDolar);
    return basePromo * (1 + cxTransporte / 100);
  }

  const dtoTotal = clampPercent(
    dtoProveedor +
      dtoMarca +
      dtoRubro +
      dtoCantidad +
      dtoFinanciero +
      dtoExtraComparacion +
      descEspecial
  );

  return (
    precioLista *
    (1 - dtoTotal / 100) *
    (1 + cxTransporte / 100)
  );
}

/** Inputs de `prod_precios_provee` para recalcular costo en Comp. Categorias. */
export type DatosCostoComparacion = {
  pxListaProveedor: number;
  pxDolares: boolean;
  cotizacionDolar: number;
  dtoProveedor: number;
  dtoMarca: number;
  dtoRubro: number;
  dtoCantidad: number;
  dtoFinanciero: number;
  cxTransporte: number;
  descEspecial: number;
  /** Moneda del ítem; si > 0, Px Final ignora descuentos y dto extra (sí aplica Cx. Transporte). */
  pxPromoFijo: number | null;
};

/**
 * Costo sin IVA en **Comparacion por categorías**: misma fórmula que `px_compra_final_sin_iva`
 * más `dto_extra_comparacion` (persistido en `prod_comp_item_comparados`, no en `prod_precios_provee`).
 * Con Px Promo Fijo el dto extra **no** se aplica.
 */
export function calcCostoComparacion(
  datos: DatosCostoComparacion,
  dtoExtraComparacion: number | null | undefined
): number | null {
  const hayPromo = datos.pxPromoFijo != null && datos.pxPromoFijo > 0;
  if (!hayPromo && !(datos.pxListaProveedor > 0)) return null;
  const base = listaPrecioBasePesos(
    datos.pxListaProveedor,
    datos.pxDolares,
    datos.cotizacionDolar
  );
  const dtoExtra =
    datos.pxPromoFijo != null && datos.pxPromoFijo > 0 ? 0 : (dtoExtraComparacion ?? 0);
  const px = calcPxCompraFinal(
    base,
    datos.dtoRubro,
    datos.dtoCantidad,
    datos.cxTransporte,
    datos.dtoProveedor,
    datos.dtoMarca,
    datos.dtoFinanciero,
    dtoExtra,
    datos.descEspecial,
    datos.pxPromoFijo,
    datos.cotizacionDolar,
    datos.pxDolares
  );
  if (!Number.isFinite(px) || px <= 0) return null;
  return roundPrecioListaTienda(px);
}

/**
 * Marcación / margen sobre costo **sin IVA** (lista tienda neto vs costo de compra).
 * Fórmula: ((px_lista_tienda / (1 + IVA%)) / costo_compra - 1) × 100.
 * `porcIva` en puntos porcentuales (ej. 21 → divisor 1,21).
 */
export function calcMargenSinIvaPct(
  pxListaTienda: number,
  costoCompra: number,
  porcIva: number = 21
): number | null {
  if (!(costoCompra > 0) || !(pxListaTienda > 0)) return null;
  if (!Number.isFinite(pxListaTienda) || !Number.isFinite(costoCompra)) return null;
  const factorIva = 1 + porcIva / 100;
  if (!(factorIva > 0)) return null;
  const neto = pxListaTienda / factorIva;
  return ((neto / costoCompra) - 1) * 100;
}

/** Divisor IVA 21 % para px de venta en Comp. Categorias — MARGEN (SEGÚN PX REFERENCIA). */
const IVA_PX_VENTA_REFERENCIA_DIVISOR = 1.21;

/**
 * Comp. Categorias — **MARGEN (SEGÚN PX REFERENCIA)**:
 * `(((pxVtaReferencia / 1.21) / costo) − 1) × 100`
 * - `pxVtaReferencia`: px de venta del producto referido (competencia).
 * - `costo`: `px_compra_final_sin_iva` de la fila analizada.
 */
export function calcMargenSegunPxReferencia(
  pxVtaReferencia: number | null | undefined,
  costoCompraSinIva: number | null | undefined
): number | null {
  if (pxVtaReferencia == null || costoCompraSinIva == null) return null;
  if (!(pxVtaReferencia > 0) || !(costoCompraSinIva > 0)) return null;
  if (!Number.isFinite(pxVtaReferencia) || !Number.isFinite(costoCompraSinIva)) return null;
  return ((pxVtaReferencia / IVA_PX_VENTA_REFERENCIA_DIVISOR / costoCompraSinIva) - 1) * 100;
}

/** Dif. % entera: px manual vs px de venta de referencia — `round((manual − ref) / ref × 100)`. */
export function calcDifPctPxManualVsReferencia(
  pxManual: number | null | undefined,
  pxVtaReferencia: number | null | undefined
): number | null {
  if (pxManual == null || pxVtaReferencia == null) return null;
  if (!(pxManual > 0) || !(pxVtaReferencia > 0)) return null;
  if (!Number.isFinite(pxManual) || !Number.isFinite(pxVtaReferencia)) return null;
  return Math.round(((pxManual - pxVtaReferencia) / pxVtaReferencia) * 100);
}

/** Px. venta manual entero desde dif. % vs referencia. */
export function calcPxManualDesdeDifPctReferencia(
  difPct: number | null | undefined,
  pxVtaReferencia: number | null | undefined
): number | null {
  if (difPct == null || pxVtaReferencia == null) return null;
  if (!(pxVtaReferencia > 0)) return null;
  if (!Number.isFinite(difPct) || !Number.isFinite(pxVtaReferencia)) return null;
  const px = pxVtaReferencia * (1 + difPct / 100);
  if (!Number.isFinite(px) || px <= 0) return null;
  return Math.round(px);
}

/** Margen manual % desde dif. % vs px referencia y costo sin IVA. */
export function calcMargenManualDesdeDifPctReferencia(
  difPct: number | null | undefined,
  pxVtaReferencia: number | null | undefined,
  costoCompraSinIva: number | null | undefined
): number | null {
  const pxManual = calcPxManualDesdeDifPctReferencia(difPct, pxVtaReferencia);
  return calcMargenSegunPxReferencia(pxManual, costoCompraSinIva);
}

/** Dif. % vs referencia desde margen manual persistido y costo. */
export function calcDifPxRefManualDesdeMargen(
  margenManual: number | null | undefined,
  costoCompraSinIva: number | null | undefined,
  pxVtaReferencia: number | null | undefined
): number | null {
  if (margenManual == null || costoCompraSinIva == null) return null;
  const pxManual = calcPxListaDesdeMargenSinIvaPct(margenManual, costoCompraSinIva);
  return calcDifPctPxManualVsReferencia(pxManual, pxVtaReferencia);
}

/** Inverso de `calcMargenSinIvaPct`: PX lista con IVA desde margen % sobre costo sin IVA. */
export function calcPxListaDesdeMargenSinIvaPct(
  margenPct: number,
  costoCompra: number,
  porcIva: number = 21
): number | null {
  if (!(costoCompra > 0) || !Number.isFinite(margenPct) || !Number.isFinite(costoCompra)) {
    return null;
  }
  const factorIva = 1 + porcIva / 100;
  if (!(factorIva > 0)) return null;
  const neto = costoCompra * (1 + margenPct / 100);
  const px = neto * factorIva;
  if (!Number.isFinite(px) || px <= 0) return null;
  return Math.round(px);
}

/** Redondeo estándar de precio lista tienda (4 decimales, alineado a Prisma DECIMAL(14,4)). */
export function roundPrecioListaTienda(value: number): number {
  return Math.round(value * 10000) / 10000;
}
