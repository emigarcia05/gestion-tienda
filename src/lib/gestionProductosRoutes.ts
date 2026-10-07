/**
 * URLs canónicas de Vendedor / Análisis de Precios alineadas a sidebar:
 * - Mercadería, Precios, Herramientas, Asistente IA → área Vendedor
 * - Análisis de Precios → área Administración (id `finanzas`; URLs siguen bajo `/gestion-productos/analisis-precios/...`)
 * área → módulo → agrupador → submódulo.
 * Las rutas internas (`src/app/pedidos`, `proveedores`, …) se sirven vía rewrites en `next.config.ts`.
 */

const GP = "/gestion-productos";

export const GP_ROUTES = {
  /** Hub Vendedor / inicio: panel vacío hasta elegir una ruta hoja en el sidenav. */
  defaultEntry: `/`,
  pedidoMercaderia: {
    /** **Pedir Mercadería**: unifica Urgente, Reposición y Generar Pedido (esas URLs redirigen acá). */
    pedirMercaderia: `${GP}/pedido-mercaderia/pedir-mercaderia`,
    generarPedido: `${GP}/pedido-mercaderia/generar-pedido`,
    confPedido: {
      urgente: `${GP}/pedido-mercaderia/conf-pedido/urgente`,
      tintometrico: `${GP}/pedido-mercaderia/conf-pedido/tintometrico`,
      reposicion: `${GP}/pedido-mercaderia/conf-pedido/reposicion`,
    },
    /** Submódulo **Órdenes de Compra** (slug histórico `recepcion-pedido`). */
    recepcionPedido: `${GP}/pedido-mercaderia/recepcion-pedido`,
    /** Submódulo **Compras Recepcionadas**: comprobantes recepcionados + nota de crédito. */
    compras: `${GP}/pedido-mercaderia/compras`,
  },
  ayudaVendedor: {
    pxVenta: {
      pxVtaSugerido: `${GP}/ayuda-vendedor/px-venta/px-vta-sugerido`,
      pxTintometrico: `${GP}/ayuda-vendedor/px-venta/px-tintometrico`,
    },
    calcLitros: `${GP}/ayuda-vendedor/calc-litros`,
    /** Submódulo **Control Stock** bajo el módulo sidebar **STOCK**. */
    controlStock: `${GP}/ayuda-vendedor/control-stock`,
    /** Submódulo **Trans. Depósitos** bajo el módulo sidebar **STOCK**. */
    transfDepositos: `${GP}/ayuda-vendedor/transf-depositos`,
    /** Submódulo **Movimientos** bajo el módulo sidebar **STOCK**. */
    movimientosStock: `${GP}/ayuda-vendedor/movimientos-stock`,
  },
  analisisPrecios: {
    listaProveedores: {
      listaPrecios: `${GP}/analisis-precios/lista-proveedores/lista-precios`,
      reglasDescuentos: `${GP}/analisis-precios/lista-proveedores/reglas-descuentos`,
      lista: `${GP}/analisis-precios/lista-proveedores/lista`,
    },
    cxYPxTienda: {
      cxCompra: `${GP}/analisis-precios/cx-y-px-tienda/cx-compra`,
      pxListas: `${GP}/analisis-precios/cx-y-px-tienda/px-listas`,
    },
    pxCompetencia: `${GP}/analisis-precios/px-competencia`,
    compCategorias: {
      comparacion: `${GP}/analisis-precios/comp-categorias/comparacion`,
      categorias: `${GP}/analisis-precios/comp-categorias/categorias`,
    },
  },
  envios: {
    programados: `${GP}/envios/programados`,
    conductor: `${GP}/envios/conductor`,
  },
  asistenteIa: {
    buscarColorImagen: `${GP}/asistente-ia/buscar-color-imagen`,
    disenarColores: `${GP}/asistente-ia/disenar-colores`,
  },
} as const;

/** Destinos internos en `src/app/` (rewrites). */
export const GP_INTERNAL = {
  pedidoMercaderia: {
    pedirMercaderia: "/pedidos/pedir-mercaderia",
    generarPedido: "/pedidos/enviar",
    confPedido: {
      urgente: "/pedidos/urgente",
      tintometrico: "/pedidos/tintometrico",
      reposicion: "/pedidos/reposicion",
    },
    recepcionPedido: "/pedidos/historial",
    compras: "/pedidos/compras",
  },
  ayudaVendedor: {
    pxVenta: {
      pxVtaSugerido: "/proveedores/sugeridos",
      pxTintometrico: "/tienda/tintometrico",
    },
    calcLitros: "/tienda/litros",
    controlStock: "/stock",
    transfDepositos: "/transf-depositos",
    movimientosStock: "/stock/movimientos",
  },
  analisisPrecios: {
    listaProveedores: {
      listaPrecios: "/proveedores/lista-precios",
      reglasDescuentos: "/proveedores/lista-precios/reglas-descuentos",
      lista: "/proveedores/lista",
    },
    cxYPxTienda: {
      cxCompra: "/tienda",
      pxListas: "/tienda/px-listas",
    },
    pxCompetencia: "/tienda/cx-px",
    compCategorias: {
      comparacion: "/proveedores/comparacion-categorias",
      categorias: "/proveedores/comparacion-categorias/categorias",
    },
  },
  envios: {
    programados: "/envios/programados",
    conductor: "/envios/conductor",
  },
  asistenteIa: {
    buscarColorImagen: "/asistente-ia/buscar-color-imagen",
    disenarColores: "/asistente-ia/disenar-colores",
  },
} as const;

