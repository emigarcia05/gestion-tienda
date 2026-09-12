# Guía de Frontend — vigente

Stack: **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS 4**, **shadcn/ui**, **Geist**, **lucide-react**, **sonner**. Desktop-only. Tokens del tema + `cn()` de `@/lib/utils`.

**No leas este archivo entero.** Usá la tabla de abajo y saltá a la sección del patrón o módulo que estás tocando.

| Qué estás haciendo | Leer |
|--------------------|------|
| Cualquier UI nueva o cambio visual | **Guía para IA** + **§4 Checklist** |
| Página con tabla/filtros | **§1.1–1.3** |
| Modal | **§1.4** + `AppModal` / `ModalTablaConFiltros` en **§2.3** |
| Checklist de ítem en tabla | **§1.3** Control de ítem |
| Finder (columnas de catálogo) | **§1.5** |
| Sidebar / áreas / URLs | **§1.6–1.7** |
| Clase CSS o constante de estilo | **§2** |
| Comportamiento de una pantalla concreta | **§3** (solo esa subsección) |
| Lista Precios / Edición Masiva | **§3 Proveedores** |
| IA Diseño / Asistente IA | `docs/AGENTEIA_GUIDELINES.md` |

`/` , `/finanzas`, `/marketing` y `/facturacion` son **hubs vacíos** (panel central sin datos). El contenido aparece al elegir una **ruta hoja** en el sidenav. Al cambiar de área: **Vendedor** → `/`, **Administración** → `/finanzas`, **Marketing** → `/marketing`, **Facturación** → `/facturacion`.

---

## Guía para IA

1. **Tokens.** Nunca `bg-white`, `text-slate-*`, `bg-slate-*`, `border-slate-*`, ni paletas genéricas (`emerald-*`, `amber-*`, `blue-*`) para estados. Usar `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `primary` / `accent` / `accent2`, o constantes de `@/lib/ui-classes` (`CALLOUT_WARNING_CLASS`, `TEXT_SUCCESS_CLASS`, `TEXT_WARNING_CLASS`, `IMPORT_STAT_BADGE_CLASSES`, `TABLE_ROW_*`).
2. **`cn()`.** Siempre. Prohibido `` className={`${a} ${b}`} ``. Una sola utilidad por eje (`px-8`, no `px-4 px-6 px-8`).
3. **Desktop-only.** Sin breakpoints Tailwind (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`, `max-*:`). Las keys CVA `sm`/`md`/`lg` de `Button`/`AppModal` no son breakpoints. **Excepción única:** Envios · **Conductor** (lienzo fijo `w-[24rem]`, sin media queries).
4. **Cascarón.** Páginas a pantalla completa: `.area-page-shell` (opcional `bg-gris`). No duplicar `flex h-screen min-h-0 flex-col overflow-hidden`.
5. **Página con tabla.** `ClassicFilteredTableLayout` → `filters` = `FilterBar` `filtros-contenedor-tienda bg-card` → `children` = `.contenedor-tabla-gestion` + `Table` de `@/components/ui/table`. Padding horizontal lo pone el layout (`density` default `px-8`, `compact` `px-6`); no repetir `px-*` en filtros/tabla.
6. **Búsqueda.** `useFiltrosConBusqueda` + `FiltroBusquedaInput`. No reimplementar debounce ni foco.
7. **Selects.** Prohibido `<select>` nativo. `Select` shadcn; `SelectContent` incluye buscador **BUSCAR...**. Valor vacío: sentinel `"none"` / `"todos"` (Radix no admite `""`). Triggers de filtro: `SELECT_TRIGGER_FILTER_CLASS` + `className="select-content-filtro"` `position="popper" side="bottom" align="start"`.
8. **Tablas.** Un solo look: `.tabla-gestion-compacta`. Encabezados **MAYÚSCULAS + negrita**. Celdas `.celda-datos`. Vacío = `""` (no `"-"`/`"—"`; `fmtCelda` / `fmtNumero` de `@/lib/format`). Scroll **solo** en `.contenedor-tabla-gestion` (el wrapper `data-slot="table-container"` **no** lleva `overflow-y-auto`). Sticky: `thead th`. 100 ítems/página (`PAGE_SIZE`). Botón solo ícono en fila: `variant="ghost"` `size="icon"` + `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS` (no `outline` + `icon-xs`). Columna tilde: encabezado = ícono `Check`. **Control de ítem** (checklist local): `TablaControlItemHead` + `TablaControlItemCelda`; no duplicar el badge. Caja `.tabla-check-toggle`: rectángulo borde `#0072bb`, fondo `card`; tilde `#0072bb` si es verdadero (no rellenar con `bg-primary`).
9. **Modales.** `AppModal` (o `ModalTablaConFiltros` si hay tabla seleccionable). Botones: `Button` shadcn (`default` / `outline`). Pares SÍ/NO: `ModalSiNoChoice`. Labels de campo: `text-foreground` (`ModalMicroLabel`). No `max-w-*` extra si coincide con `size`.
10. **Texto.** Títulos de modal: MAYÚSCULAS. Botones: Title Case. Sidebar: módulo MAYÚSCULAS, submódulo Title Case. Filtros, placeholders y `TableHead`: MAYÚSCULAS. Abreviaturas con punto (Px., Cx., Dto., Cant., Cod.).
11. **Fechas de negocio.** `@/lib/fechaArgentina`. `@db.Date` → `isoYmdFromPrismaDateOnly` (no `dateToIsoYmdArgentina` sobre ese `Date`).
12. **Navegación interna.** `useRouter().push`, no `window.location.href`.
13. **Excepción hex (no copiar).** Solo **Balance mensual**: cabecera `#0072BB` + texto blanco; filas resultado `#a9d6f1` / `#063652`.
14. **Al cerrar.** Checklist **§4**. Clase global nueva → registrarla en **§2**.

---

## 1. Patrones

### 1.1 Página

```tsx
<div className="area-page-shell">
  <ClassicFilteredTableLayout
    title="Módulo"
    subtitle="Submódulo"
    actions={<>…</>}
    filters={<FilterBar className="filtros-contenedor-tienda bg-card">…</FilterBar>}
  >
    <div className="contenedor-tabla-gestion">
      <Table variant="compact">{/* … */}</Table>
    </div>
  </ClassicFilteredTableLayout>
</div>
```

- Header: `ClassicFilteredTableLayout` usa `ClassicPageHeader` (`tone="card"`). API ES: `SectionHeader`. Núcleo: `PageSectionHeader`. Visual: **MÓDULO** → **SUBMÓDULO 1** → **Submódulo 2**.
- `contentWidth`: `default` (`max-w-7xl`) | `wide150` (Comp. Categorías) | `full` (Balance, Gastos, Flujo, Calcular Lts, Px Tintométricos, Envios).
- Card envolviendo tabla: `className={cn("card-tabla-envoltorio", "flex-1")}`.
- CFTL **sin** `filters`: Calcular Lts, Px Tintométricos, Cargar Gasto (card de cálculo / modal; acciones de editor en `actions`). Hubs vacíos: `return null`. Finder sin `FilterBar`: Catálogo Gastos, Comp. Categorías, Ideas Marketing. Envios · Programados abre el wizard de alta desde el header (sin finder de página).

### 1.2 Filtros

