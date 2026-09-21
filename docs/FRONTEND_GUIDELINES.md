# Guía de Frontend — vigente

Stack: **Next.js 16.1.6 (App Router)**, **React 19.2.3**, **TypeScript 5.9.3**, **Tailwind CSS 4**, **shadcn/ui** (estilo **new-york**, RSC, tokens CSS, `baseColor: neutral`), **CVA** + `cn()` (`clsx` + `tailwind-merge`), **Geist** / Geist Mono, **lucide-react**, **sonner**, **Radix**, ESLint 9 + `eslint-config-next`. Desktop-only. Zod v4 en el borde de formularios. Inventario de tecnología + prompt operativo del agente Front (incluye protocolo de mantenimiento de esta guía): [`.cursor/front_promp.md`](../.cursor/front_promp.md).

**No leas este archivo entero.** Usá la tabla de abajo y saltá a la sección del patrón o módulo que estás tocando.

| Qué estás haciendo | Leer |
|--------------------|------|
| Cualquier UI nueva o cambio visual | **Guía para IA** + **§4 Checklist** |
| Página con tabla/filtros | **§1.1–1.3** |
| Modal | **§1.4** + `AppModal` / `ModalTablaConFiltros` en **§2.3** |
| Lista desplegable (elegir una o varias) | **Guía para IA** punto 8 + `FiltroMultiSelect` en **§1.2** / **§2.3** |
| Boolean / SÍ/NO en modal | **Guía para IA** punto 10 + `ModalSiNoChoice` en **§1.4** |
| Checklist de ítem en tabla | **§1.3** Control de ítem |
| Finder (columnas de catálogo) | **§1.5** |
| Sidebar / áreas / URLs | **§1.6–1.7** |
| Typeahead / combobox listbox | **§1.8** + `TYPEAHEAD_LISTBOX_*` en **§2.2** |
| Contorno de Input / Select / textarea | **Guía para IA** punto 7 + **§2.1** |
| Clase CSS o constante de estilo | **§2** |
| Comportamiento de una pantalla concreta | **§3** (solo esa subsección) |
| Lista Precios / Edición Masiva | **§3 Proveedores** |
| Ptos. Vtas. | **§3** Ptos. Vtas. |
| IA Diseño / Asistente IA | `docs/AGENTEIA_GUIDELINES.md` |
| Prompt agente Front (inventario de stack + docs + mantenimiento de esta guía) | [`.cursor/front_promp.md`](../.cursor/front_promp.md) |

`/` , `/finanzas`, `/marketing` y `/facturacion` son **hubs vacíos** (panel central sin datos). El contenido aparece al elegir una **ruta hoja** en el sidenav. Al cambiar de área: **Vendedor** → `/`, **Administración** → `/finanzas`, **Marketing** → `/marketing`, **Facturación** → `/facturacion`.

---

## Guía para IA

1. **Tokens.** Nunca `bg-white`, `text-slate-*`, `bg-slate-*`, `border-slate-*`, ni paletas genéricas (`emerald-*`, `amber-*`, `blue-*`) para estados. Usar `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `primary` / `accent` / `accent2`, o constantes de `@/lib/ui-classes` (`CALLOUT_WARNING_CLASS`, `TEXT_SUCCESS_CLASS`, `TEXT_WARNING_CLASS`, `IMPORT_STAT_BADGE_CLASSES`, `TABLE_ROW_*`).
2. **`cn()`.** Siempre. Prohibido `` className={`${a} ${b}`} ``. Una sola utilidad por eje (`px-8`, no `px-4 px-6 px-8`).
3. **Desktop-only.** Sin breakpoints Tailwind (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`, `max-*:`). Las keys CVA `sm`/`md`/`lg` de `Button`/`AppModal` no son breakpoints. **Excepción única:** Envios · **Conductor** (lienzo fijo `w-[24rem]`, sin media queries).
4. **Cascarón.** Páginas a pantalla completa: `.area-page-shell` (opcional `bg-gris`). No duplicar `flex h-screen min-h-0 flex-col overflow-hidden`.
5. **Página con tabla.** `ClassicFilteredTableLayout` → `filters` = `FilterBar` `filtros-contenedor-tienda bg-card` → `children` = `.contenedor-tabla-gestion` + `Table` de `@/components/ui/table`. Padding horizontal lo pone el layout (`density` default `px-8`, `compact` `px-6`); vertical = `--espacio-filtros-vertical` (`.contenedor-pagina-con-filtros`). No repetir `px-*` ni `py-*` extra en filtros/tabla/children.
6. **Búsqueda.** `useFiltrosConBusqueda` + `FiltroBusquedaInput`. No reimplementar debounce ni foco. `matchByMultiTerm` (default: dígitos = token entero). Lista Clientes: `{ numericAsContains: true }` (CEL/CUIT por substring).
7. **Contorno de campos.** Todos los `Input`, `SelectTrigger`, `textarea` y combobox de valor llevan **línea 1px `--primary`** (`border-input`; token `--input` = `--primary`). No `border-border` ni `--gris-inset` en el recuadro del campo. Filtros: `.input-filtro-unificado` (mismo color + altura/tipo de filtro). Buscador del desplegable: `.select-search-input`. Superficie de lectura clicable (no CTA): `.boton-encubierto` (fondo transparente + mismo contorno; contenido centrado). Excepción: input **interno** de máscara/stepper (`border-0`) cuyo cascarón ya tiene el borde. Switch unchecked: `bg-gris-inset` (no `bg-input`).
8. **Selects / listas desplegables.** Prohibido `<select>` nativo y `<select multiple>`. Elegir **una**: `Select` shadcn (`SelectContent` con buscador **BUSCAR...**). Elegir **una o más**: `FiltroMultiSelect` (trigger `SELECT_TRIGGER_FILTER_CLASS` + panel portal `z-[90]` `role="listbox"` + `SelectSearchInput`; los checkboxes van **dentro** del panel). No lista siempre visible de opciones (`<ul>` de recuadros con `<input type="checkbox">`). Valor vacío del Select: sentinel `"none"` / `"todos"` (Radix no admite `""`). Triggers de filtro: `SELECT_TRIGGER_FILTER_CLASS` + `className="select-content-filtro"` `position="popper" side="bottom" align="start"`.
9. **Tablas.** Un solo look: `.tabla-gestion-compacta`. Encabezados **MAYÚSCULAS + negrita**. Celdas `.celda-datos`. Vacío = `""` (no `"-"`/`"—"`; `fmtCelda` / `fmtNumero` de `@/lib/format`). Scroll **solo** en `.contenedor-tabla-gestion` (el wrapper `data-slot="table-container"` **no** lleva `overflow-y-auto`). Sticky: `thead th`. 100 ítems/página (`PAGE_SIZE`). Botón solo ícono en fila: `variant="ghost"` `size="icon"` + `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS` (no `outline` + `icon-xs`). Columna tilde: encabezado = ícono `Check`. **Control de ítem** (checklist local): `TablaControlItemHead` + `TablaControlItemCelda`; no duplicar el badge. Caja `.tabla-check-toggle`: rectángulo borde `#0072bb`, fondo `card`; tilde `#0072bb` si es verdadero (no rellenar con `bg-primary`).
10. **Modales.** `AppModal` (o `ModalTablaConFiltros` si hay tabla seleccionable). Botones: `Button` shadcn (`default` / `outline`). Configuración TRUE/FALSE o SÍ/NO: `ModalSiNoChoice` (etiqueta MAYÚSCULAS + `Switch`; **sin** texto de ayuda). No pares de botones SÍ/NO ni Select SI/NO si el valor ya es booleano. Excepción: tri-estado o “debe elegir” sin default (Select). Labels de campo: `text-foreground` (`ModalMicroLabel`). No `max-w-*` extra si coincide con `size`.
11. **Texto.** Títulos de modal: MAYÚSCULAS. Botones: Title Case. Sidebar: módulo MAYÚSCULAS, submódulo Title Case. Filtros, placeholders y `TableHead`: MAYÚSCULAS. Abreviaturas con punto (Px., Cx., Dto., Cant., Cod.).
12. **Fechas de negocio.** `@/lib/fechaArgentina`. `@db.Date` → `isoYmdFromPrismaDateOnly` (no `dateToIsoYmdArgentina` sobre ese `Date`).
13. **Navegación interna.** `useRouter().push`, no `window.location.href`.
14. **Excepción hex (no copiar).** Solo **Balance mensual**: cabecera `#0072BB` + texto blanco; filas resultado `#a9d6f1` / `#063652`.
15. **Al cerrar.** Checklist **§4**. Clase global nueva → registrarla en **§2**.

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
- **`actions` del header:** `PageSectionHeader` las envuelve en `HeaderAccionesMenu`. En pantalla hay **un** botón **ACCIONES**; al hover (o foco) se despliega la lista de la ventana. No dejar una fila de botones sueltos en el header. Los call sites siguen pasando `Button` / `ToolbarActionButton` / triggers de modal como `actions`. Escape cierra el menú.
- `contentWidth`: `default` (`max-w-7xl`) | `wide150` (Comp. Categorías) | `full` (Balance, Gastos, Flujo, Calcular Lts, Px Tintométricos, Envios).
- El hueco encabezado → primer bloque lo pone `.contenedor-pagina-con-filtros` (`--espacio-filtros-vertical` = `1rem`). No añadir `py-4` en `children`.
- Card envolviendo tabla: `className={cn("card-tabla-envoltorio", "flex-1")}`.
- CFTL **sin** `filters`: Calcular Lts, Px Tintométricos, Cargar Gasto (card de cálculo / modal; acciones de editor en `actions`). Hubs vacíos: `return null`. Finder sin `FilterBar`: Catálogo Gastos, Comp. Categorías, Ideas Marketing. Envios · Programados abre el wizard de alta desde el header (sin finder de página).

