/**
 * Layout Comp. Categorias (Comparacion + Categorias): ~+50 % de área útil vs páginas `contentWidth="default"` (`max-w-7xl` + `px-8`).
 * @see FRONTEND_GUIDELINES — Comp. Categorias
 */

/** Ancho máximo de contenido en páginas del submódulo (`ClassicFilteredTableLayout` `contentWidth="wide150"`). */
export const COMP_CATEGORIAS_CONTENT_WIDTH = "wide150" as const;

/** Padding horizontal reducido para maximizar área de tablas Finder (desktop). */
export const COMP_CATEGORIAS_PAGE_CONTENT_CLASS = "!px-5";

/** Stack vertical Comparacion: selector 40 % + tabla 60 % (`flex-[2]` / `flex-[3]`), `gap-3` entre paneles. */
export const COMP_CATEGORIAS_COMPARISON_STACK_CLASS =
  "flex flex-1 min-h-0 flex-col gap-3 py-3";

/** Panel superior — selector Finder (Categorías): 40 % del alto útil. */
export const COMP_CATEGORIAS_SELECTOR_PANEL_CLASS =
  "flex min-h-0 flex-[2] flex-col overflow-hidden";

/** Panel inferior — ítems a comparar: 60 % del alto útil. */
export const COMP_CATEGORIAS_TABLA_PANEL_CLASS =
  "flex min-h-0 flex-[3] flex-col min-w-0";

/** Grid interno del selector: CATEGORÍA 25 % · SUBCATEGORÍA 25 % · REFERENCIA COMPETENCIA 50 %. */
export const COMP_CATEGORIAS_SELECTOR_GRID_CLASS =
  "grid h-full min-h-0 grid-cols-[1fr_1fr_2fr] gap-3";

/**
 * Ancho compartido modales Comp. Categorías con tabla de búsqueda
 * (Asignar Productos + Agregar Referencia De Competencia).
 * Base histórica `max-w-[84rem]` × 1,5 × 1,2 = 151.2rem; tamaño actual −50 % → 75.6rem.
 */
export const MODAL_COMP_CATEGORIAS_BUSQUEDA_MAX_WIDTH_CLASS = "!max-w-[75.6rem]";

/** Stack de filtros compartido (select entidad + búsqueda texto). */
export const MODAL_COMP_CATEGORIAS_FILTROS_STACK_CLASS = "flex flex-col gap-2";

/** TILDE + entidad (proveedor/competidor) + descripción + precio/costo. */
export const MODAL_COMP_CATEGORIAS_TABLA_COLUMN_WIDTHS_PCT = [5, 15, 65, 15] as const;

export const MODAL_COMP_CATEGORIAS_CELDA_ENTIDAD_CLASS = "py-2.5 px-3 text-xs";
export const MODAL_COMP_CATEGORIAS_CELDA_DESCRIPCION_CLASS = "py-2.5 px-3 text-xs";
export const MODAL_COMP_CATEGORIAS_CELDA_PRECIO_CLASS = "py-2.5 px-3 text-xs text-right tabular-nums";
