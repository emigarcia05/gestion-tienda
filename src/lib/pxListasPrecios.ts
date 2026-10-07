import type { OpcionCompetenciaRefPxListas } from "@/lib/pxListasCompetenciaRef";

/** Catálogo de lista DUX para columnas dinámicas en Px Listas. */
export type ListaPrecioPxListasColumna = {
  idLista: number;
  nombreLista: string;
};

/** Precio por lista en una fila del listado Px Listas. */
export type PrecioListaPxListasCelda = {
  idLista: number;
  /** Espejo DUX (`prod_propios_listas_precios`). */
  pxDux: number | null;
  /** PX pendiente de Act. Px (`prod_propios_listas_precios_edicion`); `null` = sin edición staging. */
  pxEdicion: number | null;
  /** Margen % derivado de `pxEdicion` cuando hay staging; si no, `null`. */
  margenManual: number | null;
  /** Margen % derivado del precio DUX. */
  margenDux: number | null;
  /** PX mostrado: calculado desde margen manual si existe; si no, precio DUX. */
  pxEfectivo: number | null;
  /** Margen % mostrado: manual si existe; si no, margen DUX. */
  margenPct: number | null;
  /** `true` si hay PX en staging (`prod_propios_listas_precios_edicion`) pendiente de Act. Px. */
  requiereActualizar: boolean;
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
