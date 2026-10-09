/**
 * Navegación de las áreas **Administrador** (`ADM_PILLARS`) y **Finanzas** (`FIN_PILLARS`):
 * recuadro de pilares (módulos) en el sidenav (`AdministracionAccordionNav`), cada uno con
 * sus funciones en una sola lista. URL = `/{área}/{módulo}/{función}` (`APP_ROUTES`):
 * el pilar activo es el que contiene la URL (`basePath`).
 */

import { APP_ROUTES, pathnameEnPrefijo } from "@/lib/appRoutes";
import { PERMISOS } from "@/lib/permisos";

export type AdmPillarId =
  | "tesoreria"
  | "balance"
  | "operaciones"
  | "impuestos"
  | "vtas-cobros"
  | "lista-propia"
  | "lista-proveedores"
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
  | "users"
  | "store"
  | "package";

export interface AdmScreenDef {
  id: string;
  label: string;
  href: string;
  icon: AdmIconId;
  permiso: { simple: boolean; editor: boolean };
}

/** Grupo histórico. La navegación no lo muestra: las funciones van planas en el pilar. */
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
  /** Prefijo `/{área}/{módulo}`: toda función del pilar vive debajo. */
  basePath: string;
  /** Primer nivel bajo el módulo: solo funciones. `groups` queda por compatibilidad y se aplana. */
  groups?: AdmGroupDef[];
  screens?: AdmScreenDef[];
}

const F = APP_ROUTES.finanzas;
const A = APP_ROUTES.administrador;