### 1.2 Filtros

- `FilterBar` > `FilaFiltrosDesplegables` (default **5** columnas; `columnas={6}` solo con 6 Selects) + `FilterRowSearch` + `LimpiarFiltrosButton` (siempre visible).
- Si la pantalla usa **dos** `FilterBar` apilados, envolver ambos en `.filtros-doble-bloque-compacto` para compactar separaciones verticales y ganar filas visibles de tabla sin perder separación visual.
- Cada Select de página en `FiltroIndividualContainer`. En modal: `FiltroIndividualContainer` o `FiltroBusquedaInput` (X propia); no `LimpiarFiltrosButton`.
- Al limpiar un Select de filtros, el trigger debe volver a mostrar su placeholder (máscara). A nivel app, `Select` normaliza `value null/undefined` a `""` para evitar que quede renderizado el último valor elegido.
- Consistencia recomendada en call sites: preferir `value={estado ?? ""}` (en vez de `|| undefined` / `?? undefined`) cuando el estado representa “sin filtro”.
- Sin búsqueda: **una sola fila**. Acciones (`LimpiarFiltrosButton` + contador) en `FILTER_INLINE_ACTION_SLOT_CLASS` (a menudo `col-span-2` si hay ≤3 Selects). Con **5 Selects**, el slot va a la derecha del grid (`FilterRowSelection` `flex-nowrap` + `shrink-0`); **no** una segunda fila.
- Contador: `FILTER_COUNT_CLASS`, texto MAYÚSCULAS (`X PRODUCTO(S)`).
- Rango de fechas: `FilterRowDateRange` + `FiltroRangoFechasCalendarioModal`.
- Multi-select (página o modal): `FiltroMultiSelect` (trigger `<button>` `SELECT_TRIGGER_FILTER_CLASS` + panel portal `fixed z-[90]` `role="listbox"` + `SelectSearchInput`; `disabled?`). Vacío = placeholder. El mismo patrón a mano solo si ya existe (`MktMultiSelectCatalogo`, tipo de pedido, meses/años). No `<select multiple>`. No `<ul>` de checkboxes a la vista.
- Sucursal vacía en Vendedor (pedidos / stock): `useAplicarSucursalPreferidaSiVacia`. Opciones de sucursal de pedido: `sucursales` con `pedido = true`.

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

`AppModal`: `size` `sm|md|lg|xl` (md = `max-w-lg`), `padding`, `scrollBody` (default true), `hideBodyScrollbars`, `bodyShellClassName`. Tabla + pie fijo: tabla `flex-1 min-h-0`; no `h-0`. Wizard Envios · Nuevo Envío: `size="xl"` `h-[85vh]`. No apilar dos `Dialog` a la vez: el aviso **Transferencia Pendiente!** espera a que **Elegir Usuario** cierre (~450 ms) y usa un evento de ventana si hay navegación. **Stacking:** overlay/contenido `z-[80]` (por encima del typeahead `z-[70]`); `SelectContent` y panel de `FiltroMultiSelect` en modal `z-[90]` (portal). **Boolean / SÍ/NO:** `ModalSiNoChoice` (`label` MAYÚSCULAS + `Switch` a la derecha; fila `MODAL_BOOLEAN_SWITCH_*`; **sin** texto de ayuda bajo la etiqueta). No botones SÍ/NO ni Select SI/NO para un booleano conocido. Tri-estado o alta sin default (p. ej. Proveedor Mercadería, ¿discrimina IVA?) sigue en Select. **Catálogos «GESTIONAR…»** (modelo: Entidades): `AppModal` `size="lg"` título MAYÚSCULAS; buscador + `+` (`size="icon"` `h-10 w-10`); lista `border-border bg-card` con lápiz/tacho `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS` `h-9`; alta/edición/baja en `Dialog` hijo `size="sm"`; el padre **permanece abierto** tras CRUD (solo Cerrar / X). No usar `key` en el page client que remonte al `router.refresh()` del catálogo. Si hay `Dialog` hijo, ignorar el `onOpenChange(false)` del padre al cerrar el hijo. **Formas Pago** (`GestionarPagosFinAnaCosFinaModal`): mismo cascarón; **sin** arrastre. Alta/edición: **ENTIDADES** = `FiltroMultiSelect` (mín. 1) + **ACEPTA CUOTAS** = `ModalSiNoChoice`. No alta inline ni edición en la fila. **Tipo Caja** (`GestionarTesoreriaTipoCajaModal`): mismo cascarón; alta/edición en `Dialog` hijo (código enum + nombre). No alta inline ni edición en la fila.

### 1.5 Finder

`@/components/shared/catalogo-finder/` + `CATALOGO_FINDER_*` en `ui-classes`. Columnas con header `bg-primary` (`headerVariant="finder"` default), `+` (`nuevoLado`: `end` default, `start` en Ideas), `className?` para altura en modal. Wizard Envios: `headerVariant="titulo"` (título de paso, sin barra primary) **en todos los pasos** (SUCURSAL / CLIENTES / DIRECCIONES / FECHA / MERCADERÍA). Paso CLIENTE / DIRECCIÓN: `mostrarNuevo={false}` y CTA **Nuevo Cliente** / **Nueva Dirección** (`Button` `w-full` en wrapper `p-4`, no `rounded-none`) debajo de la lista. Filas: hover editar/eliminar por default; `eliminarSiempreVisible` deja el `Trash2` fijo a la derecha (`CATALOGO_FINDER_COLUMN_NOVO_BUTTON_CLASS`). En Envios · CLIENTE y DIRECCIÓN, `accionesSiempreVisibles`: lápiz + Trash2 siempre visibles (DIRECCIÓN también MapPin). Selección `CATALOGO_FINDER_ROW_SELECTED_CLASS`. `nombreAccion` opcional a la derecha del nombre (Envios · DIRECCIÓN: `MapPin`). `iconoIzquierda` opcional a la izquierda del nombre (Envios · PINTOR: `Users`, filtra asociados). Envios · CLIENTE: `reservarEspacioIconoIzquierda` reserva el hueco `size-7` en CONSUMIDOR_FINAL para alinear nombres. `etiquetaIzquierda` opcional: columna fija de etiqueta a la izquierda. `nombreSufijo` opcional: ` - texto` en `font-normal text-[0.75em]` (Envios · CONSUMIDOR_FINAL con pintor asociado). Envios · DIRECCIÓN: `nombreContenido` + `EnviosProyectoListadoLineas` (3 líneas: nombre / dirección / `(referencia)`). `nombre` = `etiquetaNombreProyecto` (aria). `nombreCentrado` centra el nombre (Envios · CLIENTE). Usos: Catálogo Gastos (5 cols), Comp. Categorías (4), Ideas (2), Envios · Crear Envío (finder 1 col por paso, dentro del wizard modal), Envios · Gestionar Direcciones (finder 2 cols CLIENTES | DIRECCIONES, dentro de `EnviosGestionarDireccionesModal`).