- `FilterBar` > `FilaFiltrosDesplegables` (default **5** columnas; `columnas={6}` solo con 6 Selects) + `FilterRowSearch` + `LimpiarFiltrosButton` (siempre visible).
- Si la pantalla usa **dos** `FilterBar` apilados, envolver ambos en `.filtros-doble-bloque-compacto` para compactar separaciones verticales y ganar filas visibles de tabla sin perder separación visual.
- Cada Select de página en `FiltroIndividualContainer`. En modal: `FiltroIndividualContainer` o `FiltroBusquedaInput` (X propia); no `LimpiarFiltrosButton`.
- Al limpiar un Select de filtros, el trigger debe volver a mostrar su placeholder (máscara). A nivel app, `Select` normaliza `value null/undefined` a `""` para evitar que quede renderizado el último valor elegido.
- Consistencia recomendada en call sites: preferir `value={estado ?? ""}` (en vez de `|| undefined` / `?? undefined`) cuando el estado representa “sin filtro”.
- Sin búsqueda: acciones en la misma fila (`FILTER_INLINE_ACTION_SLOT_CLASS`, a menudo `col-span-2`).
- Contador: `FILTER_COUNT_CLASS`, texto MAYÚSCULAS (`X PRODUCTO(S)`).
- Rango de fechas: `FilterRowDateRange` + `FiltroRangoFechasCalendarioModal`.
- Multi-select: `FiltroMultiSelect` (trigger `<button>` + panel `role="listbox"` + `SelectSearchInput`) o el mismo patrón a mano (tipo de pedido, meses/años, `MktMultiSelectCatalogo`). No `<select multiple>`.
- Sucursal vacía en Vendedor (pedidos / stock): `useAplicarSucursalPreferidaSiVacia`. Opciones de sucursal de pedido: `global_sucursales` con `pedido = true`.

### 1.3 Tablas

- Altura fila datos: `--tabla-body-row-min-height` (**2rem**). Encabezado: `--tabla-thead-height` (mín. 2 líneas).
- Bloque secundario: `tabla-bloque-secundario-head*` / `*-cell*` (`*-divider` = inicio de sub-bloque).
- Subencabezado en `tbody`: `TablaSubencabezadoSeccionRow`.
- **Control de ítem:** primera columna de checklist local (`TablaControlItemHead` + `TablaControlItemCelda`). Encabezado = ícono `Check` (`sr-only` LISTA DE VERIFICACIÓN). Celda: badge circular `bg-primary/20` si está marcado; hueco `h-7` si no. Las acciones (OK, etc.) van en **ACCIONES**. **Excepción Generar Nota Crédito DUX y Generar Transf.:** **OK** va a la izquierda del código en **COD. TIENDA** (sin columna ACCIONES); copiar cantidad a la derecha de CANT. Fila: `recepcion-fila-verificada` / `recepcion-fila-pendiente` (`.tabla-recepcion-pedido`). Usos: Recepción Pedido, Generar Transf., Generar Nota Crédito.
- Pie de totales: o `TableFooter` en la misma tabla, o `.finanzas-resumen-tarjeta` bajo scroll (`contenedor-tabla-gestion--pie-fijo`). No segunda `<table>` de pie.
- Paginación URL: `PaginacionTabla`. Cliente: `PaginacionClient`. Backend: `skip`/`take` + `total` / `totalPaginas`.
- `<table>` nativo: solo `TablaGastos`, `PrintStock` (impresión) y leyenda de `GraficoMcVsPorcUtilidad`.
- Anchos estáticos: `<col className="w-[20%]" />`. `style` solo si el ancho es dinámico.

### 1.4 Modales

| Caso | Componente |
|------|------------|
| Formulario / confirmación | `AppModal` dentro de `Dialog` |
| Tabla + filtros + selección | `ModalTablaConFiltros` (`single` / `singleConfirm` / `multi` / `multiQuantity`) |
| Tabla de selección “vieja” ya migrada | Preferir `ModalTablaConFiltros` o `AppModal`; `modal-app` BEM sigue en call sites existentes (`SeleccionarProductoModal`) |

`AppModal`: `size` `sm|md|lg|xl` (md = `max-w-lg`), `padding`, `scrollBody` (default true), `hideBodyScrollbars`, `bodyShellClassName`. Tabla + pie fijo: tabla `flex-1 min-h-0`; no `h-0`. Wizard Envios · Nuevo Envío: `size="xl"` `h-[85vh]`. No apilar dos `Dialog` a la vez: el aviso **Transferencia Pendiente!** espera a que **Elegir Usuario** cierre (~450 ms) y usa un evento de ventana si hay navegación.

### 1.5 Finder

`@/components/shared/catalogo-finder/` + `CATALOGO_FINDER_*` en `ui-classes`. Columnas con header `bg-primary` (`headerVariant="finder"` default), `+` (`nuevoLado`: `end` default, `start` en Ideas), `className?` para altura en modal. Wizard Envios: `headerVariant="titulo"` (título de paso, sin barra primary) **en todos los pasos** (SUCURSAL / CLIENTES / DIRECCIONES / FECHA / MERCADERÍA). Paso CLIENTE / DIRECCIÓN: `mostrarNuevo={false}` y CTA **Nuevo Cliente** / **Nueva Dirección** (`Button` `w-full` en wrapper `p-4`, no `rounded-none`) debajo de la lista. Filas: hover editar/eliminar por default; `eliminarSiempreVisible` deja el `Trash2` fijo a la derecha (`CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS`). En Envios · CLIENTE y DIRECCIÓN, `accionesSiempreVisibles`: lápiz + Trash2 siempre visibles (DIRECCIÓN también MapPin). Selección `CATALOGO_FINDER_ROW_SELECTED_CLASS`. `nombreAccion` opcional a la derecha del nombre (Envios · DIRECCIÓN: `MapPin`). `iconoIzquierda` opcional a la izquierda del nombre (Envios · PINTOR: `Users`, filtra asociados). Envios · CLIENTE: `reservarEspacioIconoIzquierda` reserva el hueco `size-7` en CONSUMIDOR_FINAL para alinear nombres. `etiquetaIzquierda` opcional: columna fija de etiqueta a la izquierda. `nombreSufijo` opcional: ` - texto` en `font-normal text-[0.75em]` (Envios · CONSUMIDOR_FINAL con pintor asociado). Envios · DIRECCIÓN: `- Dirección (Referencia).` (`etiquetaDireccionEnvioFilaListado`) con `nombreLineas={2}` (hasta 2 renglones). `nombreCentrado` centra el nombre (Envios · CLIENTE). Usos: Catálogo Gastos (5 cols), Comp. Categorías (4), Ideas (2), Envios · Crear Envío (finder 1 col por paso, dentro del wizard modal), Envios · Gestionar Direcciones (finder 2 cols CLIENTES | DIRECCIONES, dentro de `EnviosGestionarDireccionesModal`).

### 1.6 Sidebar y áreas

SSOT: `src/lib/main-app-areas.ts`, `administracionNav.ts`, `marketingRoutes.ts`, `facturacionRoutes.ts`, `Sidebar.tsx`.

| Área (UI) | id | Entrada |
|-----------|-----|---------|
| Vendedor | `gestion-productos` | `/` |
| Administración | `finanzas` (pide clave) | `/finanzas` |
| Marketing | `marketing` | `/marketing` |
| Facturación | `facturacion` (sin clave) | `/facturacion` |

**Vendedor** (acordeón, módulos cerrados al inicio): **ENVIOS** (Programados / Conductor) → **MERCADERÍA** (Cant. Pedida → Urgente / Tintométrico / Reposición → Generar Pedido → Recepción) → **PRECIOS** (Px Sugeridos, Px Tintométricos) → **CALCULAR LTS** → **STOCK** (Control Stock, Trans. Depósitos) → **CARGAR GASTOS** → **ASISTENTE IA**. Rol `simple` ve estos módulos; CRUD de prompts IA solo `editor`.

