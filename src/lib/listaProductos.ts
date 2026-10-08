/** `prod_marcas` en **Gestionar Marcas**; `productos` = filas `prod_propios` vinculadas. */
export type MarcaCatalogoItem = {
  id: string;
  nombre: string;
  formatoCodTintometrico: string | null;
  productos: number;
};

/** `prod_sub_rubros` de un rubro; `productos` = filas `prod_propios` con ese `id_sub_rubro`. */
export type SubRubroCatalogoItem = {
  id: string;
  nombre: string;
  productos: number;
};

/** `prod_rubros` en **Gestionar Rubros**; `productos` = filas `prod_propios` con ese `id_rubro`. */
export type RubroCatalogoItem = {
  id: string;
  nombre: string;
  productos: number;
  subRubros: SubRubroCatalogoItem[];
};

/** Opción de un Select de **Agregar Item** (presentación = `texto`, color = `nombre`). */
export type OpcionCatalogoItem = {
  id: string;
  nombre: string;
};