/** URLs canónicas anteriores y rutas cortas equivalentes por href canónico. */
const GP_ROUTE_ALIASES: Record<string, readonly string[]> = {
  [GP_ROUTES.pedidoMercaderia.pedirMercaderia]: ["/pedidos/pedir-mercaderia"],
  [GP_ROUTES.pedidoMercaderia.generarPedido]: [
    "/gestion-productos/pedidos/generar-pedido",
    "/pedidos/enviar",
    "/pedidos/generar",
  ],
  [GP_ROUTES.pedidoMercaderia.confPedido.urgente]: [
    "/gestion-productos/pedidos/urgente",
    "/pedidos/urgente",
  ],
  [GP_ROUTES.pedidoMercaderia.confPedido.tintometrico]: [
    "/gestion-productos/pedidos/tintometrico",
    "/pedidos/tintometrico",
  ],
  [GP_ROUTES.pedidoMercaderia.confPedido.reposicion]: [
    "/gestion-productos/pedidos/reposicion",
    "/pedidos/reposicion",
  ],
  [GP_ROUTES.pedidoMercaderia.recepcionPedido]: [
    "/gestion-productos/pedidos/historial",
    "/pedidos/historial",
  ],
  [GP_ROUTES.pedidoMercaderia.compras]: ["/pedidos/compras"],
  [GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido]: [
    "/gestion-productos/proveedores/sugeridos",
    "/proveedores/sugeridos",
  ],
  [GP_ROUTES.ayudaVendedor.pxVenta.pxTintometrico]: [
    "/gestion-productos/tienda/calc-tintometrico",
    "/tienda/tintometrico",
    "/tienda/tinto-lts",
  ],
  [GP_ROUTES.ayudaVendedor.calcLitros]: ["/gestion-productos/tienda/calc-litros", "/tienda/litros"],
  [GP_ROUTES.ayudaVendedor.controlStock]: [
    "/gestion-productos/tienda/control-stock",
    "/stock",
  ],
  [GP_ROUTES.ayudaVendedor.transfDepositos]: [
    "/transf-depositos",
  ],
  [GP_ROUTES.ayudaVendedor.movimientosStock]: [
    "/stock/movimientos",
  ],
  [GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios]: [
    "/gestion-productos/proveedores/lista-precios",
    "/proveedores/lista-precios",
  ],
  [GP_ROUTES.analisisPrecios.listaProveedores.reglasDescuentos]: [
    "/gestion-productos/proveedores/lista-precios/reglas-descuentos",
    "/proveedores/lista-precios/reglas-descuentos",
  ],
  [GP_ROUTES.analisisPrecios.listaProveedores.lista]: [
    "/gestion-productos/proveedores/lista",
    "/proveedores/lista",
  ],
  [GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra]: [
    "/gestion-productos/tienda/comp-proveedores",
    "/tienda",
    "/tienda/comp-proveedores",
  ],
  [GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas]: [
    "/gestion-productos/tienda/px-listas",
    "/tienda/px-listas",
  ],
  [GP_ROUTES.analisisPrecios.pxCompetencia]: [
    "/gestion-productos/tienda/cx-px-tienda",
    "/gestion-productos/precios-competencia",
    "/gestion-productos/proveedores/competencia-precios",
    "/precios-competencia",
    "/proveedores/competencia-precios",
    "/tienda/cx-px",
  ],
  [GP_ROUTES.analisisPrecios.compCategorias.comparacion]: [
    "/gestion-productos/proveedores/comparacion-categorias",
    "/proveedores/comparacion-categorias",
  ],
  [GP_ROUTES.analisisPrecios.compCategorias.categorias]: [
    "/gestion-productos/proveedores/comparacion-categorias/categorias",
    "/proveedores/comparacion-categorias/categorias",
  ],
  [GP_ROUTES.envios.programados]: ["/envios/programados", "/envios", `${GP}/envios`],
  [GP_ROUTES.envios.conductor]: ["/envios/conductor", "/envios/crear"],
  [GP_ROUTES.asistenteIa.buscarColorImagen]: [
    "/asistente-ia/buscar-color-imagen",
  ],
  [GP_ROUTES.asistenteIa.disenarColores]: [
    "/asistente-ia/disenar-colores",
  ],
};