### 1.6 Sidebar y áreas

SSOT: `src/lib/main-app-areas.ts`, `administracionNav.ts`, `marketingRoutes.ts`, `facturacionRoutes.ts`, `Sidebar.tsx`.

| Área (UI) | id | Entrada |
|-----------|-----|---------|
| Vendedor | `gestion-productos` | `/` |
| Administración | `finanzas` (pide clave) | `/finanzas` |
| Marketing | `marketing` | `/marketing` |
| Facturación | `facturacion` (sin clave) | `/facturacion` |

**Vendedor** (acordeón, módulos cerrados al inicio): **ENVIOS** (Programados / Conductor) → **MERCADERÍA** (Cant. Pedida → Urgente / Tintométrico / Reposición → Generar Pedido → Recepción) → **PRECIOS** (Px Sugeridos, Px Tintométricos) → **CALCULAR LTS** → **STOCK** (Control Stock, Trans. Depósitos) → **CARGAR GASTOS** → **ASISTENTE IA**. Rol `simple` ve estos módulos; CRUD de prompts IA solo `editor`.

**Administración** (`AdministracionAccordionNav`): **FINANZAS** (TESORERIA → Fondos / Flujo De Fondos | BALANCE | OPERACIONES → COMPRAS / GASTOS | IMPUESTOS) → **LISTA PRECIOS** (PX TIENDA | PROVEEDORES | ANÁLISIS M.C.) → **VTAS. & COBROS** (Ptos. Vtas. / Cx. Fin. Cobros / Cobros & Cajas, pantallas directas) → **PEDIDO A FÁB.** → **ESTADÍSTICAS** → **USUARIOS**. Acordeón anidado: el grupo padre sigue abierto mientras un subgrupo hijo está expandido. **IMPUESTOS** agrupa Posición De IVA (`/finanzas/posicion-iva`).

**Marketing:** **PUBLICACIONES** (Calendario, Ideas Contenido, Objetivos) → **BASE MULTIMEDIA** (Base Multimedia, Colores Marca). Lectura libre; mutaciones `editor`.

**Facturación:** **COMPROBANTES** (Crear / Lista Comprobantes / Presupuestos) → **CLIENTES** (Lista Clientes). Lectura y emisión con `PERMISOS.facturacion.acceso` (`simple` o `editor`); sin clave de editor al entrar al área ni para generar comprobantes, NC o consultar ARCA. Asignable en Usuarios vía `modulos_permitidos` (`facturacion`).

**Dock** (abajo, `mt-auto`): Sync DUX (`SyncStatusIndicator` / `DuxSyncStyleButton`) → superficie sesión (`Pendientes` + usuario). El POST de sync lista tienda lee el JSON de error aunque el status no sea 2xx (no lo cuenta como fallo de red). Click en el nombre de usuario abre `Elegir Usuario`; en ese modal, el flujo es en 2 pasos dentro del mismo contenido (`Sucursal` → `Usuario`, sin abrir segundo modal). La clave de editor se pide **solo** al entrar a un módulo con `requierePassword=true` (Administración), no al seleccionar usuario para entrar a Vendedor. Si el usuario puede cambiar módulo, el ícono de módulo mantiene la apertura de `Cambiar Módulo` (lista = `modulos_permitidos` del usuario; al abrir el modal se re-sincroniza desde BD vía `listUsuariosParaInicioSesionAction` para reflejar altas como Facturación sin re-elegir usuario). Sync **no** se duplica en headers de página. Editor: modal Productos / Compras. Simple: sync productos. Import Excel: `ImportStatusIndicator` (independiente).

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
| Cx. Fin. Cobros | `/vtas-cobros/cx-fin-cobros` (alias `/finanzas/analisis-mc/costos-financieros`) |
| Cobros & Cajas | `/vtas-cobros/cobros-por-sucursal` |
| Pedido A Fáb. | `/pedido-a-fabrica` |
| Envios | `/gestion-productos/envios/programados` → `/envios/programados` |
| Conductor | `/gestion-productos/envios/conductor` → `/envios/conductor` (alias `/envios/crear`) |
| Comprobantes · Crear | `/facturacion/factura/crear` |
| Comprobantes · Lista Comprobantes | `/facturacion/factura/facturas` |
| Comprobantes · Presupuestos | `/facturacion/factura/presupuestos` |
| Clientes · Lista Clientes | `/facturacion/clientes/lista` |

Aliases viejos (`/pedidos/*`, `/proveedores`, `/proveedores/gestion`, `/finanzas/flujo-de-fondo`, …) **redirigen**; no crear páginas ahí.

### 1.8 Typeahead / combobox listbox

Patrón de lista de sugerencias bajo un input (`role="combobox"` + panel `role="listbox"`). Usado en Factura · Crear (productos y clientes).

- **Debounce:** `useFiltrosConBusqueda` (≥ 3 caracteres tipico).
- **Panel:** `TYPEAHEAD_LISTBOX_PANEL_CLASS` (`z-[70]`). Altura fija por defecto: `TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS` (`h-72`). **Estirar al bloque padre** (Factura · Crear productos): overlay `absolute inset-4` del contenedor `p-4` + `TYPEAHEAD_LISTBOX_PANEL_FILL_BLOCK_CLASS` (desde debajo del input hasta el margen inferior interior; tapa tabla y pie). Ancla: `TYPEAHEAD_LISTBOX_ANCHOR_CLASS` / abierto `TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS` (`z-[60]`) para quedar por encima de bloques vecinos. Ancho = input → `TYPEAHEAD_LISTBOX_PANEL_MATCH_INPUT_WIDTH_CLASS`; más ancho → `TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS`.
- **Lista:** `ul` con `TYPEAHEAD_LISTBOX_UL_CLASS` (`divide-y divide-primary/40` + scroll). Cuerpo con columnas: `TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS` (`bg-popover` sólido; no transparente).
- **Encabezado de columnas (opcional):** `TYPEAHEAD_LISTBOX_HEADER_CLASS` (altura `--tabla-thead-height`, `bg-primary` + `text-primary-foreground` + `text-xs font-bold` como thead de tabla) + grid propio del módulo. Celdas `TYPEAHEAD_LISTBOX_CELL_CLASS` (`w-full text-center` + ellipsis). Con columnas: header **sticky** dentro de `TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS` (mismo ancho que las filas; el scrollbar no desfasá). En productos, **STOCK** centra el par cantidad/`AlertTriangle` + `Store` bajo el encabezado (`justify-center`); el valor va en un hueco fijo `w-[2.75rem]` para que los `Store` queden alineados entre filas. `Store` es un recuadro `size-5`: **fondo `primary`** si hay stock en otra sucursal (`TYPEAHEAD_STORE_BTN_STOCK_OTRA_CLASS`); **fondo `destructive`** si no hay (`TYPEAHEAD_STORE_BTN_SIN_STOCK_OTRA_CLASS`); glifo `TYPEAHEAD_STORE_ICON_CLASS` (`size-3`, trazo claro). Click abre el detalle por sucursal. En clientes: mismo cascarón (header sticky + `ul` `flex-none overflow-visible`); grid `CLIENTE` / `SALDO` / `PINTOR`.
- **Fila:** `li role="option"` → **`div role="button" tabIndex={-1}`** con `TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS` + activo `TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS` (`bg-accent` sólido, no `/60`). **No** usar `<Button>` ni `<button>` para la fila completa (sí un `Button` `size="icon"` anidado si hace falta, p. ej. stock).
- **Cierre:** click fuera del wrap; Escape; al elegir.
- **Stacking:** si el listbox queda bajo otra zona (p. ej. remito Factura `z-30`), subir el **card de cabecera** al abrir (`TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS` = `relative z-[60]`). En Factura · Crear · CLIENTE el panel flota sobre el bloque de líneas; sin subir la card se ve el remito encima y la lista parece transparente.