**Administración** (`AdministracionAccordionNav`): **FINANZAS** (BALANCE | OPERACIONES → FLUJOS / COMPRAS / GASTOS | IMPUESTOS) → **LISTA PRECIOS** (PX TIENDA | PROVEEDORES | ANÁLISIS M.C.) → **VTAS. & COBROS** (Ptos. Vtas. / Cobros / Cx. Fin. Cobros, pantallas directas) → **PEDIDO A FÁB.** → **ESTADÍSTICAS** → **USUARIOS**. Acordeón anidado: el grupo padre sigue abierto mientras un subgrupo hijo está expandido. **IMPUESTOS** agrupa Posición De IVA (`/finanzas/posicion-iva`).

**Marketing:** **PUBLICACIONES** (Calendario, Ideas Contenido, Objetivos) → **BASE MULTIMEDIA** (Base Multimedia, Colores Marca). Lectura libre; mutaciones `editor`.

**Facturación:** **FACTURA** (Crear / Facturas / Presupuestos). Lectura libre (`PERMISOS.facturacion.acceso`); sin clave de editor al entrar al área. Asignable en Usuarios vía `modulos_permitidos` (`facturacion`).

**Dock** (abajo, `mt-auto`): Sync DUX (`SyncStatusIndicator` / `DuxSyncStyleButton`) → superficie sesión (`Pendientes` + usuario). El POST de sync lista tienda lee el JSON de error aunque el status no sea 2xx (no lo cuenta como fallo de red). Click en el nombre de usuario abre `Elegir Usuario`; en ese modal, el flujo es en 2 pasos dentro del mismo contenido (`Sucursal` → `Usuario`, sin abrir segundo modal). La clave de editor se pide **solo** al entrar a un módulo con `requierePassword=true` (Administración), no al seleccionar usuario para entrar a Vendedor. Si el usuario puede cambiar módulo, el ícono de módulo mantiene la apertura de `Cambiar Módulo`. Sync **no** se duplica en headers de página. Editor: modal Productos / Compras. Simple: sync productos. Import Excel: `ImportStatusIndicator` (independiente).

**Excepción Envios · Conductor:** `AppShell` no monta el slidenav (`esRutaEnviosConductor`). El modal **Elegir Usuario** vive en el dock; al abrir Conductor directo (`/gestion-productos/envios/conductor`) no se pide usuario. El resto de la app sigue pidiéndolo.

**Pendientes:** badge = categorías con pendiente (Pedido y/o Transf., 0–2). Hover o click abre detalle. **Transf.:** si la sucursal del usuario es **SUC. ORIGEN** en `stock_trasn_depositos`; click → Trans. Depósitos con **Generar Transf.** abierto (`?generar=1`). **Pedido:** solo proveedores con ítems pendientes (misma resolución que Generar Pedido) y `global_proveedores.es_fabrica = false`; hover o foco en el nombre muestra Urgente / Tintométrico / Reposición (los tres tipos, aunque el conteo sea 0). Click **PEDIDO** → Generar Pedido. Al **iniciar sesión** (elegir usuario) el picker y el aviso **no** pasan por Server Action del indicador: `GET /api/indicador-slidenav` (`parte=transf` al toque; `completo` a los 2,5 s). Next serializaba `getIndicadorSlidenavAction` (Generar Pedido ~10 s) y trababa **Elegir Usuario** + el COUNT del aviso; Radix no muestra un segundo modal si el primero sigue animando o si `router.push` desmonta el switcher. El aviso usa flag `sessionStorage` + `EVENTO_AVISO_TRANSF_PENDIENTE` y se abre ~450 ms después de cerrar **Elegir Usuario**. No modal al entrar a Stock.

### 1.7 URLs

Canónicas Vendedor / Análisis: `GP_ROUTES` (`src/lib/gestionProductosRoutes.ts`). Rewrites en `next.config.ts` sirven `src/app/pedidos`, `proveedores`, `tienda`, etc. Finanzas, Marketing y Facturación usan la URL de `src/app/` tal cual.

| Pantalla | URL canónica / app |
|----------|-------------------|
| Generar Pedido | `/gestion-productos/pedido-mercaderia/generar-pedido` → `/pedidos/enviar` |
| Urgente / Tintométrico / Reposición | `…/conf-pedido/{…}` → `/pedidos/{urgente\|tintometrico\|reposicion}` |
| Recepción Pedido | `…/recepcion-pedido` → `/pedidos/historial` |
| Px Sugeridos | `…/px-vta-sugerido` → `/proveedores/sugeridos` |
| Cx Compra | `…/cx-compra` → `/tienda` |
| Px Listas | `…/px-listas` → `/tienda/px-listas` |
| Px Competencia | `…/px-competencia` → `/tienda/cx-px` |
| Listas Px Prov. | `…/lista-precios` → `/proveedores/lista-precios` |
| Lista Prov. | `…/lista` → `/proveedores/lista` |
| Flujo De Fondo | `/finanzas/venc-por-fecha` |
| Posición De IVA | `/finanzas/posicion-iva` |
| Ptos. Vtas. | `/vtas-cobros/ptos-venta` (alias `/finanzas/fact-cobros`) |
| Cobros | `/vtas-cobros/cobros` |
| Cx. Fin. Cobros | `/vtas-cobros/cx-fin-cobros` (alias `/finanzas/analisis-mc/costos-financieros`) |
| Pedido A Fáb. | `/pedido-a-fabrica` |
| Envios | `/gestion-productos/envios/programados` → `/envios/programados` |
| Conductor | `/gestion-productos/envios/conductor` → `/envios/conductor` (alias `/envios/crear`) |
| Factura · Crear | `/facturacion/factura/crear` |
| Factura · Facturas | `/facturacion/factura/facturas` |
| Factura · Presupuestos | `/facturacion/factura/presupuestos` |

Aliases viejos (`/pedidos/*`, `/proveedores`, `/proveedores/gestion`, `/finanzas/flujo-de-fondo`, …) **redirigen**; no crear páginas ahí.

---

## 2. Catálogo

### 2.1 Clases globales (`globals.css`)

| Clase | Uso |
|-------|-----|
| `.area-page-shell` | Cascarón de página |
| `.contenedor-pagina-con-filtros` | Gap header / filtros / tabla |
| `.section-header` + `__titulo` `__subtitulo-*` | Encabezado |
| `.filtros-contenedor-tienda` `.filtros-doble-bloque-compacto` `.input-filtro-unificado` `.select-content-filtro` `.fila-filtros-4\|5\|6` `.filtro-individual-*` `.filtro-count-label` | Filtros |
| `.contenedor-tabla-gestion` (+ `--pie-fijo`, `--mc-overlay`, `no-scroll-x`) | Scrollport de tabla |
| `.card-tabla-envoltorio` | Card alrededor de tabla |
| `.tabla-gestion-compacta` `.celda-datos` `.tabla-check-toggle` `.tabla-row-btn-filled-brand` `.tabla-bloque-secundario-*` `.tabla-fila-seccion-subencabezado*` | Tablas |
| `.modal-app` / `.app-modal` `.modal-micro-label` `.modal-field-label` | Modales |
| `.sidebar-nav-*` `.sidebar-user-switcher-surface` | Sidebar |
| `.finanzas-resumen-tarjeta` | Totales Finanzas |
| `.no-scrollbar` | Oculta barra; mantiene scroll |
| `.btn-primario-gestion` | CTA toolbar legacy; nuevas toolbars → `ToolbarActionButton` |
| `--gris` `--gris-inset` `--primary` | Lienzo / inset / marca |

