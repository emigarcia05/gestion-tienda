/**
 * Clases Tailwind reutilizables basadas en tokens del tema (shadcn / globals.css).
 * Evita repetir `emerald-*`, `amber-*`, `blue-*` en componentes.
 */

/** Badge o chip de estado positivo (mapeo OK, importación completada). */
export const BADGE_SUCCESS_TINT_CLASS =
  "bg-primary/10 text-primary border-primary/20";

/** Fila clickeable en columnas `catalogo-finder` (Categoría, Referencia competencia, etc.). */
export const CATALOGO_FINDER_ROW_INTERACTIVE_CLASS =
  "cursor-pointer transition-colors hover:bg-accent/50";

/** Fila seleccionada (una sola activa): azul claro de marca, igual que `CatalogoFinderRow`. */
export const CATALOGO_FINDER_ROW_SELECTED_CLASS =
  "bg-primary/10 hover:bg-primary/15";

/** Header de `CatalogoFinderColumn` con subtítulo (altura según contenido). */
export const CATALOGO_FINDER_COLUMN_HEADER_CLASS =
  "grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-primary px-3 py-2";

/** Header compacto de `CatalogoFinderColumn` (solo título): altura fija igual en todas las columnas. */
export const CATALOGO_FINDER_COLUMN_HEADER_COMPACT_CLASS =
  "grid h-8 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-primary px-3";

/** Título del header Finder: misma línea visual que `TableHead`. */
export const CATALOGO_FINDER_COLUMN_HEADER_TITLE_CLASS =
  "truncate text-center text-xs font-bold uppercase leading-none tracking-[0.08em] text-primary-foreground";

/** Subtítulo opcional del header Finder sobre fondo primary. */
export const CATALOGO_FINDER_COLUMN_HEADER_SUBTITLE_CLASS =
  "truncate text-center text-[11px] text-primary-foreground/75";

/**
 * Header Finder como título de paso (mismo grid: título centro, `+` a un lado).
 * Sin barra `bg-primary` (no se lee como botón).
 */
export const CATALOGO_FINDER_COLUMN_HEADER_TITULO_CLASS =
  "grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 py-1";

export const CATALOGO_FINDER_COLUMN_HEADER_TITULO_TITLE_CLASS =
  "truncate text-center text-sm font-semibold uppercase tracking-wide text-foreground";

export const CATALOGO_FINDER_COLUMN_HEADER_TITULO_SUBTITLE_CLASS =
  "truncate text-center text-[11px] text-muted-foreground";

/** Texto de mensaje de éxito con ícono (lista, modal). */
export const TEXT_SUCCESS_CLASS = "text-primary";

/** Advertencias no destructivas (lista de advertencias en importación). */
export const TEXT_WARNING_CLASS = "text-accent2";

/** Botón/ícono de alerta suave (p. ej. diferencia de cantidades en historial de pedidos). */
export const ICON_WARNING_INTERACTIVE_CLASS =
  "inline-flex items-center justify-center rounded-sm text-accent2 outline-offset-2 hover:text-accent2/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Callout/banner de advertencia no destructiva (p. ej. avisos de configuración faltante en Balance mensual).
 * Reusa la familia `accent2` (amarillo de marca) sin acoplarse a paletas genéricas como `amber-*`.
 */
export const CALLOUT_WARNING_CLASS =
  "rounded-md border border-accent2/40 bg-accent2/10 px-3 py-2 text-xs text-foreground";

/** Badges del resumen numérico en ImportarListaPreciosModal (ResultStat). */
export const IMPORT_STAT_BADGE_CLASSES = {
  created: BADGE_SUCCESS_TINT_CLASS,
  updated: "bg-accent text-accent-foreground border-border",
  removed: "bg-accent2/10 text-accent2 border-accent2/20",
} as const;