Constantes: `@/lib/ui-classes` (`TYPEAHEAD_LISTBOX_*`).

---

## 2. Catálogo

### 2.1 Clases globales (`globals.css`)

| Clase | Uso |
|-------|-----|
| `.area-page-shell` | Cascarón de página |
| `.contenedor-pagina-con-filtros` | Gap header / filtros / tabla |
| `.section-header` + `__titulo` `__subtitulo-*` | Encabezado. `z-index: 50` para que el menú ACCIONES cubra filtros/tabla |
| `.header-acciones-menu` `.header-acciones-trigger` `.header-acciones-panel` `.header-acciones-list` `.header-acciones-item` | Menú **ACCIONES** del header (`HeaderAccionesMenu`). Panel abierto `z-[90]`; lista con `divide-y divide-primary` entre opciones |
| `.filtros-contenedor-tienda` `.filtros-doble-bloque-compacto` `.input-filtro-unificado` `.select-content-filtro` `.select-search-input` `.fila-filtros-4\|5\|6` `.filtro-individual-*` `.filtro-count-label` | Filtros. Contorno de `.input-filtro-unificado` / `.select-search-input` = `--primary` (misma regla que `Input`) |
| `.contenedor-tabla-gestion` (+ `--pie-fijo`, `--mc-overlay`, `no-scroll-x`) | Scrollport de tabla |
| `.card-tabla-envoltorio` | Card alrededor de tabla |
| `.tabla-gestion-compacta` `.celda-datos` `.tabla-check-toggle` `.tabla-row-btn-filled-brand` `.tabla-bloque-secundario-*` `.tabla-fila-seccion-subencabezado*` | Tablas |
| `.modal-app` / `.app-modal` `.modal-micro-label` `.modal-field-label` | Modales |
| `.sidebar-nav-*` `.sidebar-user-switcher-surface` | Sidebar |
| `.finanzas-resumen-tarjeta` | Totales Finanzas |
| `.no-scrollbar` | Oculta barra; mantiene scroll |
| `.btn-primario-gestion` | CTA toolbar legacy; nuevas toolbars → `ToolbarActionButton` |
| `.boton-encubierto` | Botón de lectura (no CTA): fondo transparente + contorno `1px` `--primary`; contenido centrado. Factura · Crear visor de cabecera. |
| `--gris` `--gris-inset` `--primary` `--input` | Lienzo / inset / marca. `--input` = contorno de campos (`1px` `--primary`; Tailwind `border-input`). `--border` sigue gris (cards, tablas). |

Variantes de tabla (misma familia compacta): `tabla-flujo-de-fondo`, `tabla-deuda-proveedores`, `tabla-recepcion-pedido`, `tabla-est-carga-datos`, `tabla-px-competencia-listado`, `tabla-px-listas-*`, `tabla-fin-ana-margen-contribucion`, `tabla-vinculos-modal`, `tabla-tienda-listado`.

### 2.2 `@/lib/ui-classes`

Éxito/aviso: `BADGE_SUCCESS_TINT_CLASS`, `TEXT_SUCCESS_CLASS`, `TEXT_WARNING_CLASS`, `ICON_WARNING_INTERACTIVE_CLASS`, `CALLOUT_WARNING_CLASS`, `IMPORT_STAT_BADGE_CLASSES`. Finder: `CATALOGO_FINDER_*`. Tabla: `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS`, `TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS`, `TABLE_ROW_ACTION_ICON_CLASS`, `TABLA_CONTROL_ITEM_*`. Header ACCIONES: `HEADER_ACCIONES_*`. Balance modales: `BALANCE_MODAL_*`. Labels: `MODAL_MICRO_LABEL_CLASS`. Boolean modal: `MODAL_BOOLEAN_SWITCH_ROW_CLASS` / `MODAL_BOOLEAN_SWITCH_LABEL_CLASS` (`ModalSiNoChoice`). Typeahead listbox: `TYPEAHEAD_LISTBOX_*` (**§1.8**; ancla abierta `z-[60]`, panel `z-[70]`; celdas `TYPEAHEAD_LISTBOX_CELL_CLASS`). Store productos: `TYPEAHEAD_STORE_BTN_*` / `TYPEAHEAD_STORE_ICON_CLASS`.

### 2.3 Shared (`src/components/shared/`)

Nuevo shared: CVA + tokens + `"use client"` solo si hay estado/hooks. Documentar aquí.

| Componente | Rol |
|------------|-----|
| `ClassicFilteredTableLayout` | Template página. Props: `title`, `subtitle?`, `subtitleSecondary?`, `actions?` (menú **ACCIONES**), `filters?`, `children`, `tone` gray\|card, `contentWidth`, `density` |
| `ClassicPageHeader` / `SectionHeader` | Header. Núcleo `PageSectionHeader`. `actions` → `HeaderAccionesMenu` |
| `HeaderAccionesMenu` | Botón **ACCIONES** + lista hover/foco. Aplana `<>` y un `div` flex de botones. Abierto: por delante de filtros/tabla (`z-[90]`). Separadores `primary` entre ítems. No usarlo a mano si ya pasa por el header |
| `AppModal` | Modal estándar. `title`, `children`, `actions`, `size`, `padding`, `scrollBody`, `hideBodyScrollbars` |
| `ModalTablaConFiltros` | Modal tabla + filtros. `selectionMode`, `columns`, `rows`, `getRowId` |
| `FiltroBusquedaInput` | Búsqueda con debounce (junto al hook) |
| `TableEmptyState` | Vacío (`tableCell` \| `panel` \| `compact`) |
| `PaginacionTabla` / `PaginacionClient` | Paginación URL vs callback |
| `ToolbarActionButton` | Toolbar ícono + label + `loading`. No en botones solo ícono |
| `DuxSyncStyleButton` | Dos líneas + swap hover (Sync slidenav) |
| `MensajeProceso` | “X de Y” / sidebar |
| `ModalMicroLabel` / `ModalSiNoChoice` / `ModalFeedbackRegion` | Labels; **TRUE/FALSE SÍ/NO** (`ModalSiNoChoice`: etiqueta MAYÚSCULAS + Switch, sin ayuda); feedback |
| `MontoArInput` / `MontoArSaldoEnteroInput` / `PorcentajeCentInput` / `PorcentajeEnteroMaskInput` / `PxListaEnteroInput` | Máscaras AR. `MontoArInput` `allowNegative` en TOTAL PEDIDO de recepción. `PorcentajeCentInput` `allowNegative` + sufijo `%` fijo (`.input-mascara-sufijo`, no editable) en VARIACIÓN de Edición Masiva. |
| `SelectSearchInput` | Buscador de desplegables |
| `FiltroMultiSelect` | Lista desplegable de **una o más**. Trigger `SELECT_TRIGGER_FILTER_CLASS` + panel portal `z-[90]` `role="listbox"` + `SelectSearchInput`. Checkboxes solo dentro del panel. Vacío = placeholder. `disabled?`. Página (filtros) y modal (p. ej. ENTIDADES de Formas Pago) |
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

- **Lista Precios** (`/proveedores/lista-precios`): header **Exp. Lista** = `Upload` (flecha arriba); **Imp. Lista** = `Download` (flecha abajo) (`ImportarListaPreciosModal`: booleanos **LOS DATOS TIENEN ENCABEZADOS** / **HABILITADO** / **PRECIO EN DÓLARES** con `ModalSiNoChoice`). botón **Edición Masiva** (`EdicionMasivaListaPreciosModal` modo header): PROVEEDOR obligatorio, MARCA opcional, RUBRO opcional (Select habilitado solo con MARCA), VARIACIÓN ± % 2 dec. obligatoria (`PorcentajeCentInput` `allowNegative`, sufijo `%` fijo no editable). Confirmar aplica `px_lista_proveedor * (1 + variación/100)` (piso 0; p. ej. $100 y 4% → $104; −4% → $96). No exige filtro de página. El lápiz de fila es SET de marca/rubro/px lista. **ACCIONES**: Descuentos (%) → Editar → Vincular REX → Borrar. **Descuentos Aplicados** (ícono %): `AppModal` `size="sm"` + `max-w-[33.6rem]` (20 % más ancho que `sm`). Encima: nombre del ítem (`descripcion`). **PX. PROMO FIJO** centrado (bloque 70 %, `py-5` entre nombre y tabla; moneda del ítem; tacho a la derecha). Tabla compacta 40 % | $ 30 % | % 20 %: **PX. LISTA**; descuentos (`−$` / %) y recargos (`+$`; Cx. Transporte sí suma sobre promo) separados por una línea fina `border-primary` (sin filas de sección). Con promo, las reglas de descuento se muestran tachadas (`text-muted-foreground line-through`) para comparar vs **DESC. PX. PROMO FIJO** (lista − promo y % sobre lista). Flechas: abajo `text-primary`, arriba `text-destructive`. Números en `text-foreground`. Columna %: valor + flecha al centro, ícono Info fijo a la derecha (`h-7 w-7`; hueco vacío en filas sin info). **PX. FINAL** en `TableFooter` (`bg-muted`, borde `primary`).

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