Variantes de tabla (misma familia compacta): `tabla-flujo-de-fondo`, `tabla-deuda-proveedores`, `tabla-recepcion-pedido`, `tabla-est-carga-datos`, `tabla-px-competencia-listado`, `tabla-px-listas-*`, `tabla-fin-ana-margen-contribucion`, `tabla-vinculos-modal`, `tabla-tienda-listado`.

### 2.2 `@/lib/ui-classes`

Éxito/aviso: `BADGE_SUCCESS_TINT_CLASS`, `TEXT_SUCCESS_CLASS`, `TEXT_WARNING_CLASS`, `ICON_WARNING_INTERACTIVE_CLASS`, `CALLOUT_WARNING_CLASS`, `IMPORT_STAT_BADGE_CLASSES`. Finder: `CATALOGO_FINDER_*`. Tabla: `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS`, `TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS`, `TABLE_ROW_ACTION_ICON_CLASS`, `TABLA_CONTROL_ITEM_*`. Balance modales: `BALANCE_MODAL_*`. Labels: `MODAL_MICRO_LABEL_CLASS`.

### 2.3 Shared (`src/components/shared/`)

Nuevo shared: CVA + tokens + `"use client"` solo si hay estado/hooks. Documentar aquí.

| Componente | Rol |
|------------|-----|
| `ClassicFilteredTableLayout` | Template página. Props: `title`, `subtitle?`, `subtitleSecondary?`, `actions?`, `filters?`, `children`, `tone` gray\|card, `contentWidth`, `density` |
| `ClassicPageHeader` / `SectionHeader` | Header. Núcleo `PageSectionHeader` |
| `AppModal` | Modal estándar. `title`, `children`, `actions`, `size`, `padding`, `scrollBody`, `hideBodyScrollbars` |
| `ModalTablaConFiltros` | Modal tabla + filtros. `selectionMode`, `columns`, `rows`, `getRowId` |
| `FiltroBusquedaInput` | Búsqueda con debounce (junto al hook) |
| `TableEmptyState` | Vacío (`tableCell` \| `panel` \| `compact`) |
| `PaginacionTabla` / `PaginacionClient` | Paginación URL vs callback |
| `ToolbarActionButton` | Toolbar ícono + label + `loading`. No en botones solo ícono |
| `DuxSyncStyleButton` | Dos líneas + swap hover (Sync slidenav) |
| `MensajeProceso` | “X de Y” / sidebar |
| `ModalMicroLabel` / `ModalSiNoChoice` / `ModalFeedbackRegion` | Labels, SÍ/NO, feedback |
| `MontoArInput` / `MontoArSaldoEnteroInput` / `PorcentajeCentInput` / `PorcentajeEnteroMaskInput` / `PxListaEnteroInput` | Máscaras AR. `MontoArInput` `allowNegative` en TOTAL PEDIDO de recepción. `PorcentajeCentInput` `allowNegative` + sufijo `%` fijo (`.input-mascara-sufijo`, no editable) en VARIACIÓN de Edición Masiva. |
| `SelectSearchInput` | Buscador de desplegables |
| `FiltroMultiSelect` | Multi-select de filtros (trigger + `listbox` + buscador). Vacío = placeholder |
| `FiltroRangoFechasCalendarioModal` | Rango de fechas |
| `TablaSubencabezadoSeccionRow` | Subencabezado en tbody |
| `TablaControlItemHead` / `TablaControlItemCelda` | Columna **Control de ítem** (checklist local) |
| `CeldaDifPct` / `CeldaCxProdTienda` | Celdas de variación / Cx |
| `EnteroStepperInput` | Entero − / número / + (mismo patrón que Control Stock). Vacío permitido; el padre persiste en `onCommit`. `endAction?` a la derecha del + |
| `catalogo-finder/*` | Finder |
| `ProcesoPaso` | Card de paso secuencial (`numero`, `titulo`, `activo`). `tituloLado` `arriba` (default) \| `izquierda`. Asistente IA (`AsistenteIaProcesoPaso` es alias) |
| `SidebarAreaSwitcher` / `SidebarMainAppArea` | Dock sesión / Pendientes (Transf. + Pedido → proveedor → tipos) |
| `ReposicionProveedorPrioritarioModal` / `SobreStockReposicionAdvertenciaModal` | Confirmaciones al generar pedido |
| `ExportarMktSeccionesGoogleSheetsButton` | Export Marketing |

Filtros: `@/components/FilterBar` (`FilaFiltrosDesplegables`, `LimpiarFiltrosButton`, `FILTER_*`).

---

## 3. Módulos (solo reglas únicas)

Patrón por defecto = **§1**. Acá solo lo que un agente rompería si copia el patrón ciego. Lógica de negocio → `docs/BACKEND_GUIDELINES.md`.

### Pedidos

