/**
 * Áreas principales de la aplicación (macro-secciones).
 * Orden UI: **Ventas** → **Administrador** → **Finanzas** → **Marketing**.
 * **Ventas** (id `gestion-productos`, ex Vendedor): ventas, clientes, envíos, mercadería, stock y herramientas.
 * **Administrador** (id `finanzas`): análisis M.C., **VTAS. & COBROS**
 * (`/vtas-cobros/...`), Análisis de Precios
 * (URLs de análisis aún bajo `/gestion-productos/analisis-precios/...`), Estadísticas Productos
 * (URLs bajo `/estadisticas-productos/...`) y **Pedido A Fáb.** (`/pedido-a-fabrica`).
 * **Finanzas** (id `area-finanzas`): TESORERIA, BALANCE, OPERACIONES e IMPUESTOS
 * (las pantallas siguen en `/finanzas/...`; el hub vacío es `/area-finanzas`).
 * **Marketing** (id `marketing`).
 */

import {
  GP_ROUTES,
  isAnalisisPreciosPathname,
} from "@/lib/gestionProductosRoutes";

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
  /** Ruta de entrada al elegir el área desde el modal. */
  href: string;
}

export const MAIN_APP_AREAS: MainAppAreaDefinition[] = [
  {
    id: "gestion-productos",
    label: "Ventas",
    statusLabel: "Terminada",
    /** Hub vacío; el usuario elige una ruta hoja en el sidenav. */
    href: GP_ROUTES.defaultEntry,
  },
  {
    id: "finanzas",
    label: "Administrador",
    statusLabel: "A construir",
    /** Hub vacío; no redirige a Tesorería automáticamente. */
    href: "/finanzas",
  },
  {
    id: "area-finanzas",
    label: "Finanzas",
    statusLabel: "A construir",
    /** Hub vacío; Tesorería, Balance, Operaciones e Impuestos se eligen en el sidenav. */
    href: "/area-finanzas",
  },
  {
    id: "marketing",
    label: "Marketing",
    statusLabel: "A construir",
    /** Hub vacío; no redirige a Calendario automáticamente. */
    href: "/marketing",
  },
];

export function getMainAppAreaIdFromPathname(pathname: string): MainAppAreaId {
  // Análisis de Precios: sidebar en Administración; URLs canónicas siguen en /gestion-productos/...
  if (isAnalisisPreciosPathname(pathname)) {
    return "finanzas";
  }
  if (pathname === "/area-finanzas" || pathname.startsWith("/area-finanzas/")) {
    return "area-finanzas";
  }
  if (isModuloFinanzasPathname(pathname)) {
    return "area-finanzas";
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
  // Ventas y Clientes siguen en `/facturacion/...` y pertenecen al área Ventas.
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

/** Pantallas de Tesorería, Balance, Operaciones e Impuestos (siguen bajo `/finanzas/...`). */
const MODULO_FINANZAS_PREFIXES = [
  "/finanzas/tesoreria",
  "/finanzas/venc-por-fecha",
  "/finanzas/balance/mensual",
  "/finanzas/balance/gastos",
  "/finanzas/balance/vtas",
  "/finanzas/balance/posicion-iva",
  "/finanzas/deuda-proveedores",
  "/finanzas/control-comprobantes",
  "/finanzas/vencimientos-gastos",
  "/finanzas/venc-proveedores-mercaderia",
  "/finanzas/posicion-iva",
] as const;

export function isModuloFinanzasPathname(pathname: string): boolean {
  if (pathname === "/finanzas/balance") return true;
  return MODULO_FINANZAS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Nombre del área en MAYÚSCULAS para slidenav y modal (locale `es`). */
export function areaLabelMayusculas(label: string): string {
  return label.toLocaleUpperCase("es");
}