/**
 * Botón de **solo ícono** (o texto mínimo tipo +/−) en **celdas de tabla de gestión**.
 * **Obligatorio:** `variant="ghost"` + `size="icon"` + esta clase (anula el hover ghost).
 * Ver **FRONTEND_GUIDELINES** §1 — prohibición de `variant="outline"` + `size="icon-xs"` con aspecto documento.
 */
/** Botón #0072BB en fila de tabla: cuadrado (ancho = alto), encaja al alto útil del contenedor + `p-*` del wrapper. */
export const TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS =
  "tabla-row-btn-filled-brand aspect-square !h-full max-h-full !w-auto max-w-full min-h-0 min-w-0 self-center shrink-0 rounded-md border-0 bg-[#0072BB] text-white shadow-none hover:bg-[#0072BB]/90 hover:text-white focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

/**
 * Contenedor flex en celdas con botones {@link TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}.
 * `p-1.5` + `items-center` dejan aire respecto del borde de la celda; el botón cuadrado usa el alto interno.
 */
export const TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS =
  "flex h-full min-h-0 w-full flex-wrap items-center justify-center gap-1.5 box-border p-1.5";

/** Tamaño uniforme del ícono dentro de botones de acción en tabla. */
export const TABLE_ROW_ACTION_ICON_CLASS = "h-4 w-4 shrink-0";

/**
 * Columna **Control de ítem** (`TablaControlItemHead` / `TablaControlItemCelda`):
 * checklist local en tablas tipo Recepción / Trans. Depósitos.
 */
export const TABLA_CONTROL_ITEM_HEAD_ICON_CLASS =
  "mx-auto my-0 block h-4 w-4 shrink-0 leading-none text-primary-foreground";

export const TABLA_CONTROL_ITEM_BADGE_CLASS =
  "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/20";

export const TABLA_CONTROL_ITEM_BADGE_ICON_CLASS =
  "h-3.5 w-3.5 shrink-0 text-primary";

export const TABLA_CONTROL_ITEM_PLACEHOLDER_CLASS = "inline-block h-7 w-full";

/** Botón + header Finder compacto (`h-8`): {@link TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS} adaptado al alto del encabezado. */
export const CATALOGO_FINDER_COLUMN_NOVO_BUTTON_COMPACT_CLASS =
  `${TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS} !size-6 max-h-6 min-h-6 min-w-6 shrink-0 !p-0`;

/** Botón + header Finder con subtítulo: mismo tamaño que acciones en `TableHead`. */
export const CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS =
  `${TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS} !size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0`;

/**
 * Columna **Hist.** en modales de drill-down del balance mensual (borde #0072BB + fondo suave).
 * Usar con {@link BALANCE_MODAL_TH_HISTORIAL_CLASS}, {@link BALANCE_MODAL_TD_HISTORIAL_CLASS} y
 * {@link BALANCE_MODAL_BOTON_HISTORIAL_CLASS}.
 */
const BALANCE_MODAL_COL_HISTORIAL_CLASS =
  "border-l-2 border-[#0072BB] bg-muted/35";

export const BALANCE_MODAL_TH_HISTORIAL_CLASS =
  `${BALANCE_MODAL_COL_HISTORIAL_CLASS} w-11 min-w-11 max-w-11 p-0 text-center align-middle text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground`;

export const BALANCE_MODAL_TD_HISTORIAL_CLASS =
  `${BALANCE_MODAL_COL_HISTORIAL_CLASS} w-11 min-w-11 max-w-11 p-0 align-middle`;

/** Botón ícono ChartNoAxesColumn en columna Hist. de modales balance (7×7 rem, #0072BB). */
export const BALANCE_MODAL_BOTON_HISTORIAL_CLASS =
  `${TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS} !h-7 !w-7 min-h-7 min-w-7 shrink-0 !p-0 [&_svg]:size-3.5`;

