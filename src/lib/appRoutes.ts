/**
 * Árbol canónico de URLs: `/{área}/{módulo}/{función}` (mismo orden y nombres que el sidenav).
 * Las carpetas de `src/app/` siguen este árbol. Sin imports `@/`: lo consume `next.config.ts`.
 */

const VENTAS = "/ventas";
const ADMINISTRADOR = "/administrador";
const FINANZAS = "/finanzas";
const MARKETING = "/marketing";

export const APP_ROUTES = {
  ventas: {
    hub: VENTAS,
    ventas: {
      crear: `${VENTAS}/ventas/crear`,
      comprobantes: `${VENTAS}/ventas/comprobantes`,
      presupuestos: `${VENTAS}/ventas/presupuestos`,
      pxSugeridos: `${VENTAS}/ventas/px-sugeridos`,
      pxTintometrico: `${VENTAS}/ventas/px-tintometrico`,
    },
    compras: {
      pedirMercaderia: `${VENTAS}/compras/pedir-mercaderia`,
      comprasEmitidas: `${VENTAS}/compras/compras-emitidas`,
      comprasRecepcionadas: `${VENTAS}/compras/compras-recepcionadas`,
      /** Fuera del sidenav (pendiente); se conserva la pantalla. */
      tintometrico: `${VENTAS}/compras/tintometrico`,
    },
    envios: {
      programados: `${VENTAS}/envios/programados`,
      conductor: `${VENTAS}/envios/conductor`,
    },
    clientes: {
      cuentasCorrientes: `${VENTAS}/clientes/cuentas-corrientes`,
      listaClientes: `${VENTAS}/clientes/lista-clientes`,
    },
    herramientas: {
      calculadoraLts: `${VENTAS}/herramientas/calculadora-lts`,
      buscarCodImagen: `${VENTAS}/herramientas/buscar-cod-imagen`,
      disenar: `${VENTAS}/herramientas/disenar`,
    },
    stock: {
      controlStock: `${VENTAS}/stock/control-stock`,
      transfDepositos: `${VENTAS}/stock/transf-depositos`,
      movimientos: `${VENTAS}/stock/movimientos`,
    },
  },
  administrador: {
    hub: ADMINISTRADOR,
    productos: {
      listaProductos: `${ADMINISTRADOR}/productos/lista-productos`,
      pxListas: `${ADMINISTRADOR}/productos/px-listas`,
      pxCompetencia: `${ADMINISTRADOR}/productos/px-competencia`,
      analisisCat: `${ADMINISTRADOR}/productos/analisis-cat`,
      margenContribucion: `${ADMINISTRADOR}/productos/margen-contribucion`,
      /** Fuera del sidenav: Cx. compra / comparación de proveedores. */
      cxCompra: `${ADMINISTRADOR}/productos/cx-compra`,
    },
    proveedores: {
      listaProdProv: `${ADMINISTRADOR}/proveedores/lista-prod-prov`,
      reglasDescuentos: `${ADMINISTRADOR}/proveedores/lista-prod-prov/reglas-descuentos`,
      proveedores: `${ADMINISTRADOR}/proveedores/proveedores`,
    },
    pedidosAFabrica: {
      pedidosAFabrica: `${ADMINISTRADOR}/pedidos-a-fabrica/pedidos-a-fabrica`,
    },
    estadisticas: {
      ventas: `${ADMINISTRADOR}/estadisticas/ventas`,
      cargaDeDatos: `${ADMINISTRADOR}/estadisticas/carga-de-datos`,
      configuracion: `${ADMINISTRADOR}/estadisticas/configuracion`,
    },
    usuarios: {
      usuarios: `${ADMINISTRADOR}/usuarios/usuarios`,
    },
  },
  finanzas: {
    hub: FINANZAS,
    tesoreria: {
      cajas: `${FINANZAS}/tesoreria/cajas`,
      movimientos: `${FINANZAS}/tesoreria/movimientos`,
      flujoDeFondos: `${FINANZAS}/tesoreria/flujo-de-fondos`,
    },
    balance: {
      /** Sin función propia: redirige a Balance Mensual con mes/año por defecto. */
      raiz: `${FINANZAS}/balance`,
      balanceMensual: `${FINANZAS}/balance/balance-mensual`,
      gastos: `${FINANZAS}/balance/gastos`,
      catalogoGastos: `${FINANZAS}/balance/catalogo-gastos`,
      ventasMensuales: `${FINANZAS}/balance/ventas-mensuales`,
    },
    operaciones: {
      compCompras: `${FINANZAS}/operaciones/comp-compras`,
      vencGastos: `${FINANZAS}/operaciones/venc-gastos`,
    },
    cobros: {
      ptosVtas: `${FINANZAS}/cobros/ptos-vtas`,
      cobrosCxFin: `${FINANZAS}/cobros/cobros-cx-fin`,
      cobrosCajas: `${FINANZAS}/cobros/cobros-cajas`,
    },
    impuestos: {
      posicionIva: `${FINANZAS}/impuestos/posicion-iva`,
    },
  },
  marketing: {
    hub: MARKETING,
    publicaciones: {
      calendario: `${MARKETING}/publicaciones/calendario`,
      ideasContenido: `${MARKETING}/publicaciones/ideas-contenido`,
      objetivos: `${MARKETING}/publicaciones/objetivos`,
    },
    baseMultimedia: {
      baseMultimedia: `${MARKETING}/base-multimedia/base-multimedia`,
      coloresMarca: `${MARKETING}/base-multimedia/colores-marca`,
    },
  },
} as const;