- **Envios · Cliente Cons. Final:** en `CrearEditarClienteModal`, debajo de **NOMBRE COMPLETO** hay una casilla `Cargar como CONS. FINAL`. Al activarla, el input de nombre se bloquea mostrando `CONS. FINAL`, el payload persiste `nombre_completo=""` y `CEL` pasa a obligatorio. **CUIT** (máscara `##-########-#`): botón `RefreshCw` **dentro** del input (mismo inset que el `+` de CLIENTE en Factura: wrapper `absolute inset-y-[0.2rem] right-[0.3rem] aspect-square`, `size="icon-xs"` `variant="default"` `size-full p-0 shadow-none`; no `size="icon"`). Al hacer click con CUIT válido (11 dígitos + DV) consulta `GET /api/arca/constancia` y precarga NOMBRE + CONDICIÓN IVA (quita CONS. FINAL si venía marcado). El ícono gira mientras consulta.

- **Balance mensual:** CSS Grid (concepto + Global + sucursales `genera_balance`). Filas `h-10`. Hex de informe (**Guía para IA** punto 14). Ventas solo lectura desde `fin_bal_vtas` (carga en Ventas Mensuales). Drill-down: historial → clic barra (CV/CF) → rubros; footer **Volver**. Filtros mes/año + cesto → periodo AR actual. `contentWidth="full"`.
- **Gastos:** filtros sucursal/proveedor/rubro/gasto/estado + año/mes (mes multi). ESTADO: CON MONTO Y PAGADO → CON MONTO Y PENDIENTE → SIN MONTO → SIN MONTO O PENDIENTE. Totales en `.finanzas-resumen-tarjeta`. `TablaGastos` usa `<table>` nativo (excepción). **ACCIONES**: lápiz (monto/pago) + borrar imputación + gráfico de evolución mensual (sin columna HISTORIAL).
- **Ventas Mensuales:** una fila por mes/año desde el mes calendario AR actual hasta la carga más antigua (`fin_bal_vtas`), inclusive los meses sin monto. Columnas **MES** + sucursales `genera_balance` + **ACCIONES** (Cargar / Editar / Eliminar; Cargar se deshabilita si todas las sucursales ya tienen monto). Filtros MES / AÑO / SUCURSAL + contador de periodos. Sin botón de header: Cargar/Editar abren `CrearFinBalVtasModal` con periodo fijo. Eliminar borra el periodo completo (`eliminarFinBalVtasPorPeriodoAction`).
- **Posición De IVA:** sidenav **FINANZAS → IMPUESTOS** (un solo destino: el grupo es link directo a `/finanzas/posicion-iva`; alias `/finanzas/balance/posicion-iva` redirige). Sin modal de importar IVA débito (TXT alícuotas); ACCIONES editor = saldo manual.
- **Fondos** (sidenav **TESORERIA → Fondos**; ruta `/finanzas/tesoreria`): 4 filtros en una fila (`columnas={4}`: **TIPO CAJA** / **ENTIDAD** / **SUCURSAL** / **TITULAR**); limpia cada uno con `FiltroIndividualContainer` (sin `LimpiarFiltrosButton` global ni filtro TIPO DE VALOR). Pie una fila de tarjetas por tipo de valor (EFECTIVO / DIGITAL / CHEQUE). Cheques: tenencia ACTUALES / TRANSFERIDOS. TIPO CAJA en pantalla: `EFECTIVO` → **CAJA LOCAL**; `TARJETAS_A_COBRAR` → **TERMINAL DE PAGO** (`etiquetaTipoCajaEnPantalla`). Tabla: **TIPO CAJA** | **ENTIDAD** | **SUCURSAL** | **TITULAR** | **MONTO** | **ACCIONES** editor (cheques / monto + lápiz + tacho `EliminarCajaTesoreriaModal`; sin columna ÚLT. ACT. ni alerta por desactualización). **Ledger en curso:** tabla `tesoreria_movimientos` (Cobro / NC venta / Pago / Arqueo / Transferencia entre cajas); el saldo por movimientos aún no reemplaza el MONTO editable en UI. Alta/edición (`CREAR CAJA` / `EDITAR CAJA`): orden **TIPO DE CAJA** → **ENTIDAD** (Select ancho completo, **sin** botón `+`; alta de entidad = **Gestionar Entidad** del header) → **SUCURSAL** (salvo CHEQUE) → **TITULAR** → **TIPO DE VALOR** (**FÍSICO** = enum `EFECTIVO`, **DIGITAL**; sin opción CHEQUE — si el tipo de caja es CHEQUE el valor se persiste implícito). titular = `global_personal` con `titular_financiero`. Tenedor de cheque: misma lista de personal. Sin columna ni totales por `disponibilidad`. Header editor (**ACCIONES**): **Gestionar Tipo Caja** (`GestionarTesoreriaTipoCajaModal`, mismo patrón de catálogo §1.4) · **Gestionar Entidad** (mismo `GestionarMarcasFinAnaCosFinaModal` que Cx. Fin. Cobros; catálogo `tesoreria_cobros_entidades`) · **Gestionar Titulares** (`GestionarTesoreriaTitularesModal`, mismo que Ptos. Vtas.) · **Nueva Caja**.
- **Flujo De Fondo:** `/finanzas/venc-por-fecha` (`TablaFlujoDeFondo`). SALDO negativo: `text-destructive` en la celda. Doble clic → detalle día. **No** usar `/finanzas/flujo-de-fondo` (redirect).
- **Venc. Provee. Merc. / Gastos:** doble clic → mismo detalle de flujo filtrado por proveedor.
- **Comprobantes** (`/finanzas/control-comprobantes`): filtros + rango fechas. Columna **PROVEEDOR** = `prefijo` (tooltip = nombre). Columna **SALDO** = total − monto aplicado. Columna **PLAZO** = plan efectivo (`30, 60, 90`). Header (editor): **Gestionar Venc.** → modal con hasta 4 plazos por proveedor mercadería. **ACCIONES**: Controlado + Plazo De Pago (plan proveedor o personalizado hasta 4 cuotas iguales; pagos FIFO).
- **Ptos. Vtas.** (`/vtas-cobros/ptos-venta`, alias `/finanzas/fact-cobros`): sidenav **VTAS. & COBROS → Ptos. Vtas.** Header **VTAS. & COBROS** / Ptos. Vtas. Header **Reglas Ptos. Vtas.** (`ToolbarActionButton` + `ListOrdered`; todos los roles con acceso): `ReglasPtosVtasModal` (`AppModal` `size="md"`) lista ordenada desde SSOT `@/lib/ptoVtaReglas` (`PTO_VTA_REGLAS`): 1 **SUCURSAL** (pto habilitado para la sucursal que emite) → **FACTURA FISCAL** 2 **RESPONSABLE INSCRIPTO** (cliente RI → pto. vta. RI). Editor: **Gestionar Titulares** (`ToolbarActionButton` + `Users`) abre `GestionarTesoreriaTitularesModal` (`AppModal` `size="lg"`; catálogo `tesoreria_titulares.nombre` MAYÚSCULAS; alta/edición/baja). Editor: **Crear Punto De Venta** (`ToolbarActionButton`). Tabla catálogo `ptos_vtas`: **N° PUNTO** | **TITULAR** | **SUC. ASOCIADAS** (nombres vía `global_pto_vta_sucursales`; varias unidas con `, `) | **CUIT** | **IIBB** (cuenta) | **CONV. MULT.** (`SI`/`NO` de `ii_bb_multilateral`) | **DOM. COMERCIAL** | **INICIO ACT.** | **ACCIONES** editor (lápiz + tacho). Búsqueda `useFiltrosConBusqueda` + `FiltroBusquedaInput`. Alta/edición: `GestionarGlobalPtoVtasModal` (`size="lg"`; `pto_venta` CHAR(5); **Titular** = Select `tesoreria_titulares`; CUIT 11 dígitos; IIBB; **IIBB multilateral** = `ModalSiNoChoice` **IIBB MULTILATERAL**; **Condición IVA** = Select `condicion_iva_cod_arca`; domicilio; inicia actividad `YYYY-MM-DD`; **SUC. ASOCIADAS** solo `sucursales.genera_est`). Baja: modal confirmar. **Sin** totales DUX (`fin_fact_cobros_pto_vta_mes` eliminada).
- **Cx. Fin. Cobros** (`/vtas-cobros/cx-fin-cobros`, alias `/finanzas/analisis-mc/costos-financieros`): sidenav **VTAS. & COBROS → Cx. Fin. Cobros**. Header **VTAS. & COBROS** / Cx. Fin. Cobros. Filtros en `FilaFiltrosDesplegables` (5 columnas, orden fijo, **una sola fila**): **HABILITADO** (`si`/`no` → HABILITADO / NO HABILITADO) · **FORMA DE PAGO** · **ENTIDAD** · **CUOTAS** (`cobros_cuotas.id` vs `cuota_id`) · **IMP. CHEQUE** (`si`/`no` → SI / NO). Contador **X COMBINACIÓN** / **X COMBINACIONES** + `LimpiarFiltrosButton` a la derecha en `FILTER_INLINE_ACTION_SLOT_CLASS` (mismo `FilterRowSelection` `flex-nowrap`; no segunda fila). Matriz **FORMA DE PAGO × ENTIDAD [× CUOTA]** (`cobros_cx_fin` ex `fin_ana_cos_fina`: `pago_id` → `cobros_forma_pago`, `terminal_id` → `tesoreria_cobros_entidades`, `cuota_id` → `cobros_cuotas` si `acepta_cuotas`). Columnas: **HAB.** | **FORMA DE PAGO** | **ENTIDAD** | **CUOTAS** (etiqueta `cobros_cuotas.cuotas` o `—`) | **DÍAS DE ACREDITACIÓN** | **ARANCEL** | **CX FINANCIERO** | **IMP. CHEQUE** | **CX TOTAL S/ IVA** | **CX TOTAL C/ IVA**. Orden alfabético de filas: **FORMA DE PAGO** → **ENTIDAD** → **CUOTAS**. **GESTIONAR ENTIDADES** / **GESTIONAR FORMAS PAGO** / **GESTIONAR CUOTAS** / **Cálculo Cx. Total** (menú ACCIONES). Formas Pago: mismo patrón de catálogo que Entidades (§1.4); **sin** arrastre/orden (Margen Contribución ordena columnas alfabéticamente). Alta/edición: **ENTIDADES** = `FiltroMultiSelect` (N:M `cobros_forma_pago_entidades`, mín. 1; no lista visible de checkboxes) + **ACEPTA CUOTAS** (`ModalSiNoChoice`, `acepta_cuotas`); la lista del catálogo muestra las entidades asociadas. **Gestionar Cuotas:** texto libre MAYÚSCULAS (ej. `01`, `03`, `06 PROMOCION`); sin columna `orden`.
- **Cobros & Cajas** (`/vtas-cobros/cobros-por-sucursal`): sidenav **VTAS. & COBROS → Cobros & Cajas**. Header editor **ACCIONES → Crear Cobro** (`ToolbarActionButton` + `Plus` → `CrearEditarCobroModal`: **FORMA DE PAGO** · **ENTIDAD** (solo N:M de la forma) · **CAJA VINCULADA** (define la sucursal; misma entidad; no CHEQUE) · **OBSERVACIÓN** texto libre). Filtros `FilaFiltrosDesplegables` `columnas={5}` (una sola fila): **FORMA PAGO** | **ENTIDAD** | **SUCURSAL** + contador `X COBRO(S)` (`FILTER_COUNT_CLASS`) y `LimpiarFiltrosButton` en `FILTER_INLINE_ACTION_SLOT_CLASS` `col-span-2`. Sin segunda fila de conteo. Tabla: **FORMA PAGO** | **ENTIDAD** | **SUCURSAL** | **OBSERVACIÓN** | **ACCIONES** editor (lápiz + tacho). Cada fila = un registro `cobros_vinc_cajas` (una sola sucursal). La misma forma × entidad puede repetirse en otra sucursal como otra fila (ej. TERMINAL × PAYWAY en SUC1 y otra vez en SUC2). UNIQUE `(pago_id, entidad_id, sucursal_id)`.
- **Catálogo Gastos:** Finder 5 columnas. Proveedores no-mercadería desde header.
- **Margen Contribución:** `/finanzas/analisis-mc/margen-contribucion`; overlay COSTOS (`.contenedor-tabla-gestion--mc-overlay`). **GESTIONAR FORMAS PAGO** (ACCIONES): mismo cascarón de catálogo que Entidades; columnas de formas de pago en orden alfabético por nombre (sin arrastre).
- **Usuarios:** búsqueda + tabla (NOMBRE / ID DUX / SUCURSAL POR DEFECTO / MÓDULOS PERMITIDOS / TITULAR FINANCIERO). Header editor **Crear Usuario** (nombre; **ID DUX** opcional; sucursal opcional **SIN SUCURSAL**; módulos mín. 1; titular financiero **TITULAR FINANCIERO** (`ModalSiNoChoice`); `id_personal` lo asigna la BD). Edición: ID DUX y sucursal opcionales. ACCIONES editor: lápiz + tacho (`EliminarUsuarioModal`; no borra si es titular/tenedor de tesorería). Sin sucursal no aparece en el modal de inicio.