- **Urgente** (`PedidoUrgentePageClient`): sucursal (preferida) **más un segundo filtro** (PROVEEDOR, PEDIDO o búsqueda ≥ 3) para listar. Catálogo: `prod_precios_provee.habilitado` de mercadería no fábrica. **Registrados en Dux** = hay `prod_tienda` (FK `cod_tienda`, CX PROD o match único de descripción lista↔tienda); si no, **Sin Registrar**. 7 columnas (PROVEEDOR 10%, DESCRIPCIÓN 60%, CANT. PED. / PROV. PED. / cesto / CONF. REPO. / CANT. REPO. 6% c/u). Sin columna VINC.; secciones `TablaSubencabezadoSeccionRow`. Filtro PEDIDO: urgente / reposición / cualquiera. Doble clic: varios proveedores → Elegir Proveedor (también con filtro PROVEEDOR). Header: solo `GenerarPedidoToolbarButton`. Auto-refresh IVA: `PosicionIvaComparacionAutoRefresh`.
- **Tintométrico:** `cod_ext` = `buildCodExtTintometrico`. Alta: sucursal → proveedor → COD. TINTOMÉTRICO.
- **Reposición:** desplegables SUCURSAL → PROVEEDOR → MARCA → RUBRO → CONFIGURADO. Bloque secundario STOCK / CANT. A PEDIR. Con sucursal, la grilla es **todo** `prod_tienda` (paginado; no exige vínculo ni otro filtro). PROVEEDOR es catálogo de mercadería con `es_fabrica = false` y lista habilitada; si está elegido, filtra por vínculo. También en el modal **Generar Pedido** cuando el origen es Reposición. `ConfigurarReposicionModal`: punto/cant vacíos (no `0`) si no hay regla. FORMA PEDIR (vendedor): **UN. MÁXIMAS** (`UNIDADES_MAX`) / **BULTO** (`POR_BULTO`; **siempre** en el select, aunque `prod_tienda.bulto` sea null). Modal siempre `max-w-[56rem]`. Campos en `grid-cols-5` de anchos iguales (también con UN. MÁXIMAS: las dos columnas de más van `invisible`). Con **UN. MÁXIMAS**: `FORMA PEDIR | PUNTO REPOSICIÓN | UN. MÁXIMAS`; con **BULTO**: `FORMA PEDIR | UN. POR BULTO | PUNTO REPOSICIÓN (EN UN.) | BULTOS REPOSICIÓN | UN. TOTALES`. Columnas siguientes se ocultan con `invisible` (no se desmontan): si **UN. POR BULTO** está vacío, PUNTO / BULTOS / UN. TOTALES; si **PUNTO REPOSICIÓN** está vacío, BULTOS / UN. TOTALES. **UN. TOTALES** solo lectura = `BULTOS REPOSICIÓN × UN. POR BULTO`. **UN. POR BULTO** (entero ≥ 1) al Guardar persiste `prod_tienda.bulto` de **todos** los ítems de la lista (principal + agregados con `+`). Etiquetas `h-12` + `line-clamp-3` (hasta 3 renglones, alineadas). En la grilla, **CANT. REPOSIC.** muestra la cantidad de bultos (`reposicion_cant_conf`); **CANT. A PEDIR** y el pedido generado van en unidades (`cantConf × prod_tienda.bulto`). Encima de la tabla del modal va el botón ícono `+` centrado y con estilo `default` (fondo `primary`, ícono `primary-foreground`) para abrir el selector de productos adicionales (con **BULTO**, exige Un. por bulto; lista ítems sin bulto o con el mismo valor; al Guardar se persiste ese valor en todos). No CANT. FIJA POR UNID.
- **Generar Pedido** (`/pedidos/enviar` + botón en urgentes): modal SUCURSAL → TIPO (multi checkbox) → PROVEEDOR. Footer solo con tres filtros y `hayItems`. Tras PDF/WhatsApp: `router.refresh()`. Confirmaciones: `ReposicionProveedorPrioritarioModal` luego `SobreStockReposicionAdvertenciaModal`.
- **Recepción** (`PedidoHistoriaDetalleModal`): `AppModal` `size="xl"` + `max-w-[66rem] h-[95vh]`. Scroll solo en tabla; pie TOTAL PEDIDO fuera. Checklist local (**Control de ítem** + OK) hasta **Registrar En Dux** (fiscal si `iva=PREGUNTA` → POST con `id_personal` del usuario slidenav; sin modal **Elegir Personal**). **CANT. RECIBIDA** y **TOTAL PEDIDO** admiten negativos (devolución / NC): en cantidad, `-` en el input o el stepper; en total, `MontoArInput` `allowNegative` (tecla `-` o pegado con signo). Header **Generar Nota Crédito** (`ToolbarActionButton`): abre `GenerarNotaCreditoModal` con pedidos `RECEPCIONADO` (FECHA RECEPCIÓN / PROVEEDOR / TOTAL / ACCIONES: Ver + tilde Elegir). Encima de la tabla (`shrink-0`, `text-sm text-foreground text-center`): «Esta herramienta es un asistente para **crear la Nota de Crédito en DUX**. Seguí las indicaciones…» y, debajo de un `Separator` (`bg-border/60`), la instrucción **ELEGÍ EL PEDIDO DEL CUAL QUERÉS GENERAR LA NOTA DE CRÉDITO**. Tilde **Elegir Pedido** cierra el picker y abre el mismo modal con `variante="nota-credito"` (título **Nota Crédito**): arranca editable (FECHA FACTURA vacía, CANT. REC. vacía, checklist vacío; CANT. PED. del snapshot); no persiste el pedido origen. Footer **Generar Nota Crédito** (mismo gating que Registrar En Dux): abre DUX (`abrirDuxNotaCreditoTab`, pestaña nombrada `DUX_NOTA_CREDITO_WINDOW_NAME`, no `_blank`) y `GenerarNotaCreditoDuxModal` (`scrollBody={false}` `size="xl"` `max-w-[66rem]` `h-[95vh]`): 4 `ProcesoPaso` visibles en una pantalla (`tituloLado="izquierda"`: número + título en columna izquierda). Footer Cerrar + **Nota Generada**. **1. COMPLETAR CABECERA**: `grid-cols-3` **PROVEEDOR** | **Nº COMPROBANTE** | **FECHA** (`dd/mm/aa` de FECHA FACTURA; ícono Copiar). **2. COMPLETAR DETALLES**: tabla Control de ítem / COD. TIENDA (**OK** a la izquierda del código; copia `cod_tienda`, toggle) / DESCRIPCIÓN / CANT. (copiar a la derecha, entero sin miles); cada copiar (y OK) enfoca la pestaña DUX ya abierta sin recargar (`enfocarDuxNotaCreditoTab`); scroll en `.contenedor-tabla-gestion` (`thead` sticky). **3. PX. UNITARIO**: «En todos los item, completar este monto en la columna **Precio Unitario** Con IVA» + valor copiar (TOTAL / suma CANT.). **4. FINALIZAR**: no tocar **Percepciones / Impuestos**; **Generar** la NC. **Nota Generada** reserva `prod_ped_ult_comp` id=3 (`X-00000-########`) y cierra el asistente. Sin POST DUX. FECHA RECEPCIÓN = `prod_ped_historial.fecha_recepcion` (FECHA FACTURA persistida al registrar). Corrección: **Corregir Recepcion** / **Guardar Corrección**. Tabla `tabla-recepcion-pedido`. Listado: `FiltrosHistorialPedidos` default PENDIENTE; acciones Recepción / Ver (`PedidoHistoriaLecturaModal`) / Borrar.

### Tienda / precios

- **Cx Compra:** 6 columnas (`tabla-tienda-listado`, colgroup 11/32/9/22/12/14 %). Link2 → `SeleccionarProductoModal`. Vínculos en subfilas `CxCompraVinculosDetalle` (no modal de lista; `colSpan` 6; hueca extra en BULTO). CX PROD. = BASE + variación. **BULTO** a la derecha de ACCIONES: `CeldaBultoTienda` + `EnteroStepperInput`; vacío = `prod_tienda.bulto` null. Header **Act. Cx.** (`ActCxButton`): al clic abre `DUX_NUEVO_IMPORTADOR_URL` en pestaña nueva (`window.open` sincrónico) y sigue el Excel/informe.
- **Px Listas** (`px-listas-precios/`): columnas fijas sticky 50% (DESCRIPCIÓN 42 % + **CATEGORÍA M.C** 8 %). El nombre de `fin_ana_mc_cat` (según PORC. UTILIDAD de **1 - GENERAL**) va solo en **CATEGORÍA M.C**; **REF.** es el competidor de GENERAL, no la categoría. Sticky de esas dos columnas: `position: sticky !important` (gana a `tbody td { position: relative }` de `.tabla-gestion-compacta`); el `<tr>` no puede tener `overflow` distinto de `visible`. Listas DUX: PX / PORC. UTILIDAD; GENERAL + REF. Staging `prod_tienda_precios_edicion`. Con permiso, **PX** y **PORC. UTILIDAD** se editan siempre (también con costo 0; no se bloquean). Sin permiso: mismos inputs `readOnly` (vacío = placeholder `—`). Sin costo, PORC. UTILIDAD queda vacío (no se deriva) y editarlo no puede calcular PX. **Sin filtro no lista productos** (igual que Lista Precios / Px Sugeridos): hace falta MARCA, RUBRO, SUB-RUBRO, PX VINCULADO, ACTUALIZAR o búsqueda ≥ 3 caracteres (`hayFiltroActivoPxListas` / `MENSAJE_SIN_FILTRO_PX_LISTAS`). Header **Act. Px.** (`ActPxListasButton`): al clic abre `DUX_NUEVO_IMPORTADOR_URL` en pestaña nueva (`window.open` sincrónico) y sigue el Excel por lista.
- **Px Competencia** (`PxCompetenciaPageClient` en `/tienda/cx-px`; **no** confundir con Px Listas): solo `comparar_competencia = true`. Filtros MARCA / RUBRO / PX PROMEDIO + búsqueda. Grilla DESCRIPCIÓN / PX PROMEDIO / DIF TIENDA / ACCIONES. Banner `CompetenciaSyncProgresoBanner`. UI en `px-competencia/` (`FiltrosPxCompetencia`, `TablaPxCompetencia`) + modales en `precios-competencia/`. Actions/servicios: `pxCompetencia.ts`, `pxCompetenciaPage.service.ts`. URL interna `/tienda/cx-px` (no renombrar).
- **Px Sugeridos:** `habilitado = true`; DESCRIPCIÓN = `descripcion_tienda` fallback proveedor; `px_vta_sugerido` nulo → celda vacía.
- **Comp. Categorías:** CFTL `wide150`, sin FilterBar. Finder 4 columnas + tabla. DTO. EXTRA y DIF % en cliente al blur. Con Px Promo Fijo el DTO. EXTRA no entra al costo. Layout: `@/lib/comparacionCategoriasLayout.ts`.

