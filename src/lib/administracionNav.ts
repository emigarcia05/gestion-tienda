/**
 * Navegación del área **Administración**: 5 pilares en sidebar + árbol
 * de decisiones en acordeón vertical (`AdministracionAccordionNav`).
 *
 * FINANZAS → BALANCE | OPERACIONES (FLUJOS / COMPRAS / GASTOS) | IMPUESTOS → pantallas
 * LISTA PRECIOS → PX TIENDA | PROVEEDORES | ANÁLISIS M.C. → pantallas
 * PEDIDO A FÁB. → pantallas
 * ESTADÍSTICAS → VENTAS (pantalla) | CONFIGURACION → pantallas
 * USUARIOS → pantallas
 */

import {
  GP_ROUTES,
  isAnalisisPreciosPathname,
  isGpRouteActive,
} from "@/lib/gestionProductosRoutes";
import { ESTADISTICAS_PRODUCTOS_ROUTES } from "@/lib/estadisticasProductosRoutes";
import {
  PEDIDO_A_FABRICA_LEGACY_PATH,
  PEDIDO_A_FABRICA_ROUTES,
} from "@/lib/pedidoAFabricaRoutes";
import { PERMISOS } from "@/lib/permisos";
import { USUARIOS_PATH } from "@/lib/usuarios";

export type AdmPillarId =
  | "finanzas"
  | "listas-precios"
  | "pedido-a-fabrica"
  | "estadisticas"
  | "usuarios";

export type AdmIconId =
  | "landmark"
  | "handshake"
  | "bar-chart-3"
  | "factory"
  | "settings"
  | "scale"
  | "receipt"
  | "folder-tree"
  | "circle-dollar"
  | "banknote"
  | "percent"
  | "calendar-days"
  | "wallet"
  | "calendar-clock"
  | "file-search"
  | "line-chart"
  | "pie-chart"
  | "list"
  | "link-2"
  | "package-search"
  | "tags"
  | "users";

export interface AdmScreenDef {
  id: string;
  label: string;
  href: string;
  icon: AdmIconId;
  permiso: { simple: boolean; editor: boolean };
}

/** Grupo intermedio del acordeón (abre pantallas hijas o subgrupos). */
export interface AdmGroupDef {
  id: string;
  label: string;
  icon: AdmIconId;
  screens?: AdmScreenDef[];
  groups?: AdmGroupDef[];
}

export interface AdmPillarDef {
  id: AdmPillarId;
  /** Label sidebar (MAYÚSCULAS). */
  label: string;
  icon: AdmIconId;
  /**
   * Primer desglose: grupos (acordeón anidado) y/o pantallas directas.
   * Si hay ambos, se renderizan pantallas y luego grupos.
   */
  groups?: AdmGroupDef[];
  screens?: AdmScreenDef[];
}

