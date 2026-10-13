/**
 * Áreas principales de la aplicación (macro-secciones).
 * Orden UI: **Ventas** → **Administrador** → **Finanzas** → **Marketing**.
 * URL = `/{área}/{módulo}/{función}` (`APP_ROUTES`): el primer segmento define el área.
 * Los ids internos se conservan por compatibilidad con `usuarios.modulos_permitidos`:
 * `gestion-productos` = Ventas, `finanzas` = Administrador, `area-finanzas` = Finanzas.
 */

import { APP_ROUTES, pathnameEnPrefijo } from "@/lib/appRoutes";

export type MainAppAreaId =
  | "gestion-productos"
  | "finanzas"
  | "marketing"
  | "area-finanzas";

interface MainAppAreaDefinition {
  id: MainAppAreaId;
  /** Título canónico en title case; en UI usar `areaLabelMayusculas(label)` en slidenav y modal de áreas. */
  label: string;
  /** Leyenda de estado bajo el logo (ej. Terminada / A construir). */
  statusLabel: string;
  /** Hub del área (`/{área}`): panel vacío hasta elegir una función en el sidenav. */
  href: string;
}

export const MAIN_APP_AREAS: MainAppAreaDefinition[] = [
  {
    id: "gestion-productos",
    label: "Ventas",
    statusLabel: "Terminada",
    href: APP_ROUTES.ventas.hub,
  },
  {
    id: "finanzas",
    label: "Administrador",
    statusLabel: "A construir",
    href: APP_ROUTES.administrador.hub,
  },
  {
    id: "area-finanzas",
    label: "Finanzas",
    statusLabel: "A construir",
    href: APP_ROUTES.finanzas.hub,
  },
  {
    id: "marketing",
    label: "Marketing",
    statusLabel: "A construir",
    href: APP_ROUTES.marketing.hub,
  },
];

export function getMainAppAreaIdFromPathname(pathname: string): MainAppAreaId {
  if (pathnameEnPrefijo(pathname, APP_ROUTES.administrador.hub)) return "finanzas";
  if (pathnameEnPrefijo(pathname, APP_ROUTES.finanzas.hub)) return "area-finanzas";
  if (pathnameEnPrefijo(pathname, APP_ROUTES.marketing.hub)) return "marketing";
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
