/** Query `actualizar`: ítems con PX pendiente en `prod_tienda_precios_edicion` (hasta Act. Px). */
export const FILTRO_ACTUALIZAR_SI = "si" as const;
export const FILTRO_ACTUALIZAR_NO = "no" as const;

export type FiltroActualizarPxListas =
  | typeof FILTRO_ACTUALIZAR_SI
  | typeof FILTRO_ACTUALIZAR_NO;

const FILTROS_ACTUALIZAR = new Set<string>([
  FILTRO_ACTUALIZAR_SI,
  FILTRO_ACTUALIZAR_NO,
]);

export function esFiltroActualizarPxListas(
  value: string
): value is FiltroActualizarPxListas {
  return FILTROS_ACTUALIZAR.has(value);
}

/** Mínimo de caracteres de búsqueda para listar (mismo criterio que Lista Precios / Px Sugeridos). */
export const MIN_CARACTERES_BUSQUEDA_PX_LISTAS = 3;

export const MENSAJE_SIN_FILTRO_PX_LISTAS =
  "Aplicá un filtro (Marca, Rubro, Sub-Rubro, Px. Vinculado o Actualizar) o escribí al menos 3 caracteres en la búsqueda para ver productos.";

export type FiltrosListadoPxListas = {
  q: string;
  rubro: string;
  marca: string;
  subRubro: string;
  pxVinculado: string;
  actualizar: string;
};

/** Sin filtro desplegable ni búsqueda ≥ 3 caracteres no se consulta `prod_tienda`. */
export function hayFiltroActivoPxListas(
  params: FiltrosListadoPxListas
): boolean {
  if (params.marca.trim()) return true;
  if (params.rubro.trim()) return true;
  if (params.subRubro.trim()) return true;
  if (params.pxVinculado.trim()) return true;
  if (params.actualizar.trim()) return true;
  return params.q.trim().length >= MIN_CARACTERES_BUSQUEDA_PX_LISTAS;
}