const balanceScreens: AdmScreenDef[] = [
  {
    id: "balance-mensual",
    label: "Balance Mensual",
    href: "/finanzas/balance/mensual",
    icon: "scale",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "gastos",
    label: "Gastos",
    href: "/finanzas/balance/gastos",
    icon: "receipt",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "catalogo-gastos",
    label: "Catálogo Gastos",
    href: "/finanzas/balance/gastos/catalogo",
    icon: "folder-tree",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "ventas-mensuales",
    label: "Ventas Mensuales",
    href: "/finanzas/balance/vtas",
    icon: "circle-dollar",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const flujosScreens: AdmScreenDef[] = [
  {
    id: "tesoreria",
    label: "Tesorería",
    href: "/finanzas/tesoreria",
    icon: "banknote",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "flujo-de-fondos",
    label: "Flujo De Fondos",
    href: "/finanzas/venc-por-fecha",
    icon: "calendar-days",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const impuestosScreens: AdmScreenDef[] = [
  {
    id: "posicion-iva",
    label: "Posición De IVA",
    href: "/finanzas/posicion-iva",
    icon: "percent",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const comprasScreens: AdmScreenDef[] = [
  {
    id: "venc-provee-merc",
    label: "Resumen Venc.",
    href: "/finanzas/deuda-proveedores",
    icon: "wallet",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "control-comprobantes",
    label: "Comprobantes",
    href: "/finanzas/control-comprobantes",
    icon: "file-search",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const gastosScreens: AdmScreenDef[] = [
  {
    id: "venc-provee-gastos",
    label: "Resumen Venc.",
    href: "/finanzas/vencimientos-gastos",
    icon: "calendar-clock",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const operacionesGroups: AdmGroupDef[] = [
  {
    id: "flujos",
    label: "FLUJOS",
    icon: "calendar-days",
    screens: flujosScreens,
  },
  {
    id: "compras",
    label: "COMPRAS",
    icon: "file-search",
    screens: comprasScreens,
  },
  {
    id: "gastos",
    label: "GASTOS",
    icon: "receipt",
    screens: gastosScreens,
  },
];

const pxTiendaScreens: AdmScreenDef[] = [
  {
    id: "cx-compra",
    label: "Cx. Compra",
    href: GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra,
    icon: "link-2",
    permiso: PERMISOS.tienda.acceso,
  },
  {
    id: "px-listas",
    label: "Px. Listas",
    href: GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas,
    icon: "circle-dollar",
    permiso: PERMISOS.cxPxTienda.acceso,
  },
  {
    id: "px-competencia",
    label: "Px. Competencia",
    href: GP_ROUTES.analisisPrecios.pxCompetencia,
    icon: "circle-dollar",
    permiso: PERMISOS.cxPxTienda.acceso,
  },
  {
    id: "categorias",
    label: "Analisis Por Cat.",
    href: GP_ROUTES.analisisPrecios.compCategorias.comparacion,
    icon: "folder-tree",
    permiso: PERMISOS.comparacionCategorias.acceso,
  },
];

const proveedoresScreens: AdmScreenDef[] = [
  {
    id: "lista-precios",
    label: "Listas Px Prov.",
    href: GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios,
    icon: "file-search",
    permiso: PERMISOS.proveedores.listaPrecios,
  },
  {
    id: "lista-proveedores",
    label: "Lista Prov.",
    href: GP_ROUTES.analisisPrecios.listaProveedores.lista,
    icon: "list",
    permiso: PERMISOS.proveedores.lista,
  },
];

const analisisMcScreens: AdmScreenDef[] = [
  {
    id: "margen-contribucion",
    label: "Margen Contribución",
    href: "/finanzas/analisis-mc/margen-contribucion",
    icon: "pie-chart",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "costos-financieros",
    label: "Cx. Financieros",
    href: "/finanzas/analisis-mc/costos-financieros",
    icon: "circle-dollar",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const pedidoAFabricaScreens: AdmScreenDef[] = [
  {
    id: "pedido-a-fabrica",
    label: "Pedido A Fáb.",
    href: PEDIDO_A_FABRICA_ROUTES.defaultEntry,
    icon: "factory",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
];

/** Pantalla directa bajo ESTADÍSTICAS (sin grupo intermedio). */
const estadisticasVentasScreens: AdmScreenDef[] = [
  {
    id: "estadisticas-vtas",
    label: "VENTAS",
    href: ESTADISTICAS_PRODUCTOS_ROUTES.estadisticasVtas,
    icon: "line-chart",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
];

const estadisticasConfiguracionScreens: AdmScreenDef[] = [
  {
    id: "carga-de-datos",
    label: "Carga De Datos",
    href: ESTADISTICAS_PRODUCTOS_ROUTES.ventasPorProducto,
    icon: "package-search",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
  {
    id: "categorizacion",
    label: "Configuracion",
    href: ESTADISTICAS_PRODUCTOS_ROUTES.categorizacion,
    icon: "tags",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
];

const usuariosScreens: AdmScreenDef[] = [
  {
    id: "usuarios",
    label: "Usuarios",
    href: USUARIOS_PATH,
    icon: "users",
    permiso: PERMISOS.usuarios.acceso,
  },
];

export const ADM_PILLARS: AdmPillarDef[] = [
  {
    id: "finanzas",
    label: "FINANZAS",
    icon: "landmark",
    groups: [
      {
        id: "balance",
        label: "BALANCE",
        icon: "scale",
        screens: balanceScreens,
      },
      {
        id: "operaciones",
        label: "OPERACIONES",
        icon: "banknote",
        groups: operacionesGroups,
      },
      {
        id: "impuestos",
        label: "IMPUESTOS",
        icon: "percent",
        screens: impuestosScreens,
      },
    ],
  },
  {
    id: "listas-precios",
    label: "LISTA PRECIOS",
    icon: "handshake",
    groups: [
      {
        id: "px-tienda",
        label: "PX TIENDA",
        icon: "circle-dollar",
        screens: pxTiendaScreens,
      },
      {
        id: "proveedores",
        label: "PROVEEDORES",
        icon: "list",
        screens: proveedoresScreens,
      },
      {
        id: "analisis-mc",
        label: "ANÁLISIS M.C.",
        icon: "line-chart",
        screens: analisisMcScreens,
      },
    ],
  },
  {
    id: "pedido-a-fabrica",
    label: "PEDIDO A FÁB.",
    icon: "factory",
    screens: pedidoAFabricaScreens,
  },
  {
    id: "estadisticas",
    label: "ESTADÍSTICAS",
    icon: "bar-chart-3",
    screens: estadisticasVentasScreens,
    groups: [
      {
        id: "configuracion",
        label: "CONFIGURACION",
        icon: "settings",
        screens: estadisticasConfiguracionScreens,
      },
    ],
  },
  {
    id: "usuarios",
    label: "USUARIOS",
    icon: "users",
    screens: usuariosScreens,
  },
];

function pathnameMatchesScreen(pathname: string, href: string): boolean {
  if (
    href.startsWith("/gestion-productos") ||
    href.startsWith("/proveedores") ||
    href.startsWith("/tienda")
  ) {
    return isGpRouteActive(pathname, href);
  }
  if (href === PEDIDO_A_FABRICA_ROUTES.defaultEntry) {
    return (
      pathname === PEDIDO_A_FABRICA_ROUTES.defaultEntry ||
      pathname.startsWith(`${PEDIDO_A_FABRICA_ROUTES.defaultEntry}/`) ||
      pathname === PEDIDO_A_FABRICA_LEGACY_PATH ||
      pathname.startsWith(`${PEDIDO_A_FABRICA_LEGACY_PATH}/`)
    );
  }
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function collectGroupScreens(group: AdmGroupDef): AdmScreenDef[] {
  const fromScreens = group.screens ?? [];
  const fromGroups = (group.groups ?? []).flatMap(collectGroupScreens);
  return [...fromScreens, ...fromGroups];
}

function collectPillarScreens(pillar: AdmPillarDef): AdmScreenDef[] {
  const fromScreens = pillar.screens ?? [];
  const fromGroups = pillar.groups?.flatMap(collectGroupScreens) ?? [];
  return [...fromScreens, ...fromGroups];
}

export function isAdmScreenActive(pathname: string, screen: AdmScreenDef): boolean {
  // Prefijo más largo gana entre todos los screens del área (catálogo vs gastos).
  let best: AdmScreenDef | null = null;
  for (const pillar of ADM_PILLARS) {
    for (const s of collectPillarScreens(pillar)) {
      if (!pathnameMatchesScreen(pathname, s.href)) continue;
      if (!best || s.href.length > best.href.length) best = s;
    }
  }
  return best?.id === screen.id;
}

export function isAdmGroupActive(pathname: string, group: AdmGroupDef): boolean {
  const screens = group.screens ?? [];
  if (screens.some((s) => isAdmScreenActive(pathname, s))) return true;
  return (group.groups ?? []).some((g) => isAdmGroupActive(pathname, g));
}

export function isAdmPillarActive(pathname: string, pillar: AdmPillarDef): boolean {
  if (pillar.id === "listas-precios") {
    if (isAnalisisPreciosPathname(pathname)) return true;
    if (pathname.startsWith("/finanzas/analisis-mc")) return true;
    return collectPillarScreens(pillar).some((s) => isAdmScreenActive(pathname, s));
  }
  if (pillar.id === "pedido-a-fabrica") {
    return (
      pathname === PEDIDO_A_FABRICA_ROUTES.defaultEntry ||
      pathname.startsWith(`${PEDIDO_A_FABRICA_ROUTES.defaultEntry}/`) ||
      pathname === PEDIDO_A_FABRICA_LEGACY_PATH ||
      pathname.startsWith(`${PEDIDO_A_FABRICA_LEGACY_PATH}/`)
    );
  }
  if (pillar.id === "estadisticas") {
    if (
      pathname === PEDIDO_A_FABRICA_LEGACY_PATH ||
      pathname.startsWith(`${PEDIDO_A_FABRICA_LEGACY_PATH}/`)
    ) {
      return false;
    }
    return (
      pathname.startsWith("/estadisticas-productos") ||
      collectPillarScreens(pillar).some((s) => isAdmScreenActive(pathname, s))
    );
  }
  if (pillar.id === "usuarios") {
    return pathname === USUARIOS_PATH || pathname.startsWith(`${USUARIOS_PATH}/`);
  }
  // FINANZAS: /finanzas/* excepto analisis-mc (LISTA PRECIOS) y usuarios (USUARIOS)
  if (pathname.startsWith("/finanzas/analisis-mc")) return false;
  if (pathname === USUARIOS_PATH || pathname.startsWith(`${USUARIOS_PATH}/`)) {
    return false;
  }
  return (
    pathname === "/finanzas" ||
    pathname.startsWith("/finanzas/") ||
    collectPillarScreens(pillar).some((s) => isAdmScreenActive(pathname, s))
  );
}

export function pillarHasVisibleItems(
  pillar: AdmPillarDef,
  puedeFn: (permiso: { simple: boolean; editor: boolean }) => boolean
): boolean {
  return collectPillarScreens(pillar).some((s) => puedeFn(s.permiso));
}

export function filterVisibleScreens(
  screens: AdmScreenDef[],
  puedeFn: (permiso: { simple: boolean; editor: boolean }) => boolean
): AdmScreenDef[] {
  return screens.filter((s) => puedeFn(s.permiso));
}

export function filterVisibleGroups(
  groups: AdmGroupDef[],
  puedeFn: (permiso: { simple: boolean; editor: boolean }) => boolean
): AdmGroupDef[] {
  return groups
    .map((g) => {
      const nestedGroups = g.groups ? filterVisibleGroups(g.groups, puedeFn) : [];
      const screens = g.screens ? filterVisibleScreens(g.screens, puedeFn) : [];
      return {
        ...g,
        screens: screens.length > 0 ? screens : undefined,
        groups: nestedGroups.length > 0 ? nestedGroups : undefined,
      };
    })
    .filter((g) => (g.screens?.length ?? 0) > 0 || (g.groups?.length ?? 0) > 0);
}