### Proveedores

- **Lista Precios** (`/proveedores/lista-precios`): header **Exp. Lista** = `Upload` (flecha arriba); **Imp. Lista** = `Download` (flecha abajo). botón **Edición Masiva** (`EdicionMasivaListaPreciosModal` modo header): PROVEEDOR obligatorio, MARCA opcional, RUBRO opcional (Select habilitado solo con MARCA), VARIACIÓN ± % 2 dec. obligatoria (`PorcentajeCentInput` `allowNegative`, sufijo `%` fijo no editable). Confirmar aplica `px_lista_proveedor * (1 + variación/100)` (piso 0; p. ej. $100 y 4% → $104; −4% → $96). No exige filtro de página. El lápiz de fila es SET de marca/rubro/px lista. **ACCIONES**: Descuentos (%) → Editar → Vincular REX → Borrar. **Descuentos Aplicados** (ícono %): `AppModal` `size="sm"` + `max-w-[33.6rem]` (20 % más ancho que `sm`). Encima: nombre del ítem (`descripcion`). **PX. PROMO FIJO** centrado (bloque 70 %, `py-5` entre nombre y tabla; moneda del ítem; tacho a la derecha). Tabla compacta 40 % | $ 30 % | % 20 %: **PX. LISTA**; descuentos (`−$` / %) y recargos (`+$`; Cx. Transporte sí suma sobre promo) separados por una línea fina `border-primary` (sin filas de sección). Con promo, las reglas de descuento se muestran tachadas (`text-muted-foreground line-through`) para comparar vs **DESC. PX. PROMO FIJO** (lista − promo y % sobre lista). Flechas: abajo `text-primary`, arriba `text-destructive`. Números en `text-foreground`. Columna %: valor + flecha al centro, ícono Info fijo a la derecha (`h-7 w-7`; hueco vacío en filas sin info). **PX. FINAL** en `TableFooter` (`bg-muted`, borde `primary`).

### Stock / ayuda vendedor

- **Control Stock:** header **Exportar Excel** / **Imprimir**. Sin modal de sync al entrar. Excel usa ítems con variación (`filasConVariacionStockParaExportar`). **Exportar Excel** además escribe `prod_tienda_stock` del depósito de la sucursal del filtro (`stock_real` / `ctd_disponible`; no toca la otra sucursal ni DUX) y persiste ÚLT. CONTROL. El Check confirma sin variación (solo Excel persiste ÚLT. CONTROL).
- **Trans. Depósitos:** origen ≠ destino; origen default = sucursal preferida. **Borrador de grilla** (Cód. / Cant.): `localStorage` `transf-depositos-borrador-v1:{origen}:{destino}` hasta **Transferido**; reabrir la misma URL restaura las filas (también las que no están en la página actual). Si el local está vacío, la grilla se hidrata desde pendientes de `stock_trasn_depositos`. Cambiar origen/destino carga el borrador de ese par. **Generar Transf.** persiste (reemplaza el lote del par; no borra el borrador) y abre `GenerarTransfDepositosModal` (`scrollBody={false}` `size="xl"` `max-w-[54rem]` `h-[85vh]`, 50% más ancho que `lg`): bloque fijo `grid grid-cols-2` **SUC. ORIGEN** | **SUC. DESTINO**. Si la página ya tiene destino, el modal lo precarga y muestra el lote pendiente (reabrir sin Transferido = mismos ítems). Elegir **SUC. DESTINO** a mano abre (o enfoca) DUX transferencia de depósitos (`enfocarDuxTransferenciaDepositosTab`, pestaña `DUX_TRANSFERENCIA_DEPOSITOS_WINDOW_NAME`; no recarga si ya está abierta). El click **Generar Transf.** también enfoca DUX si hay destino de página. No hay botón **Comenzar Transferencia**. Destino = sucursales con `id_deposito` (FK a `global_depositos`). Debajo `.contenedor-tabla-gestion` (scroll solo de filas, `thead` sticky) **Control de ítem** (`w-[8%] min-w-12`) / COD. TIENDA (**OK** a la izquierda del código; copia `cod_tienda`, toggle) / **DESCRIPCIÓN** (`w-[50%]`) / CANTIDAD A TRANSFERIR (copiar a la derecha, entero). Cada copiar (y OK) enfoca la pestaña DUX ya abierta sin recargar (`enfocarDuxTransferenciaDepositosTab`). **Transferido** queda bloqueado hasta que todos los ítems estén TRUE; al clic borra el lote origen→destino en `stock_trasn_depositos` y el borrador de grilla. Pendientes slidenav + aviso al login si la sucursal es SUC. ORIGEN; **Transferir Ahora** / click **Transf.** abre el mismo modal (`?generar=1`).
- **Px Tintométrico / Calc. Litros:** CFTL `contentWidth="full"` sin FilterBar; card de cálculo. Coeficientes / rendimientos solo `editor`, en `actions` del header (**Editar Coeficientes** / **Editar Rendimientos**).
- **Cargar Gasto:** CFTL; al entrar abre `GastoUnicoBalanceModal` (gasto eventual, mes/año AR). Header **Nuevo Gasto Eventual**.
- **Envios · Programados:** en la tabla, la columna **ACCIONES** incluye botón toggle de entrega: si está pendiente marca **ENTREGADO** y si ya está entregado permite volver a **NO ENTREGADO**.
- **Envios · Programados (bloqueado visual):** filas con `entregado=true` se muestran atenuadas (opacidad/saturación reducida) para señalar visualmente que ya fueron entregadas, además de la tilde en la columna **ENTREGADO**.
- **Envios · Purga automática:** al abrir Programados se eliminan envíos con `fecha_envio` de 7 días o más de antigüedad, sin importar estado de entrega.
- **Envios · Wizard / buscar cliente:** el input `filtro-envios-wizard-clientes` filtra por `nombre_completo` y `cel` con coincidencia parcial (ej. `54` matchea cualquier `cel` que contenga `54`).
- **Envios · Conductor (destinatario):** cuando el cliente es `CONSUMIDOR_FINAL` sin nombre (`nombre_completo=""`), la tarjeta muestra `CONS. FINAL` como destinatario (sin `- CEL`).
- **Envios · Conductor (destinatario con pintor):** si el cliente tiene pintor asociado, se muestra `NOMBRE_CLIENTE - Cliente de NOMBRE_PINTOR` con el nombre principal en negrita y el sufijo en peso normal.
- **Envios · Conductor (dirección expandida):** en el detalle de la tarjeta, la dirección se presenta en 3 líneas: `calle_nombre, numeracion.`, `distrito, departamento.` y `(referencia)` cuando existe.

### Finanzas