const flujosScreens: AdmScreenDef[] = [
  {
    id: "tesoreria",
    label: "Cajas",
    href: F.tesoreria.cajas,
    icon: "banknote",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "tesoreria-movimientos",
    label: "Movimientos",
    href: F.tesoreria.movimientos,
    icon: "list",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "flujo-de-fondos",
    label: "Flujo De Fondos",
    href: F.tesoreria.flujoDeFondos,
    icon: "calendar-days",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const balanceScreens: AdmScreenDef[] = [
  {
    id: "balance-mensual",
    label: "Balance Mensual",
    href: F.balance.balanceMensual,
    icon: "scale",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "gastos",
    label: "Gastos",
    href: F.balance.gastos,
    icon: "receipt",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "catalogo-gastos",
    label: "Catálogo Gastos",
    href: F.balance.catalogoGastos,
    icon: "folder-tree",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "ventas-mensuales",
    label: "Ventas Mensuales",
    href: F.balance.ventasMensuales,
    icon: "circle-dollar",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const operacionesScreens: AdmScreenDef[] = [
  {
    id: "control-comprobantes",
    label: "Comp. Compras",
    href: F.operaciones.compCompras,
    icon: "file-search",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "venc-provee-gastos",
    label: "Venc. Gastos",
    href: F.operaciones.vencGastos,
    icon: "calendar-clock",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const cobrosScreens: AdmScreenDef[] = [
  {
    id: "ptos-venta",
    label: "Ptos. Vtas.",
    href: F.cobros.ptosVtas,
    icon: "store",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "cx-fin-cobros",
    label: "Cobros & Cx. Fin.",
    href: F.cobros.cobrosCxFin,
    icon: "circle-dollar",
    permiso: PERMISOS.finanzas.acceso,
  },
  {
    id: "cobros-por-sucursal",
    label: "Cobros & Cajas",
    href: F.cobros.cobrosCajas,
    icon: "wallet",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const impuestosScreens: AdmScreenDef[] = [
  {
    id: "posicion-iva",
    label: "Posición De IVA",
    href: F.impuestos.posicionIva,
    icon: "percent",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const productosScreens: AdmScreenDef[] = [
  {
    id: "lista-productos",
    label: "Lista Productos",
    href: A.productos.listaProductos,
    icon: "package",
    permiso: PERMISOS.tienda.acceso,
  },
  {
    id: "px-listas",
    label: "Px. Listas",
    href: A.productos.pxListas,
    icon: "circle-dollar",
    permiso: PERMISOS.cxPxTienda.acceso,
  },
  {
    id: "px-competencia",
    label: "Px. Competencia",
    href: A.productos.pxCompetencia,
    icon: "circle-dollar",
    permiso: PERMISOS.cxPxTienda.acceso,
  },
  {
    id: "categorias",
    label: "Análisis Cat.",
    href: A.productos.analisisCat,
    icon: "folder-tree",
    permiso: PERMISOS.comparacionCategorias.acceso,
  },
  {
    id: "margen-contribucion",
    label: "Margen Contribución",
    href: A.productos.margenContribucion,
    icon: "pie-chart",
    permiso: PERMISOS.finanzas.acceso,
  },
];

const proveedoresScreens: AdmScreenDef[] = [
  {
    id: "lista-precios",
    label: "Lista Prod. Prov.",
    href: A.proveedores.listaProdProv,
    icon: "file-search",
    permiso: PERMISOS.proveedores.listaPrecios,
  },
  {
    id: "lista-proveedores",
    label: "Proveedores",
    href: A.proveedores.proveedores,
    icon: "list",
    permiso: PERMISOS.proveedores.lista,
  },
];

const pedidosAFabricaScreens: AdmScreenDef[] = [
  {
    id: "pedido-a-fabrica",
    label: "Pedidos A Fábrica",
    href: A.pedidosAFabrica.pedidosAFabrica,
    icon: "factory",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
];

const estadisticasScreens: AdmScreenDef[] = [
  {
    id: "estadisticas-vtas",
    label: "VENTAS",
    href: A.estadisticas.ventas,
    icon: "line-chart",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
  {
    id: "carga-de-datos",
    label: "Carga De Datos",
    href: A.estadisticas.cargaDeDatos,
    icon: "package-search",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
  {
    id: "categorizacion",
    label: "Configuracion",
    href: A.estadisticas.configuracion,
    icon: "tags",
    permiso: PERMISOS.estadisticasProductos.acceso,
  },
];

const usuariosScreens: AdmScreenDef[] = [
  {
    id: "usuarios",
    label: "Usuarios",
    href: A.usuarios.usuarios,
    icon: "users",
    permiso: PERMISOS.usuarios.acceso,
  },
];

export const FIN_PILLARS: AdmPillarDef[] = [
  {
    id: "tesoreria",
    label: "TESORERIA",
    icon: "banknote",
    basePath: `${F.hub}/tesoreria`,
    screens: flujosScreens,
  },
  {
    id: "balance",
    label: "BALANCE",
    icon: "scale",
    basePath: F.balance.raiz,
    screens: balanceScreens,
  },
  {
    id: "operaciones",
    label: "OPERACIONES",
    icon: "wallet",
    basePath: `${F.hub}/operaciones`,
    screens: operacionesScreens,
  },
  {
    id: "vtas-cobros",
    label: "COBROS",
    icon: "circle-dollar",
    basePath: `${F.hub}/cobros`,
    screens: cobrosScreens,
  },
  {
    id: "impuestos",
    label: "IMPUESTOS",
    icon: "percent",
    basePath: `${F.hub}/impuestos`,
    screens: impuestosScreens,
  },
];

export const ADM_PILLARS: AdmPillarDef[] = [
  {
    id: "lista-propia",
    label: "PRODUCTOS",
    icon: "store",
    basePath: `${A.hub}/productos`,
    screens: productosScreens,
  },
  {
    id: "lista-proveedores",
    label: "PROVEEDORES",
    icon: "handshake",
    basePath: `${A.hub}/proveedores`,
    screens: proveedoresScreens,
  },
  {
    id: "pedido-a-fabrica",
    label: "PEDIDOS A FÁBRICA",
    icon: "factory",
    basePath: `${A.hub}/pedidos-a-fabrica`,
    screens: pedidosAFabricaScreens,
  },
  {
    id: "estadisticas",
    label: "ESTADÍSTICAS",
    icon: "bar-chart-3",
    basePath: `${A.hub}/estadisticas`,
    screens: estadisticasScreens,
  },
  {
    id: "usuarios",
    label: "USUARIOS",
    icon: "users",
    basePath: `${A.hub}/usuarios`,
    screens: usuariosScreens,
  },
];

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
  // Prefijo más largo gana entre todos los screens (ej. Balance Gastos vs Catálogo Gastos).
  let best: AdmScreenDef | null = null;
  for (const pillar of [...FIN_PILLARS, ...ADM_PILLARS]) {
    for (const s of collectPillarScreens(pillar)) {
      if (!pathnameEnPrefijo(pathname, s.href)) continue;
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

/** El pilar (módulo) está activo si la URL cae bajo `/{área}/{módulo}`. */
export function isAdmPillarActive(pathname: string, pillar: AdmPillarDef): boolean {
  return pathnameEnPrefijo(pathname, pillar.basePath);
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
