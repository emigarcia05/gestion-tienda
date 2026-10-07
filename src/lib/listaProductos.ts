/** Fila de **Lista Productos** (`prod_tienda`). */
export type ListaProductoFila = {
  codTienda: string;
  descripcion: string;
  rubro: string;
  subRubro: string;
  marca: string;
  bulto: number | null;
  esProductoPropio: boolean;
};

/** `prod_marcas` en **Gestionar Marcas**; `productos` = filas `prod_tienda` vinculadas. */
export type MarcaCatalogoItem = {
  id: string;
  nombre: string;
  formatoCodTintometrico: string | null;
  productos: number;
};

/** `prod_rubros_lista` en **Gestionar Rubros**; `productos` = filas `prod_tienda` con ese texto. */
export type RubroCatalogoItem = {
  id: string;
  nombre: string;
  productos: number;
};
