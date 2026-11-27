/** Mínimo de caracteres de búsqueda para listar (mismo criterio que Lista Precios / Px Sugeridos). */
export const MIN_CARACTERES_BUSQUEDA_PX_LISTAS = 3;

export const MENSAJE_SIN_FILTRO_PX_LISTAS =
  "Aplicá un filtro (Marca, Rubro, Sub-Rubro, Categoría M.C o Px. Vinculado) o escribí al menos 3 caracteres en la búsqueda para ver productos.";

export type FiltrosListadoPxListas = {
  q: string;
  rubro: string;
  marca: string;
  subRubro: string;
  /** Id de `fin_ana_mc_cat`. Vacío = sin filtro de categoría. */
  catMc: string;
  pxVinculado: string;
};

/** Sin filtro desplegable ni búsqueda ≥ 3 caracteres no se consulta `prod_lista`. */
export function hayFiltroActivoPxListas(
  params: FiltrosListadoPxListas
): boolean {
  if (params.marca.trim()) return true;
  if (params.rubro.trim()) return true;
  if (params.subRubro.trim()) return true;
  if (params.catMc.trim()) return true;
  if (params.pxVinculado.trim()) return true;
  return params.q.trim().length >= MIN_CARACTERES_BUSQUEDA_PX_LISTAS;
}