- **Envios · Cliente Cons. Final:** en `CrearEditarClienteModal`, debajo de **NOMBRE COMPLETO** hay una casilla `Cargar como CONS. FINAL`. Al activarla, el input de nombre se bloquea mostrando `CONS. FINAL`, el payload persiste `nombre_completo=""` y `CEL` pasa a obligatorio.

- **Balance mensual:** CSS Grid (concepto + Global + sucursales `genera_balance`). Filas `h-10`. Hex de informe (**Guía para IA** punto 13). Ventas solo lectura desde `fin_bal_vtas` (carga en Ventas Mensuales). Drill-down: historial → clic barra (CV/CF) → rubros; footer **Volver**. Filtros mes/año + cesto → periodo AR actual. `contentWidth="full"`.
- **Gastos:** filtros sucursal/proveedor/rubro/gasto/estado + año/mes (mes multi). ESTADO: CON MONTO Y PAGADO → CON MONTO Y PENDIENTE → SIN MONTO → SIN MONTO O PENDIENTE. Totales en `.finanzas-resumen-tarjeta`. `TablaGastos` usa `<table>` nativo (excepción). **ACCIONES**: lápiz (monto/pago) + borrar imputación + gráfico de evolución mensual (sin columna HISTORIAL).
- **Ventas Mensuales:** una fila por mes/año desde el mes calendario AR actual hasta la carga más antigua (`fin_bal_vtas`), inclusive los meses sin monto. Columnas **MES** + sucursales `genera_balance` + **ACCIONES** (Cargar / Editar / Eliminar; Cargar se deshabilita si todas las sucursales ya tienen monto). Filtros MES / AÑO / SUCURSAL + contador de periodos. Sin botón de header: Cargar/Editar abren `CrearFinBalVtasModal` con periodo fijo. Eliminar borra el periodo completo (`eliminarFinBalVtasPorPeriodoAction`).
- **Posición De IVA:** sidenav **FINANZAS → IMPUESTOS** (un solo destino: el grupo es link directo a `/finanzas/posicion-iva`; alias `/finanzas/balance/posicion-iva` redirige). Sin modal de importar IVA débito (TXT alícuotas); ACCIONES editor = saldo manual.
- **Tesorería:** 5 filtros en una fila (ENTIDAD / SUCURSAL / TITULAR / TIPO CAJA / TIPO DE VALOR); limpia cada uno con `FiltroIndividualContainer` (sin `LimpiarFiltrosButton` global). Pie dos filas de tarjetas (tipo de valor / disponibilidad). Cheques: tenencia ACTUALES / TRANSFERIDOS. TIPO CAJA en pantalla: `EFECTIVO` → **CAJA LOCAL**; `TARJETAS_A_COBRAR` → **TERMINAL DE PAGO** (`etiquetaTipoCajaEnPantalla`). Tabla: columnas ENTIDAD / **SUCURSAL** / TITULAR (SUCURSAL vacía si `tipoCaja = CHEQUE`). Alta/edición: sucursal = `global_sucursales` salvo CHEQUE (sin sucursal); titular = `global_personal` con `titular_financiero`. Tenedor de cheque: misma lista de personal.
- **Flujo De Fondo:** `/finanzas/venc-por-fecha` (`TablaFlujoDeFondo`). SALDO negativo: `text-destructive` en la celda. Doble clic → detalle día. **No** usar `/finanzas/flujo-de-fondo` (redirect).
- **Venc. Provee. Merc. / Gastos:** doble clic → mismo detalle de flujo filtrado por proveedor.
- **Comprobantes** (`/finanzas/control-comprobantes`): filtros + rango fechas. Columna **PROVEEDOR** = `prefijo` (tooltip = nombre). Columna **SALDO** = total − monto aplicado. Columna **PLAZO** = plan efectivo (`30, 60, 90`). Header (editor): **Gestionar Venc.** → modal con hasta 4 plazos por proveedor mercadería. **ACCIONES**: Controlado + Plazo De Pago (plan proveedor o personalizado hasta 4 cuotas iguales; pagos FIFO).
- **Ptos. Vtas.** (`/vtas-cobros/ptos-venta`, alias `/finanzas/fact-cobros`): sidenav **VTAS. & COBROS → Ptos. Vtas.** Header **VTAS. & COBROS** / Ptos. Vtas. Filtros MES / AÑO. Tabla **PTO. VTAS.** (`Nº - TITULAR`) | **FISCAL** (suma letras A/B/C/…, todo excepto **X**) | **NO FISCAL** (letra **X**) | **TOTAL** (Fiscal + No Fiscal; datos en `fin_fact_cobros_pto_vta_mes` por pto + letra, agregados en UI). Header **Ptos. Vta.** (`GestionarGlobalPtoVtasModal`: catálogo `global_pto_vtas`; campo `nombre_titular`; **SUC. ASOCIADAS** solo `global_sucursales.genera_est`; alta/edición/baja solo editor). Header editor **Sincronizar** (GET DUX `/v2/remitos-venta` del mes; suma `total_factura_asociada` de **todas** las letras de comprobante asociado (`nro_factura_string`); encadena POST `/api/sync-facturas-ventas-dux`; solo `nro_pto_vta` del catálogo y sucursal asociada). No lista remitos individuales.
- **Cobros** (`/vtas-cobros/cobros`): sidenav **VTAS. & COBROS → Cobros**. Header **VTAS. & COBROS** / Cobros. `contentWidth="full"`. Filtros **MES / AÑO** (listado de `fin_vtas_cobros` por `fecha`). Header **Gestionar Terminales** (`GestionarTerminalesFinAnaCosFinaModal`: catálogo `fin_ana_cos_fina_terminales` = ID DUX + marca + titular `global_pto_vtas.nombre_titular`; alta/edición en modal aparte). Header editor **Consultar**: encadena `POST /api/sync-cobros-dux` (GET DUX `/v2/cobros` por sucursal asociada al catálogo). La ventana **no** usa el mes del filtro: última `fecha` persistida (inclusive) → hoy AR; si no hay filas, día 1 del mes en curso. Duplicados del día solapado se omiten (`id_cobro` + `linea`). Tabla: FECHA | ID COBRO | **SUC.** (`id_dux - NOMBRE` vía FK `fin_vtas_cobros.id_sucursal` → `global_sucursales.id_dux`) | TIPO VALOR | DESCRIPCION | MONTO | ID TARJETA | ID PLAN | ID TERMINAL.
- **Cx. Fin. Cobros** (`/vtas-cobros/cx-fin-cobros`, alias `/finanzas/analisis-mc/costos-financieros`): sidenav **VTAS. & COBROS → Cx. Fin. Cobros**. Header **VTAS. & COBROS** / Cx. Fin. Cobros. Matriz **MARCA × PAGO** (`fin_ana_cos_fina.terminal_id` → `fin_ana_cos_fina_terminales_marcas`). **Gestionar Marcas** (nombre; alta/edición en modal aparte). Pagos y **Cálculo Cx. Total**. Catálogo de terminales DUX: header de **Cobros**.
- **Catálogo Gastos:** Finder 5 columnas. Proveedores no-mercadería desde header.
- **Margen Contribución:** `/finanzas/analisis-mc/margen-contribucion`; overlay COSTOS (`.contenedor-tabla-gestion--mc-overlay`).
- **Usuarios:** búsqueda + tabla (NOMBRE / ID DUX / SUCURSAL POR DEFECTO / MÓDULOS PERMITIDOS / TITULAR FINANCIERO). Header editor **Crear Usuario** (nombre; **ID DUX** opcional; sucursal opcional **SIN SUCURSAL**; módulos mín. 1; titular financiero SÍ/NO; `id_personal` lo asigna la BD). Edición: ID DUX y sucursal opcionales. ACCIONES editor: lápiz + tacho (`EliminarUsuarioModal`; no borra si es titular/tenedor de tesorería). Sin sucursal no aparece en el modal de inicio.

