/**
 * Importar Lista PDF (matriz descripción × presentación) → `proveedores_prod_lista.px_lista_proveedor`.
 * Tipos compartidos entre servicio, actions y UI.
 */

/** Cómo se emparejó un ítem del PDF con la lista del proveedor. */
export type EstadoMatchItemPdf =
  /** Ya vinculado (`proveedores_prod_lista.id_precio_rex` → ítem PDF con esa clave). */
  | "VINCULADO"
  /** Sin vínculo previo; la descripción de la lista coincide con descripción + presentación. */
  | "SUGERIDO"
  | "SIN_VINCULO";

export interface ItemListaMatchPdf {
  codExt: string;
  codProdProveedor: string;
  descripcionProveedor: string;
  pxActual: number;
}

export interface FilaPreviewImportPdf {
  /** Clave del ítem individualizado (`descripcionExport` normalizada; unique en `prod_precios_rex`). */
  clave: string;
  descripcionBase: string;
  presentacion: string;
  precio: number;
  estado: EstadoMatchItemPdf;
  items: ItemListaMatchPdf[];
}

export interface PreviewImportListaPdf {
  filas: FilaPreviewImportPdf[];
  /** Ítems de la lista del proveedor que no recibieron precio de este PDF (se vinculan a mano en la vista previa). */
  listaSinPrecio: ItemListaMatchPdf[];
}

export interface ResultadoImportListaPdf {
  itemsActualizados: number;
  vinculosNuevos: number;
  catalogoCreados: number;
  catalogoActualizados: number;
}