const R = APP_ROUTES;

/**
 * URLs anteriores → canónicas (redirect permanente en `next.config.ts`; conserva query string).
 * Incluye URLs de módulo (`/{área}/{módulo}`) → primera función del módulo.
 */
export const LEGACY_ROUTE_REDIRECTS: readonly (readonly [string, string])[] = [
  // Hubs de área
  ["/area-finanzas", R.finanzas.hub],

  // Ventas · módulos sin función propia
  ["/ventas/ventas", R.ventas.ventas.comprobantes],
  ["/ventas/compras", R.ventas.compras.pedirMercaderia],
  ["/ventas/envios", R.ventas.envios.programados],
  ["/ventas/clientes", R.ventas.clientes.cuentasCorrientes],
  ["/ventas/herramientas", R.ventas.herramientas.calculadoraLts],
  ["/ventas/stock", R.ventas.stock.controlStock],

  // Ventas · VENTAS / CLIENTES (ex /facturacion)
  ["/facturacion", R.ventas.hub],
  ["/facturacion/factura", R.ventas.ventas.comprobantes],
  ["/facturacion/factura/crear", R.ventas.ventas.crear],
  ["/facturacion/factura/facturas", R.ventas.ventas.comprobantes],
  ["/facturacion/factura/presupuestos", R.ventas.ventas.presupuestos],
  ["/facturacion/clientes", R.ventas.clientes.cuentasCorrientes],
  ["/facturacion/clientes/cuenta-corriente", R.ventas.clientes.cuentasCorrientes],
  ["/facturacion/clientes/lista", R.ventas.clientes.listaClientes],

  // Ventas · Px (ex ayuda-vendedor)
  ["/gestion-productos/ayuda-vendedor/px-venta/px-vta-sugerido", R.ventas.ventas.pxSugeridos],
  ["/gestion-productos/proveedores/sugeridos", R.ventas.ventas.pxSugeridos],
  ["/proveedores/sugeridos", R.ventas.ventas.pxSugeridos],
  ["/gestion-productos/ayuda-vendedor/px-venta/px-tintometrico", R.ventas.ventas.pxTintometrico],
  ["/gestion-productos/tienda/calc-tintometrico", R.ventas.ventas.pxTintometrico],
  ["/tienda/tintometrico", R.ventas.ventas.pxTintometrico],
  ["/tienda/tinto-lts", R.ventas.ventas.pxTintometrico],

  // Ventas · COMPRAS (ex pedido-mercaderia / pedidos)
  ["/gestion-productos/pedido-mercaderia/pedir-mercaderia", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedido-mercaderia/generar-pedido", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedido-mercaderia/conf-pedido/urgente", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedido-mercaderia/conf-pedido/reposicion", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedido-mercaderia/conf-pedido/tintometrico", R.ventas.compras.tintometrico],
  ["/gestion-productos/pedido-mercaderia/recepcion-pedido", R.ventas.compras.comprasEmitidas],
  ["/gestion-productos/pedido-mercaderia/compras", R.ventas.compras.comprasRecepcionadas],
  ["/gestion-productos/pedido-mercaderia", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedidos", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedidos/generar-pedido", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedidos/urgente", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedidos/reposicion", R.ventas.compras.pedirMercaderia],
  ["/gestion-productos/pedidos/tintometrico", R.ventas.compras.tintometrico],
  ["/gestion-productos/pedidos/historial", R.ventas.compras.comprasEmitidas],
  ["/pedidos", R.ventas.compras.pedirMercaderia],
  ["/pedidos/pedir-mercaderia", R.ventas.compras.pedirMercaderia],
  ["/pedidos/enviar", R.ventas.compras.pedirMercaderia],
  ["/pedidos/urgente", R.ventas.compras.pedirMercaderia],
  ["/pedidos/reposicion", R.ventas.compras.pedirMercaderia],
  ["/pedidos/tintometrico", R.ventas.compras.tintometrico],
  ["/pedidos/historial", R.ventas.compras.comprasEmitidas],
  ["/pedidos/generar", R.ventas.compras.comprasEmitidas],
  ["/pedidos/compras", R.ventas.compras.comprasRecepcionadas],

  // Ventas · ENVIOS
  ["/gestion-productos/envios", R.ventas.envios.programados],
  ["/gestion-productos/envios/programados", R.ventas.envios.programados],
  ["/gestion-productos/envios/conductor", R.ventas.envios.conductor],
  ["/gestion-productos/envios/crear", R.ventas.envios.conductor],
  ["/envios", R.ventas.envios.programados],
  ["/envios/programados", R.ventas.envios.programados],
  ["/envios/conductor", R.ventas.envios.conductor],
  ["/envios/crear", R.ventas.envios.conductor],

  // Ventas · HERRAMIENTAS
  ["/gestion-productos/ayuda-vendedor/calc-litros", R.ventas.herramientas.calculadoraLts],
  ["/gestion-productos/tienda/calc-litros", R.ventas.herramientas.calculadoraLts],
  ["/tienda/litros", R.ventas.herramientas.calculadoraLts],
  ["/gestion-productos/asistente-ia/buscar-color-imagen", R.ventas.herramientas.buscarCodImagen],
  ["/asistente-ia/buscar-color-imagen", R.ventas.herramientas.buscarCodImagen],
  ["/gestion-productos/asistente-ia/disenar-colores", R.ventas.herramientas.disenar],
  ["/asistente-ia/disenar-colores", R.ventas.herramientas.disenar],

  // Ventas · STOCK
  ["/gestion-productos/ayuda-vendedor/control-stock", R.ventas.stock.controlStock],
  ["/gestion-productos/tienda/control-stock", R.ventas.stock.controlStock],
  ["/stock", R.ventas.stock.controlStock],
  ["/gestion-productos/ayuda-vendedor/transf-depositos", R.ventas.stock.transfDepositos],
  ["/transf-depositos", R.ventas.stock.transfDepositos],
  ["/gestion-productos/ayuda-vendedor/movimientos-stock", R.ventas.stock.movimientos],
  ["/stock/movimientos", R.ventas.stock.movimientos],

  // Ventas · restos de rutas retiradas
  ["/gestion-productos", R.ventas.hub],
  ["/gestion-productos/procesos", R.ventas.hub],
  ["/gestion-productos/ayuda-vendedor/procesos", R.ventas.hub],
  ["/gestion-productos/cargar-gasto", R.ventas.hub],
  ["/gestion-productos/ayuda-vendedor/cargar-gasto", R.ventas.hub],
  ["/procesos", R.ventas.hub],
  ["/cargar-gasto", R.ventas.hub],

  // Administrador · módulos sin función propia
  ["/administrador/productos", R.administrador.productos.listaProductos],
  ["/administrador/proveedores", R.administrador.proveedores.listaProdProv],
  ["/administrador/pedidos-a-fabrica", R.administrador.pedidosAFabrica.pedidosAFabrica],
  ["/administrador/estadisticas", R.administrador.estadisticas.ventas],
  ["/administrador/usuarios", R.administrador.usuarios.usuarios],

  // Administrador · PRODUCTOS
  ["/gestion-productos/analisis-precios/lista-propia/lista-productos", R.administrador.productos.listaProductos],
  ["/tienda/lista-productos", R.administrador.productos.listaProductos],
  ["/gestion-productos/analisis-precios/cx-y-px-tienda/px-listas", R.administrador.productos.pxListas],
  ["/gestion-productos/tienda/px-listas", R.administrador.productos.pxListas],
  ["/tienda/px-listas", R.administrador.productos.pxListas],
  ["/gestion-productos/analisis-precios/px-competencia", R.administrador.productos.pxCompetencia],
  ["/gestion-productos/tienda/cx-px-tienda", R.administrador.productos.pxCompetencia],
  ["/gestion-productos/precios-competencia", R.administrador.productos.pxCompetencia],
  ["/gestion-productos/proveedores/competencia-precios", R.administrador.productos.pxCompetencia],
  ["/precios-competencia", R.administrador.productos.pxCompetencia],
  ["/proveedores/competencia-precios", R.administrador.productos.pxCompetencia],
  ["/tienda/cx-px", R.administrador.productos.pxCompetencia],
  ["/gestion-productos/analisis-precios/comp-categorias/comparacion", R.administrador.productos.analisisCat],
  ["/gestion-productos/analisis-precios/comp-categorias/categorias", R.administrador.productos.analisisCat],
  ["/gestion-productos/proveedores/comparacion-categorias", R.administrador.productos.analisisCat],
  ["/gestion-productos/proveedores/comparacion-categorias/categorias", R.administrador.productos.analisisCat],
  ["/proveedores/comparacion-categorias", R.administrador.productos.analisisCat],
  ["/proveedores/comparacion-categorias/categorias", R.administrador.productos.analisisCat],
  ["/finanzas/analisis-mc", R.administrador.productos.margenContribucion],
  ["/finanzas/analisis-mc/margen-contribucion", R.administrador.productos.margenContribucion],
  ["/gestion-productos/analisis-precios/cx-y-px-tienda/cx-compra", R.administrador.productos.cxCompra],
  ["/gestion-productos/tienda/comp-proveedores", R.administrador.productos.cxCompra],
  ["/gestion-productos/tienda", R.administrador.productos.cxCompra],
  ["/tienda/comp-proveedores", R.administrador.productos.cxCompra],
  ["/tienda", R.administrador.productos.cxCompra],

  // Administrador · PROVEEDORES
  ["/gestion-productos/analisis-precios/lista-proveedores/lista-precios", R.administrador.proveedores.listaProdProv],
  ["/gestion-productos/proveedores/lista-precios", R.administrador.proveedores.listaProdProv],
  ["/gestion-productos/proveedores", R.administrador.proveedores.listaProdProv],
  ["/proveedores", R.administrador.proveedores.listaProdProv],
  ["/proveedores/lista-precios", R.administrador.proveedores.listaProdProv],
  ["/gestion-productos/analisis-precios/lista-proveedores/reglas-descuentos", R.administrador.proveedores.reglasDescuentos],
  ["/gestion-productos/proveedores/lista-precios/reglas-descuentos", R.administrador.proveedores.reglasDescuentos],
  ["/proveedores/lista-precios/reglas-descuentos", R.administrador.proveedores.reglasDescuentos],
  ["/gestion-productos/analisis-precios/lista-proveedores/lista", R.administrador.proveedores.proveedores],
  ["/gestion-productos/proveedores/lista", R.administrador.proveedores.proveedores],
  ["/proveedores/lista", R.administrador.proveedores.proveedores],
  ["/proveedores/gestion", R.administrador.proveedores.proveedores],

  // Administrador · PEDIDOS A FÁBRICA / ESTADÍSTICAS / USUARIOS
  ["/pedido-a-fabrica", R.administrador.pedidosAFabrica.pedidosAFabrica],
  ["/estadisticas-productos/est-para-compra", R.administrador.pedidosAFabrica.pedidosAFabrica],
  ["/estadisticas-productos", R.administrador.estadisticas.ventas],
  ["/estadisticas-productos/estadisticas-vtas", R.administrador.estadisticas.ventas],
  ["/estadisticas-productos/ventas-por-producto", R.administrador.estadisticas.cargaDeDatos],
  ["/estadisticas-productos/categorizacion", R.administrador.estadisticas.configuracion],
  ["/finanzas/usuarios", R.administrador.usuarios.usuarios],

  // Finanzas · módulos sin función propia
  ["/finanzas/tesoreria", R.finanzas.tesoreria.cajas],
  ["/finanzas/operaciones", R.finanzas.operaciones.compCompras],
  ["/finanzas/cobros", R.finanzas.cobros.ptosVtas],
  ["/finanzas/impuestos", R.finanzas.impuestos.posicionIva],

  // Finanzas · TESORERIA
  ["/finanzas/venc-por-fecha", R.finanzas.tesoreria.flujoDeFondos],
  ["/finanzas/flujo-de-fondo", R.finanzas.tesoreria.flujoDeFondos],

  // Finanzas · BALANCE
  ["/finanzas/balance/mensual", R.finanzas.balance.balanceMensual],
  ["/finanzas/balance/gastos/catalogo", R.finanzas.balance.catalogoGastos],
  ["/finanzas/balance/vtas", R.finanzas.balance.ventasMensuales],

  // Finanzas · OPERACIONES
  ["/finanzas/control-comprobantes", R.finanzas.operaciones.compCompras],
  ["/finanzas/deuda-proveedores", R.finanzas.operaciones.compCompras],
  ["/finanzas/venc-proveedores-mercaderia", R.finanzas.operaciones.compCompras],
  ["/finanzas/vencimientos-gastos", R.finanzas.operaciones.vencGastos],

  // Finanzas · COBROS (ex /vtas-cobros)
  ["/vtas-cobros", R.finanzas.cobros.ptosVtas],
  ["/vtas-cobros/cobros", R.finanzas.cobros.ptosVtas],
  ["/vtas-cobros/ptos-venta", R.finanzas.cobros.ptosVtas],
  ["/finanzas/fact-cobros", R.finanzas.cobros.ptosVtas],
  ["/vtas-cobros/cx-fin-cobros", R.finanzas.cobros.cobrosCxFin],
  ["/finanzas/analisis-mc/costos-financieros", R.finanzas.cobros.cobrosCxFin],
  ["/vtas-cobros/cobros-por-sucursal", R.finanzas.cobros.cobrosCajas],

  // Finanzas · IMPUESTOS
  ["/finanzas/posicion-iva", R.finanzas.impuestos.posicionIva],
  ["/finanzas/balance/posicion-iva", R.finanzas.impuestos.posicionIva],

  // Marketing
  ["/marketing/publicaciones", R.marketing.publicaciones.calendario],
  ["/marketing/publicaciones/ideas", R.marketing.publicaciones.ideasContenido],
  ["/marketing/publicaciones/objetivo", R.marketing.publicaciones.objetivos],
  ["/marketing/base-multimedia", R.marketing.baseMultimedia.baseMultimedia],
];

/** `pathname` es `prefijo` o una ruta descendiente. */
export function pathnameEnPrefijo(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(`${prefijo}/`);
}
