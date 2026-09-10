/**
 * Configuración central de permisos por rol.
 *
 * Cada clave representa un elemento de la UI.
 * Modificá este archivo para controlar qué ve cada rol.
 *
 * Roles disponibles: "simple" | "editor"
 * El rol `editor` se activa al ingresar al módulo **Administración** con clave
 * (`SidebarAreaSwitcher` + `EDITOR_PASSWORD`). Vendedor y Marketing son libre acceso.
 */

export type Rol = "simple" | "editor";

export const PERMISOS = {

  // ─── Página /proveedores (y submódulos en sidebar) ─────────────────────────
  proveedores: {
    /** Acceso a Px Vta. Sugeridos (/proveedores/sugeridos). Solo este submódulo visible para simple. */
    sugeridos:       { simple: true,  editor: true },
    listaPrecios:   { simple: false, editor: true },
    comparacionCat: { simple: false, editor: true },
    lista:           { simple: false, editor: true },
    acciones: {
      nuevoProveedor: { simple: false, editor: true },
      importarLista:  { simple: false, editor: true },
    },
    tabla: {
      codProdProv:         { simple: false, editor: true  },
      codExt:              { simple: false, editor: true  },
      descripcion:         { simple: true,  editor: true  },
      proveedor:           { simple: true,  editor: true  },
      precioLista:         { simple: false, editor: true  },
      precioVentaSugerido: { simple: true,  editor: true  },
      descuentoRubro:      { simple: false, editor: true  },
      descuentoCantidad:   { simple: false, editor: true  },
      cxTransporte:        { simple: false, editor: true  },
      precioCompraFinal:   { simple: false, editor: true  },
      disponible:          { simple: false, editor: true  },
    },
  },

  // ─── Página /proveedores/lista-precios ──────────────────────────────────────
  listaPrecios: {
    acciones: {
      importarLista:   { simple: false, editor: true },
      edicionMasiva:  { simple: false, editor: true },
      gestionarReglasDescuentos: { simple: false, editor: true },
      gestionarCotizacionUsd: { simple: false, editor: true },
    },
  },

  // ─── Página /proveedores/comparacion-categorias ─────────────────────────────
  comparacionCategorias: {
    acceso:  { simple: false, editor: true },
    editar:  { simple: false, editor: true }, // CRUD categorías/subcategorías/presentaciones y asignar productos
  },

  // ─── Módulo /precios-competencia (Precios Competencia) ───────────────────────
  competenciaPrecios: {
    acceso: { simple: false, editor: true },
    editar: { simple: false, editor: true }, // CRUD competidores + sincronizar precios desde webs
  },

  // ─── Px Listas + Px Competencia + CX PROD. en Cx Compra ───────────────────
  cxPxTienda: {
    /** Px Listas (/gestion-productos/tienda/px-listas), Px Competencia (/gestion-productos/tienda/cx-px-tienda), edición CX PROD. y Exportar Cx en Cx Compra. */
    acceso: { simple: false, editor: true },
  },

  // ─── Página /tienda (y submódulos en sidebar) ──────────────────────────────
  tienda: {
    /** Cx Compra (/gestion-productos/tienda/comp-proveedores). Módulo Análisis de Precios — solo editor. */
    acceso: { simple: false, editor: true },
    /** Calc. Tintométrico y Calc. Litros (/tienda/tintometrico, /tienda/litros). */
    tintoLts: { simple: true, editor: true },
    acciones: {
      /** Lista tienda DUX: sidebar y POST /api/sync-lista-precios-tienda; simple y editor pueden disparar. */
      sincronizar: { simple: true, editor: true },
    },
    tabla: {
      codItem:      { simple: false, editor: true },
      descripcion:  { simple: true,  editor: true },
      costo:        { simple: false, editor: true },
      proveedorDux: { simple: false, editor: true },
      rubro:        { simple: true,  editor: true },
      subRubro:     { simple: true,  editor: true },
      vinculado: { simple: true, editor: true },
      /** Abrir modal de vínculos (doble clic). Pantalla solo editor; vincular/desvincular en Action con `esEditor()`. */
      vinculos: { simple: false, editor: true },
    },
  },

  // ─── Página /stock ────────────────────────────────────────────────────────
  stock: {
    acceso: { simple: true, editor: true },
  },

  // ─── Página /pedidos ──────────────────────────────────────────────────────
  pedidos: {
    acceso: { simple: true, editor: true },
  },

  // ─── Ayuda Vendedor — Cargar Gasto (modal Nuevo Gasto Eventual) ───────────
  ayudaVendedor: {
    /** Misma capacidad que **GASTO EVENTUAL** en `/finanzas/balance/gastos`; área Vendedor abierta a `simple`. */
    cargarGasto: { simple: true, editor: true },
  },

  // ─── Módulo Envios (Vendedor) ─────────────────────────────────────────────
  envios: {
    /** CRUD de clientes, direcciones y envío final. Flujo vendedor (`simple` + `editor`). */
    acceso: { simple: true, editor: true },
  },

  // ─── Área /finanzas (deuda proveedores, tesorería, balance, etc.) ────────
  finanzas: {
    acceso: { simple: true, editor: true },
  },

  // ─── Área /estadisticas-productos ─────────────────────────────────────────
  estadisticasProductos: {
    acceso: { simple: true, editor: true },
  },

  // ─── Área /marketing ──────────────────────────────────────────────────────
  marketing: {
    /** Libre acceso de lectura/navegación; mutaciones CRUD siguen con `esEditor()`. */
    acceso: { simple: true, editor: true },
  },

  // ─── Administración · USUARIOS (`/finanzas/usuarios`) ─────────────────────
  usuarios: {
    /** Catálogo `global_personal`: sucursal, módulos y titular financiero. Solo editor. */
    acceso: { simple: false, editor: true },
    /** Listado para el modal de inicio (nombre + sucursal + módulos). */
    inicioSesion: { simple: true, editor: true },
  },

  // ─── Módulo Asistente IA (Vendedor) ────────────────────────────────────────
  asistenteIa: {
    /** Acceso al módulo (vendedor/`simple` + editor). CRUD de prompts: solo editor (`esEditor`). */
    acceso: { simple: true, editor: true },
  },

} as const;

/**
 * Helper para verificar si un rol tiene permiso para un elemento.
 * Uso: puede(rol, PERMISOS.tienda.tabla.costo)
 */
export function puede(rol: Rol, permiso: { simple: boolean; editor: boolean }): boolean {
  return permiso[rol];
}