### Estadísticas / Pedido A Fáb.

- **Carga De Datos:** grilla periodo × sucursal (`tabla-est-carga-datos`); celda pendiente `.celda-est-carga-pendiente`.
- **Configuracion:** `FilaFiltrosDesplegables` `columnas={6}` + búsqueda. Marca / rubro / sub rubro / color / terminación / presentación: `FiltroMultiSelect` (OR dentro de cada dimensión).
- **Ventas:** dos FilterBar + tres gráficos (clases `.est-vtas-*`). Fila 2: mismos 6 filtros multi (`FiltroMultiSelect`; OR dentro de la dimensión). Gráfico 1 y Top 10: `%` = Un. ítem / Un. total de los filtros actuales (`fmtPctParticipacion`; en desglose del gráfico 1 cada hijo sobre ese total, no sobre el padre). Un. / TO. se muestran enteros (`fmtNumero`); el % no lleva sufijo (el encabezado ya es **%**). Gráfico 1: Un. / % centrados (`text-center` encabezado y dato), datos `text-foreground`, encabezados `font-bold`. Top 10: el denominador incluye productos fuera del top.
- **Pedido A Fáb.:** dos FilterBar. Fila 1: PROVEEDOR / FECHA DE PEDIDO / TIEMPO STOCKEO (días calendario; 30 calendario = 24 hábiles de venta en CANT. SUG.) / **PROD. VINCULADO** (SI/NO en servidor: hay fila `prod_tienda` vía `cod_tienda`; sin elegir = todos) / STOCK QUEBRADO (solo filtra si SI/NO está elegido; **no** hay columna QUEBR. en la grilla). Fila 2: MARCA / RUBRO / SUB-RUBRO / **PEDIDO** (SI/NO en servidor: SI = `CANT. PED.` persistida > 0 en `prod_ped_merc` A FÁBRICA; overlay local si se edita la cantidad). Secciones: **STOCK** (una columna, `rowSpan={2}`: grupo centrado cantidad + Info; número `min-w-[2.75rem] text-right tabular-nums` + `gap-3` para alinear cifras e íconos sin pegarlos al borde derecho) y **COMPRA** (FORMA **BULTO**/**UNIDAD** | BULTO si vínculo `cod_tienda` | `CANT. PED.` `EnteroStepperInput` en orden `- | input | + | check | borrar` (check copia CANT. SUGERIDA y borrar limpia el valor) | `CANT. SUG.`: UNIDAD techo entero; BULTO techo al múltiplo de `prod_tienda.bulto`). Quiebre = `UN. ACT. ≤ 0` o `Stock Hasta Llegada De Pedido ≤ 0` (`esStockQuebradoPedidoAFabrica`; solo el filtro). Si **FECHA DE PEDIDO** está vacía, el cálculo inicial usa hoy (AR) como base y proyecta provisión hasta `tiempo_entrega_en_dias`. Modal de soporte: título `INFO FORMULAS` y fórmulas alineadas a la lógica vigente de provisión/quiebre/cant. sugerida. Última columna de acciones: Info de PROM. VTA. por sucursal (modal `SUCURSALES` + `PROM. VTA POR DÍA` 1 decimal = ventas 2 meses / 48). Info de **STOCK**: modal solo sucursales con `id_deposito` (`prod_tienda_stock.stock_real` + TOTAL). Info final: PROM. VTA. de sucursales `genera_est`. DESCRIPCIÓN = `descripcion_tienda` si hay vínculo, si no `descripcion_proveedor`. Header `GenerarPedidoToolbarButton` `modulo="a-fabrica"`.

### Marketing

SSOT `MARKETING_ROUTES`. Calendario: grilla mes + Cuadro De Mando; ícono red `MktRedSocialIcon`. Ideas: Finder 2 columnas. Objetivos: 3 ejes × semanal/mensual. Base Multimedia / Colores Marca: tablas CFTL. Export: `ExportarMktSeccionesGoogleSheetsButton`.

### Facturación

SSOT `FACTURACION_ROUTES` (`src/lib/facturacionRoutes.ts`). Módulo sidenav **FACTURA**: Crear / Facturas / Presupuestos. **Crear** (`FacturaCrearPageClient`): cabecera en card — grid 3 cols (Fecha con picker nativo AR, Tipo De Factura select, N° Comprobante solo lectura vacío) + Cliente en 2.ª fila. Segundo bloque (`FacturaCrearLineasBlock`): fila **lupa** (búsqueda avanzada stub) + input typeahead + **+**; dropdown hasta 10 ítems (`buscarProductosFacturaAction`, AND `contains` por tokens en `descripcion_tienda`); tabla remito COD. / DESCRIPCIÓN / CANTIDAD / PX. LISTA / TOTAL (estado local; mismo `cod_tienda` suma cantidad). Tipos: `FACTURA_TIPOS` en `@/lib/factura`. Facturas / Presupuestos: placeholders CFTL sin datos.

### Asistente IA

UI en `src/components/asistente-ia/`. Pasos secuenciales: `ProcesoPaso` (alias `AsistenteIaProcesoPaso`). Contratos, prompts y scraper: **`docs/AGENTEIA_GUIDELINES.md`**.

---

## 4. Checklist de PR

- [ ] Tokens + `cn()`; sin paletas genéricas; banners con `CALLOUT_WARNING_CLASS`.
- [ ] `.area-page-shell`; sin `px-*` duplicado; sin breakpoints `sm:`/`md:`/`lg:`.
- [ ] Página con tabla: CFTL + `FilterBar` `filtros-contenedor-tienda bg-card` + `Table` compacta + sticky thead + vacío `TableEmptyState`.
- [ ] Búsqueda: `useFiltrosConBusqueda` + `FiltroBusquedaInput`. Selects shadcn con buscador. Fila desplegables: 5 cols (6 solo si hay 6).
- [ ] Íconos de fila: `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS`. Toolbar ícono+label: `ToolbarActionButton`.
- [ ] MAYÚSCULAS / Title Case / abreviaturas con punto según **Guía para IA** punto 10.
- [ ] Labels de modal en `text-foreground`.
- [ ] lucide-react + sonner + Geist. Sin `any`. Zod en el borde si hay input.
- [ ] Clase global o shared nuevo → **§2**. Comportamiento único de pantalla → **§3**.

---

## 5. Anti-patrones

- Paletas genéricas, breakpoints responsive, `<select>` nativo, `window.location.href`, template literals en `className`, cascarón `h-screen flex…`, sombra mágica en Card de tabla.
- `<button>` suelto en páginas/modales (usar `Button`). Excepciones: celdas de calendario, checkbox de tabla, `TooltipTrigger`, barras de gráfico, dock/sidebar, trigger de multi-select.
- Sync DUX en el header de un módulo (vive en slidenav).
- Inventar layout “dashboard” o segunda variante de tabla.
- Recrear páginas en URLs redirigidas (`/proveedores`, `/proveedores/gestion`, `/finanzas/flujo-de-fondo`, `/precios-competencia`, …).
- Copiar el hex de Balance mensual a otras pantallas.
- Lógica de negocio, auth o persistencia en el cliente.

**Para IA:** `.cursorrules` obliga esta guía al tocar frontend. Leer solo la sección relevante + checklist **§4**.
