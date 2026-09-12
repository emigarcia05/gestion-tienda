/**
 * Áreas principales de la aplicación (macro-secciones).
 * **Vendedor** (id `gestion-productos`): pedidos, ayuda vendedor, asistente IA.
 * **Administración** (id `finanzas`): balance, tesorería, análisis M.C., **VTAS. & COBROS**
 * (`/vtas-cobros/...`), Análisis de Precios
 * (URLs de análisis aún bajo `/gestion-productos/analisis-precios/...`), Estadísticas Productos
 * (URLs bajo `/estadisticas-productos/...`) y **Pedido A Fáb.** (`/pedido-a-fabrica`).
 * **Marketing** (id `marketing`).
 * **Facturación** (id `facturacion`): módulo Factura (Crear / Facturas / Presupuestos).
 */

import {
  GP_ROUTES,
  isAnalisisPreciosPathname,
} from "@/lib/gestionProductosRoutes";

export type MainAppAreaId =
  | "gestion-productos"
  | "finanzas"
  | "marketing"
  | "facturacion";

interface MainAppAreaDefinition {
  id: MainAppAreaId;
  /** Título canónico en title case; en UI usar `areaLabelMayusculas(label)` en slidenav y modal de áreas. */
  label: string;
  /** Leyenda de estado bajo el logo (ej. Terminada / A construir). */
  statusLabel: string;
  /** Ruta de entrada al elegir el área desde el modal. */
  href: string;
  /**
   * Si `true`, al elegir el área desde el switcher se pide `EDITOR_PASSWORD`
   * (activa rol `editor`) cuando la sesión aún es `simple`.
   */
  requierePassword: boolean;
}

export const MAIN_APP_AREAS: MainAppAreaDefinition[] = [
  {
    id: "gestion-productos",
    label: "Vendedor",
    statusLabel: "Terminada",
    /** Hub vacío; el usuario elige una ruta hoja en el sidenav. */
    href: GP_ROUTES.defaultEntry,
    requierePassword: false,
  },
  {
    id: "finanzas",
    label: "Administración",
    statusLabel: "A construir",
    /** Hub vacío; no redirige a Tesorería automáticamente. */
    href: "/finanzas",
    requierePassword: true,
  },
  {
    id: "marketing",
    label: "Marketing",
    statusLabel: "A construir",
    /** Hub vacío; no redirige a Calendario automáticamente. */
    href: "/marketing",
    requierePassword: false,
  },
  {
    id: "facturacion",
    label: "Facturación",
    statusLabel: "A construir",
    /** Hub vacío; el usuario elige una ruta hoja en el sidenav. */
    href: "/facturacion",
    requierePassword: false,
  },
];

export function getMainAppAreaIdFromPathname(pathname: string): MainAppAreaId {
  // Análisis de Precios: sidebar en Administración; URLs canónicas siguen en /gestion-productos/...
  if (isAnalisisPreciosPathname(pathname)) {
    return "finanzas";
  }
  if (pathname === "/finanzas" || pathname.startsWith("/finanzas/")) {
    return "finanzas";
  }
  if (pathname === "/vtas-cobros" || pathname.startsWith("/vtas-cobros/")) {
    return "finanzas";
  }
  // Estadísticas Productos vive en área Administración (URLs bajo /estadisticas-productos/...).
  if (
    pathname === "/estadisticas-productos" ||
    pathname.startsWith("/estadisticas-productos/")
  ) {
    return "finanzas";
  }
  // Pedido A Fáb. (Administración).
  if (pathname === "/pedido-a-fabrica" || pathname.startsWith("/pedido-a-fabrica/")) {
    return "finanzas";
  }
  if (pathname === "/marketing" || pathname.startsWith("/marketing/")) {
    return "marketing";
  }
  if (pathname === "/facturacion" || pathname.startsWith("/facturacion/")) {
    return "facturacion";
  }
  // Vendedor (id `gestion-productos`) — resto de rutas GP y legacy.
  return "gestion-productos";
}

export function getMainAppAreaById(id: MainAppAreaId): MainAppAreaDefinition {
  const found = MAIN_APP_AREAS.find((a) => a.id === id);
  if (!found) {
    throw new Error(`Unknown main app area: ${id}`);
  }
  return found;
}

export function isMainAppAreaId(value: string): value is MainAppAreaId {
  return MAIN_APP_AREAS.some((area) => area.id === value);
}

/** Nombre del área en MAYÚSCULAS para slidenav y modal (locale `es`). */
export function areaLabelMayusculas(label: string): string {
  return label.toLocaleUpperCase("es");
}