const PEDIDO_MERCADERIA_PREFIXES = [
  `${GP}/pedido-mercaderia`,
  GP_ROUTES.pedidoMercaderia.pedirMercaderia,
  GP_ROUTES.pedidoMercaderia.generarPedido,
  `${GP}/pedido-mercaderia/conf-pedido`,
  GP_ROUTES.pedidoMercaderia.recepcionPedido,
  GP_ROUTES.pedidoMercaderia.compras,
  "/gestion-productos/pedidos",
  "/pedidos",
] as const;

const ASISTENCIA_PRECIOS_PREFIXES = [
  GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido,
  GP_ROUTES.ayudaVendedor.pxVenta.pxTintometrico,
  `${GP}/ayuda-vendedor/px-venta`,
  "/gestion-productos/proveedores/sugeridos",
  "/proveedores/sugeridos",
  "/gestion-productos/tienda/calc-tintometrico",
  "/tienda/tintometrico",
  "/tienda/tinto-lts",
] as const;

const CALCULAR_LTS_PREFIXES = [
  GP_ROUTES.ayudaVendedor.calcLitros,
  "/gestion-productos/tienda/calc-litros",
  "/tienda/litros",
] as const;

const CONTROL_STOCK_PREFIXES = [
  GP_ROUTES.ayudaVendedor.controlStock,
  GP_ROUTES.ayudaVendedor.transfDepositos,
  GP_ROUTES.ayudaVendedor.movimientosStock,
  "/gestion-productos/tienda/control-stock",
  "/stock",
  "/transf-depositos",
  "/stock/movimientos",
] as const;

const ANALISIS_PRECIOS_PREFIXES = [
  `${GP}/analisis-precios`,
  "/gestion-productos/tienda/comp-proveedores",
  "/gestion-productos/tienda/cx-px-tienda",
  "/gestion-productos/tienda/px-listas",
  "/gestion-productos/proveedores/comparacion-categorias",
  "/gestion-productos/proveedores/lista-precios",
  "/gestion-productos/proveedores/lista",
  "/gestion-productos/proveedores/competencia-precios",
  "/gestion-productos/precios-competencia",
  "/gestion-productos/proveedores",
  "/proveedores/comparacion-categorias",
  "/proveedores/lista-precios",
  "/proveedores/lista",
  "/proveedores/competencia-precios",
  "/precios-competencia",
  "/tienda",
  "/tienda/cx-px",
  "/tienda/px-listas",
  "/proveedores",
] as const;

const ENVIOS_PREFIXES = [
  GP_ROUTES.envios.programados,
  GP_ROUTES.envios.conductor,
  `${GP}/envios`,
  "/envios",
] as const;

const ASISTENTE_IA_PREFIXES = [
  `${GP}/asistente-ia`,
  GP_ROUTES.asistenteIa.buscarColorImagen,
  GP_ROUTES.asistenteIa.disenarColores,
  "/asistente-ia",
] as const;

function pathnameMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isGpRouteActive(pathname: string, canonicalHref: string): boolean {
  if (pathname === canonicalHref) return true;

  /** `/stock` no debe activar Control Stock cuando la ruta es `/stock/...` (no aplica) ni confundirse con Transf. */
  if (canonicalHref === GP_ROUTES.ayudaVendedor.controlStock) {
    const aliases = GP_ROUTE_ALIASES[canonicalHref] ?? [];
    return aliases.some((alias) => pathname === alias);
  }

  if (canonicalHref === GP_ROUTES.envios.programados) {
    return (
      pathname === canonicalHref ||
      pathname === "/envios/programados" ||
      pathname === "/envios" ||
      pathname === `${GP}/envios`
    );
  }
  if (canonicalHref === GP_ROUTES.envios.conductor) {
    return (
      pathname === canonicalHref ||
      pathname === "/envios/conductor" ||
      pathname === "/envios/crear" ||
      pathname === `${GP}/envios/crear`
    );
  }

  if (canonicalHref === GP_ROUTES.ayudaVendedor.transfDepositos) {
    const aliases = GP_ROUTE_ALIASES[canonicalHref] ?? [];
    return aliases.some(
      (alias) => pathname === alias || pathname.startsWith(`${alias}/`)
    );
  }

  if (canonicalHref === GP_ROUTES.ayudaVendedor.movimientosStock) {
    const aliases = GP_ROUTE_ALIASES[canonicalHref] ?? [];
    return (
      pathname === canonicalHref ||
      aliases.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))
    );
  }

  if (canonicalHref === GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios) {
    const aliases = GP_ROUTE_ALIASES[canonicalHref] ?? [];
    return aliases.some(
      (alias) =>
        pathname === alias &&
        !pathname.includes("/reglas-descuentos") &&
        !pathname.endsWith("/reglas-descuentos")
    );
  }

  if (canonicalHref === GP_ROUTES.analisisPrecios.compCategorias.comparacion) {
    const comparacionAliases = GP_ROUTE_ALIASES[canonicalHref] ?? [];
    const categoriasAliases =
      GP_ROUTE_ALIASES[GP_ROUTES.analisisPrecios.compCategorias.categorias] ?? [];
    return [...comparacionAliases, ...categoriasAliases].some(
      (alias) => pathname === alias || pathname.startsWith(`${alias}/`)
    );
  }

  const aliases = GP_ROUTE_ALIASES[canonicalHref] ?? [];
  return aliases.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`));
}

/** Conductor: lienzo mobile sin slidenav (canónica, interna y alias `/envios/crear`). */
export function esRutaEnviosConductor(pathname: string): boolean {
  return isGpRouteActive(pathname, GP_ROUTES.envios.conductor);
}

export type GpSidebarModuleId =
  | "pedidos"
  | "asistencia-precios"
  | "herramientas"
  | "envios"
  | "control-stock"
  | "analisis-precios"
  | "asistente-ia";

export function getGpSidebarModule(pathname: string): GpSidebarModuleId {
  if (PEDIDO_MERCADERIA_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "pedidos";
  }
  if (ASISTENCIA_PRECIOS_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "asistencia-precios";
  }
  if (CALCULAR_LTS_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "herramientas";
  }
  if (ENVIOS_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "envios";
  }
  if (CONTROL_STOCK_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "control-stock";
  }
  if (ANALISIS_PRECIOS_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "analisis-precios";
  }
  if (ASISTENTE_IA_PREFIXES.some((p) => pathnameMatchesPrefix(pathname, p))) {
    return "asistente-ia";
  }
  return "pedidos";
}

/** Rutas de Análisis de Precios (canónicas o internas) — viven en el área Finanzas en sidebar. */
export function isAnalisisPreciosPathname(pathname: string): boolean {
  return getGpSidebarModule(pathname) === "analisis-precios";
}

/** Invalidación de caché: canónica + interna (+ alias legacy si aplica). */
export function gpRevalidatePaths(canonicalHrefs: readonly string[]): readonly string[] {
  const out = new Set<string>();
  for (const href of canonicalHrefs) {
    out.add(href);
    for (const alias of GP_ROUTE_ALIASES[href] ?? []) {
      out.add(alias);
    }
  }
  return [...out];
}

export const REVALIDATE_LISTA_PRECIOS = gpRevalidatePaths([
  GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios,
  GP_ROUTES.analisisPrecios.listaProveedores.reglasDescuentos,
]);

export const REVALIDATE_PEDIDOS_MERCADERIA = gpRevalidatePaths([
  GP_ROUTES.pedidoMercaderia.pedirMercaderia,
  GP_ROUTES.pedidoMercaderia.generarPedido,
  GP_ROUTES.pedidoMercaderia.confPedido.urgente,
  GP_ROUTES.pedidoMercaderia.confPedido.tintometrico,
  GP_ROUTES.pedidoMercaderia.confPedido.reposicion,
  GP_ROUTES.pedidoMercaderia.recepcionPedido,
  GP_ROUTES.pedidoMercaderia.compras,
]);

export const REVALIDATE_CX_COMPRA = gpRevalidatePaths([
  GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra,
]);

export const REVALIDATE_PX_COMPETENCIA = gpRevalidatePaths([
  GP_ROUTES.analisisPrecios.pxCompetencia,
]);

export const REVALIDATE_LISTA_PROVEEDORES_TABLERO = gpRevalidatePaths([
  GP_ROUTES.analisisPrecios.listaProveedores.lista,
]);

export const REVALIDATE_AYUDA_VENDEDOR_CALC = gpRevalidatePaths([
  GP_ROUTES.ayudaVendedor.calcLitros,
  GP_ROUTES.ayudaVendedor.pxVenta.pxTintometrico,
  GP_ROUTES.ayudaVendedor.controlStock,
  GP_ROUTES.ayudaVendedor.transfDepositos,
  GP_ROUTES.ayudaVendedor.movimientosStock,
]);

export const REVALIDATE_ENVIOS = gpRevalidatePaths([
  GP_ROUTES.envios.programados,
  GP_ROUTES.envios.conductor,
]);
