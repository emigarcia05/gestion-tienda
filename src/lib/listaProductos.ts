/** `prod_marcas` en **Gestionar Marcas**; `productos` = filas `prod_propios` vinculadas. */
export type MarcaCatalogoItem = {
  id: string;
  nombre: string;
  formatoCodTintometrico: string | null;
  productos: number;
};

/** `prod_rubros_lista` en **Gestionar Rubros**; `productos` = filas `prod_propios` con ese texto. */
export type RubroCatalogoItem = {
  id: string;
  nombre: string;
  productos: number;
};

/** Opción de un Select de **Agregar Item** (presentación = `texto`, color = `nombre`). */
export type OpcionCatalogoItem = {
  id: string;
  nombre: string;
};