### Estadísticas / Pedido A Fáb.

- **Carga De Datos:** grilla periodo × sucursal (`tabla-est-carga-datos`); celda pendiente `.celda-est-carga-pendiente`.
- **Configuracion:** `FilaFiltrosDesplegables` `columnas={6}` + búsqueda. Marca / rubro / sub rubro / color / terminación / presentación: `FiltroMultiSelect` (OR dentro de cada dimensión).
- **Ventas:** dos FilterBar + tres gráficos (clases `.est-vtas-*`). Fila 2: mismos 6 filtros multi (`FiltroMultiSelect`; OR dentro de la dimensión). Gráfico 1 y Top 10: `%` = Un. ítem / Un. total de los filtros actuales (`fmtPctParticipacion`; en desglose del gráfico 1 cada hijo sobre ese total, no sobre el padre). Un. / TO. se muestran enteros (`fmtNumero`); el % no lleva sufijo (el encabezado ya es **%**). Gráfico 1: Un. / % centrados (`text-center` encabezado y dato), datos `text-foreground`, encabezados `font-bold`. Top 10: el denominador incluye productos fuera del top.
- **Pedido A Fáb.:** dos FilterBar. Fila 1: PROVEEDOR / FECHA DE PEDIDO / TIEMPO STOCKEO (días calendario; 30 calendario = 24 hábiles de venta en CANT. SUG.) / **PROD. VINCULADO** (SI/NO en servidor: hay fila `prod_tienda` vía `cod_tienda`; sin elegir = todos) / STOCK QUEBRADO (solo filtra si SI/NO está elegido; **no** hay columna QUEBR. en la grilla). Fila 2: MARCA / RUBRO / SUB-RUBRO / **PEDIDO** (SI/NO en servidor: SI = `CANT. PED.` persistida > 0 en `prod_ped_merc` A FÁBRICA; overlay local si se edita la cantidad). Secciones: **STOCK** (una columna, `rowSpan={2}`: grupo centrado cantidad + Info; número `min-w-[2.75rem] text-right tabular-nums` + `gap-3` para alinear cifras e íconos sin pegarlos al borde derecho) y **COMPRA** (FORMA **BULTO**/**UNIDAD** | BULTO si vínculo `cod_tienda` | `CANT. PED.` `EnteroStepperInput` en orden `- | input | + | check | borrar` (check copia CANT. SUGERIDA y borrar limpia el valor) | `CANT. SUG.`: UNIDAD techo entero; BULTO techo al múltiplo de `prod_tienda.bulto`). Quiebre = `UN. ACT. ≤ 0` o `Stock Hasta Llegada De Pedido ≤ 0` (`esStockQuebradoPedidoAFabrica`; solo el filtro). Si **FECHA DE PEDIDO** está vacía, el cálculo inicial usa hoy (AR) como base y proyecta provisión hasta `tiempo_entrega_en_dias`. Modal de soporte: título `INFO FORMULAS` y fórmulas alineadas a la lógica vigente de provisión/quiebre/cant. sugerida. Última columna de acciones: Info de PROM. VTA. por sucursal (modal `SUCURSALES` + `PROM. VTA POR DÍA` 1 decimal = ventas 2 meses / 48). Info de **STOCK**: modal solo sucursales con `id_deposito` (`prod_tienda_stock.stock_real` + TOTAL). Info final: PROM. VTA. de sucursales `genera_est`. DESCRIPCIÓN = `descripcion_tienda` si hay vínculo, si no `descripcion_proveedor`. Header `GenerarPedidoToolbarButton` `modulo="a-fabrica"`.

### Marketing

SSOT `MARKETING_ROUTES`. Calendario: grilla mes + Cuadro De Mando; ícono red `MktRedSocialIcon`. Ideas: Finder 2 columnas. Objetivos: 3 ejes × semanal/mensual. Base Multimedia / Colores Marca: tablas CFTL. Export: `ExportarMktSeccionesGoogleSheetsButton`.

### Facturación

SSOT `FACTURACION_ROUTES` (`src/lib/facturacionRoutes.ts`). Módulos sidenav **COMPROBANTES** (Crear / Lista Comprobantes / Presupuestos) y **CLIENTES** (Lista Clientes). **Lista Clientes** (`FacturaClientesListaPageClient`): CFTL + `FilterBar` + búsqueda (`useFiltrosConBusqueda` / `FiltroBusquedaInput` por nombre, CUIT, CEL, tipo o proyecto; `matchByMultiTerm` con `numericAsContains` para que `2663` matchee un CEL que lo contiene). CRUD de cliente con el mismo `CrearEditarClienteModal` (PROYECTOS en lugar de DIRECCIONES; cada proyecto en 3 líneas: nombre / dirección / `(referencia)`). Si el cliente tiene **más de un** `clientes_proyectos`, chevron en ACCIONES abre subfilas `FacturaClienteProyectosDetalle` (mismas clases `tabla-fila-detalle-competencia*` que Cx Compra): nombre **negrita** centrado entre filas (columna ancha al mayor nombre) + ` - ` + dirección alineada a la izquierda; lápiz/Trash2 en ACCIONES + fila **CREAR PROYECTO**. Si el tipo es **PINTOR**, ACCIONES muestra `Users`: abre `FacturaClienteAsociadosDetalle` con los `CONSUMIDOR_FINAL` cuyo `pintor_asociado` es ese pintor (vacío = `NO HAY CLIENTES ASOCIADOS.`). Modal de proyecto: `CrearEditarEnviosDireccionModal` (campo **NOMBRE PROYECTO** MAYÚSCULAS). **Crear** (`FacturaCrearPageClient`): header solo **Generar Comprobante** (`ToolbarActionButton`; `loading` mientras emite). **Crear Cliente**: botón `+` (`Button` `variant="primaryIcon"` `size="icon-lg"` `className="filtro-individual-clear-btn"`) **dentro** del input **CLIENTE** (mismo patrón que el tacho de **Limpiar búsqueda** del buscador de productos: el wrap lleva `filtro-individual-container` para que el CSS globale (`right: 0.3rem; top/bottom: 0.2rem`) lo deje dentro del `h-9`; no `size-7` ni `-translate-y-1/2`; no usar `size="icon"` — inyecta `size-9` y se sale del `h-9`; no addon pegado al borde; abre el mismo `CrearEditarClienteModal` que Envíos: nombre, CONS. FINAL, CEL, **CUIT** máscara `##-########-#` (botón `RefreshCw` inseto: consulta ARCA y precarga nombre + cond. IVA), **CONDICIÓN IVA** default CF, tipo, pintor, proyectos). Action `crearClienteAction` / `editarClienteAction` (`requireClientesMutacion`: Envíos o Facturación). Campo **CLIENTE**: valor por defecto `CONSUMIDOR FINAL` (al foco se **borra**; al blur vacío vuelve a CF; al tipear ≥ 3 caracteres busca). Typeahead (**§1.8**; ≥ 3 caracteres) → `buscarClientesFacturaAction` (nombre/cel/cuit **o nombre del pintor asociado**; solo clientes con `nombre_completo` no vacío); panel **más ancho** que el input (`TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS`); al abrir, la card de cabecera toma `TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS` (`z-[60]`) para quedar sobre el bloque de líneas (`z-30`; si no, la lista se ve transparente); mismo cascarón que productos (`TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS` + header sticky `CLIENTE` / `SALDO` / `PINTOR` + celdas `TYPEAHEAD_LISTBOX_CELL_CLASS`; saldo pendiente placeholder vacío; pintor en columna, vacío = `""`); click/Enter/`+` precarga nombre + `cliente_id` (`onPointerDown` `preventDefault` para no perder el foco). CUIT y COND. IVA del receptor **no se editan** en Crear: los toma el servicio del cliente (o CF). Texto distinto de `CONSUMIDOR FINAL` sin ítem elegido (p. ej. «MAT») es inválido: no emite (`mensajeClienteFacturaNoSeleccionado`). Generar Comprobante → persiste (quien tiene el módulo) y, si el tipo es fiscal, autoriza CAE; luego `FacturaGenerarComprobanteModal` (Imprimir / Descargar / Imprimir & Descargar; si hay CAE muestra N° + CAE + vto.). PDF jsPDF vía `generarPdfFacturaComprobante` + `facturaComprobantePdfClient`; el PDF fiscal incluye CAE/vto. Nombre `Cliente - dd-mm-aa - {últimos 4 del N°} - (Comentarios).pdf`. Cabecera en card (sin `py-*` extra: el CFTL ya aplica `--espacio-filtros-vertical`) — **editor** (default) vs **visor** (una fila). Editor: **2 filas fijas** (grid; si un campo no aplica queda `invisible` y reserva el hueco): (1) FECHA `10.5rem` + TIPO COMPROBANTE y CONDICIÓN FISCAL **mismo `1fr`** + Comentarios; (2) CLIENTE y PROYECTO CLIENTE **mismo `1fr`** + SALDO CLIENTE `10.5rem` (placeholder vacío). TIPO = PRESUPUESTO / VENTA / NOTA DE CRÉDITO; CONDICIÓN FISCAL solo visible en Venta o NC; PROYECTO solo visible si hay **más de un** proyecto (`+` `filtro-individual-clear-btn` igual que CLIENTE → `CrearEditarEnviosDireccionModal` del cliente elegido; sin `cliente_id` toast `MENSAJE_CLIENTE_FACTURA_NO_SELECCIONADO`; al guardar se agrega a la lista y queda seleccionado). PTO. VTA. queda en estado (primer punto) sin mostrarse en estas filas; CBTE. ASOC. si NC. El persistido sigue siendo `FacturaTipo` (`facturaTipoDesdeClaseYFiscal` / `claseDesdeFacturaTipo` en `@/lib/factura`). Visor: `Fecha | Tipo - Condición | Cliente - Proyecto | Comentarios` en `.boton-encubierto` (lectura clicable: fondo transparente + contorno `--primary`); clic (lápiz) vuelve a editor; foco en el buscador de productos pasa a visor. Comentario: vacío = trazo `fill-none`; con texto = `fill-primary`. Receptor fiscal = snapshot `receptor_*` en `comprobantes_vtas` (CUIT + cond. IVA del cliente; si faltan → CF) + FK opcional `cliente_id` → `clientes` + FK opcional `proyecto_id` → `clientes_proyectos` (si hay proyecto: 1 se autocompleta; >1 Select **PROYECTO CLIENTE**; CF sin catálogo = null). Segundo bloque (`FacturaCrearLineasBlock` + `onRemitoChange`): lupa (avanzada stub) + input (tacho `filtro-individual-clear-btn` si hay texto; vacía q, cierra lista y deja el foco); la **lista** (`TYPEAHEAD_LISTBOX_PANEL_FILL_BLOCK_CLASS` en overlay `inset-4` del bloque `p-4`: desde debajo del input hasta el margen inferior interior, tapa tabla y pie; encabezado `TYPEAHEAD_LISTBOX_HEADER_CLASS` altura `--tabla-thead-height` + celdas `TYPEAHEAD_LISTBOX_CELL_CLASS` + `[scrollbar-gutter:stable]` en header y `ul`; filas `py-0` + `divide-y divide-primary/40`, datos `text-foreground`) solo se abre con **≥ 3 letras** (COD. / DESCRIPCIÓN / PRECIOS / STOCK: par centrado bajo el encabezado; valor en hueco `w-[2.75rem]` + `Store`); stock local `0` → `AlertTriangle` `text-destructive`; `Store` recuadro `primary` si hay stock en otra sucursal, `destructive` si no. click fila = agregar **siempre una fila nueva** (mismo COD. → otra línea; no suma cantidades; cierra + foco CANTIDAD con select; **Enter** en cantidad vuelve al buscador); ícono sucursal abre `FacturaProductoStockModal` (fondo `primary` si hay stock en otra sucursal, `destructive` si no; descripción + sucursal/stock). Stock de columna = sucursal del usuario; detalle = sucursales con depósito. Tabla remito en `.contenedor-tabla-gestion` (`table-fixed` + `colgroup` %: acciones 7 / COD. 7 / DESCRIPCIÓN 40 / CANT. 8 / PX. LISTA 10 / DESC. 8 / PX C/ DESC. 10 / TOTAL 10; inputs `w-full`): basura + comentario (`MessageSquare` → `FacturaLineaComentarioModal`; texto MAYÚSCULAS bajo DESCRIPCIÓN) | COD. | DESCRIPCIÓN | CANT. | PX. LISTA | TOTAL (importes con `$` + `fmtPrecio`). Con descuento: columnas fijas **DESC.** (input % por ítem; `null` hereda el global del pie) + **PX C/ DESC.** + TOTAL. Pie compacto (`min-h-[2.8125rem]` = 25 % más que `h-7`+`py-1`; `py-1.5` / `text-xs`): izquierda botón **Desc.** (`variant="default"`, sin panel ni borde propio) → `FacturaDescuentoModal` con DESC. % / DESC. TOTAL); derecha **resumen solo lectura** (`bg-muted/40`; sin desc. muestra `0%` / `$0`: TOTAL ITEM | TOTAL $ | DESC. % PROMEDIO ponderado | DESC. $ | TOTAL C/ DESC.). Al agregar ítem: con **DESC. %** hereda el global; con **DESC. TOTAL** congela el % promedio y lo hereda (`prepararDescuentoAlAgregarLinea`). Helpers en `@/lib/factura` (`FacturaDescuentoEstado`, `descuentoPctEspecial`, `resumenTotalesFactura`, …). Tipos: `FACTURA_TIPOS` / `FACTURA_TIPO_LABELS` (`presupuesto`, `factura_no_fiscal`, `factura_fiscal`, `nota_credito_no_fiscal`, `nota_credito_fiscal`). Persistencia `comprobantes_vtas` (+ `_items` / `_historial_arca`). Cliente vacío o `CONSUMIDOR FINAL` → CF. Cliente con CUIT válido **y** `condicion_iva` → esos datos en el snapshot fiscal; si falta alguno → CF (DocTipo 99 / DocNro 0 / cond. IVA 5). Texto parcial sin elegir de la lista → no emite. **Lista Comprobantes / Presupuestos:** CFTL + `FilterBar` + tabla (`FacturaListadoPageClient`); Facturas lista no-presupuesto (CAE, letra, NC fiscal sobre `factura_fiscal` autorizada, consultar ARCA si quedó sin CAE); Presupuestos solo `presupuesto`. PDF de fila: `obtenerFacturaComprobantePdfAction`. Tipos no fiscales **no** llaman ARCA (nro local por pto + tipo). Fiscales: nro ARCA (`FECompUltimoAutorizado` + 1 por pto + `CbteTipo`; A/B/C no se mezclan).

### Asistente IA

UI en `src/components/asistente-ia/`. Pasos secuenciales: `ProcesoPaso` (alias `AsistenteIaProcesoPaso`). Contratos, prompts y scraper: **`docs/AGENTEIA_GUIDELINES.md`**.

---

## 4. Checklist de PR

- [ ] Tokens + `cn()`; sin paletas genéricas; banners con `CALLOUT_WARNING_CLASS`.
- [ ] `.area-page-shell`; sin `px-*` duplicado; sin breakpoints `sm:`/`md:`/`lg:`.
- [ ] Página con tabla: CFTL + `FilterBar` `filtros-contenedor-tienda bg-card` + `Table` compacta + sticky thead + vacío `TableEmptyState`.
- [ ] Búsqueda: `useFiltrosConBusqueda` + `FiltroBusquedaInput`. Selects shadcn con buscador. Fila desplegables: 5 cols (6 solo si hay 6). Sin búsqueda: contador + tacho en la **misma** fila (no segunda fila).
- [ ] Contorno de campos: `Input` / `Select` / `textarea` / combobox = `1px` `--primary` (`border-input`). No `border-border` en el recuadro. Máscara/stepper: borde en el cascarón. Lectura clicable: `.boton-encubierto`.
- [ ] Header: un botón **ACCIONES** (`HeaderAccionesMenu`); las acciones de la ventana van en `actions` del CFTL, no en una fila suelta.
- [ ] Íconos de fila: `TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS`. Toolbar ícono+label: `ToolbarActionButton`.
- [ ] MAYÚSCULAS / Title Case / abreviaturas con punto según **Guía para IA** punto 11.
- [ ] Labels de modal en `text-foreground`. Boolean / SÍ/NO de modal: `ModalSiNoChoice` (MAYÚSCULAS, sin texto de ayuda). Elegir una o más opciones: desplegable (`Select` / `FiltroMultiSelect`); no `<ul>` de checkboxes a la vista.
- [ ] lucide-react + sonner + Geist. Sin `any`. Zod en el borde si hay input.
- [ ] Clase global o shared nuevo → **§2**. Comportamiento único de pantalla → **§3**.

---

## 5. Anti-patrones

- Paletas genéricas, breakpoints responsive, `<select>` nativo, `<select multiple>`, lista siempre visible de checkboxes para elegir una o más opciones de catálogo, `window.location.href`, template literals en `className`, cascarón `h-screen flex…`, sombra mágica en Card de tabla.
- Recuadro gris (`border-border` / `--gris-inset`) en `Input`, `SelectTrigger`, `textarea` o combobox. El contorno de campo es `--primary`.
- `<button>` suelto en páginas/modales (usar `Button`). Excepciones: celdas de calendario, checkbox de tabla, `TooltipTrigger`, barras de gráfico, dock/sidebar, trigger de multi-select, `.boton-encubierto` (lectura clicable; el CVA de `Button` rompe truncado / `text-left`).
- Sync DUX en el header de un módulo (vive en slidenav).
- Inventar layout “dashboard” o segunda variante de tabla.
- Fila de botones sueltos en el header de página (usar `actions` → menú **ACCIONES**).
- Recrear páginas en URLs redirigidas (`/proveedores`, `/proveedores/gestion`, `/finanzas/flujo-de-fondo`, `/precios-competencia`, …).
- Copiar el hex de Balance mensual a otras pantallas.
- Lógica de negocio, auth o persistencia en el cliente.

**Para IA:** `.cursorrules` obliga esta guía al tocar frontend. Leer solo la sección relevante + checklist **§4**.