/** Tooltip estándar: historial por rubro usa el gasto final de mayor monto en ese rubro. */
export const BALANCE_MODAL_HISTORIAL_RUBRO_TITLE =
  "Evolución mensual del gasto con mayor impacto en este rubro";

/**
 * Micro-etiqueta MAYÚSCULAS en modales (misma tipografía que `ModalMicroLabel`).
 * Preferir el componente `ModalMicroLabel`; usar esta constante solo en `<label>` compuestos.
 */
export const MODAL_MICRO_LABEL_CLASS =
  "modal-micro-label modal-field-label text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-foreground";

/**
 * Typeahead / combobox listbox (Factura productos, clientes, …).
 * Panel flotante bajo el input; filas = `div role="button"` (no `<Button>` ni `<button>` de formulario).
 */
export const TYPEAHEAD_LISTBOX_PANEL_CLASS = [
  "absolute left-0 top-full z-[70] mt-1 flex flex-col overflow-hidden",
  "rounded-md border border-border bg-popover text-popover-foreground shadow-md",
].join(" ");

/**
 * Ancla del combobox cuando el listbox está abierto: debe superar bloques vecinos
 * (p. ej. remito Factura `z-30`) para que el panel quede por encima en el stacking.
 */
export const TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS = "relative z-[60]";

/** Ancla en reposo (por debajo de listboxes abiertos de otras zonas). */
export const TYPEAHEAD_LISTBOX_ANCHOR_CLASS = "relative z-20";
/** Altura fija del panel (scroll en la lista). */
export const TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS = "h-72";

/**
 * Panel más ancho que el input (p. ej. clientes: nombre + saldo + pintor).
 * Combinar con `TYPEAHEAD_LISTBOX_PANEL_CLASS`.
 */
export const TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS =
  "min-w-full w-[28rem] max-w-[min(28rem,calc(100vw-4rem))]";

/** Panel del mismo ancho que el input (`left-0 right-0`). */
export const TYPEAHEAD_LISTBOX_PANEL_MATCH_INPUT_WIDTH_CLASS = "right-0";

/**
 * Panel de productos en Factura · Crear: ocupa desde debajo del input
 * hasta el margen inferior interior del bloque de líneas (`p-4`).
 * Posicionar el panel dentro de un overlay `absolute inset-4` del bloque
 * (coincide con el content box). `left-11` = lupa `size-9` + `gap-2`;
 * `top-10` = input `h-9` + `mt-1`.
 */
export const TYPEAHEAD_LISTBOX_PANEL_FILL_BLOCK_CLASS =
  "bottom-0 left-11 right-0 top-10 mt-0";

export const TYPEAHEAD_LISTBOX_UL_CLASS =
  "min-h-0 flex-1 divide-y divide-primary/40 overflow-y-auto [scrollbar-gutter:stable]";

/**
 * Scroll único de listbox con encabezado de columnas: el header va sticky
 * dentro de este contenedor (mismo ancho que las filas; el scrollbar no desfasá).
 */
export const TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]";

/**
 * Encabezado de columnas opcional encima de la lista.
 * Misma superficie que thead de `.tabla-gestion-compacta` (`bg-primary`).
 * Altura = `--tabla-thead-height`. `sticky` cuando vive dentro de
 * `TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS`.
 */
export const TYPEAHEAD_LISTBOX_HEADER_CLASS = [
  "sticky top-0 z-10 box-border h-[var(--tabla-thead-height)] min-h-[var(--tabla-thead-height)] shrink-0",
  "border-b-0 bg-primary text-xs font-bold uppercase tracking-wide text-primary-foreground",
].join(" ");

/**
 * Fila de opción: `div` con `role="button"` `tabIndex={-1}`.
 * Hover / activo: `TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS`.
 */
export const TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS = [
  "w-full cursor-pointer py-0 text-sm leading-tight text-foreground transition-colors",
  "hover:bg-accent/60",
].join(" ");

export const TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS = "bg-accent/60";
