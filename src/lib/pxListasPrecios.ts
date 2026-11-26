import type { OpcionCompetenciaRefPxListas } from "@/lib/pxListasCompetenciaRef";

/** Catálogo de lista DUX para columnas dinámicas en Px Listas. */
export type ListaPrecioPxListasColumna = {
  idLista: number;
  nombreLista: string;
};

/** Precio por lista en una fila del listado Px Listas. */
export type PrecioListaPxListasCelda = {
  idLista: number;
  /** PX publicado recalculado con el costo vigente. */
  pxDux: number | null;
  /** PX de una edición todavía no publicada; `null` = sin pendiente. */
  pxEdicion: number | null;
  /** PORC. UTILIDAD pendiente; `null` = sin pendiente. */
  margenManual: number | null;
  /** PORC. UTILIDAD publicado. */
  margenDux: number | null;
  /** PX mostrado: el pendiente si hay, si no el publicado. */
  pxEfectivo: number | null;
  /** PORC. UTILIDAD mostrado. */
  margenPct: number | null;
};

export type ItemPxListasPreciosTabla = {
  codTienda: string;
  descripcion: string;
  costoCompra: number;
  preciosPorLista: PrecioListaPxListasCelda[];
  /** Competidor de referencia para **1 - GENERAL** (`null` = "-"). */
  competenciaIdPxListaGeneral: string | null;
  /** Opciones con precio de referencia (sugerido o scraping) para este producto. */
  opcionesCompetenciaRef: OpcionCompetenciaRefPxListas[];
};
