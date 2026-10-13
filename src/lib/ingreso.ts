import type { Rol } from "@/lib/permisos";
import type { MainAppAreaId } from "@/lib/main-app-areas";

/** Pantalla de ingreso (sin slidenav). */
export const RUTA_INGRESO = "/ingresar";

export function esRutaIngreso(pathname: string): boolean {
  return pathname === RUTA_INGRESO || pathname.startsWith(`${RUTA_INGRESO}/`);
}

/** Rol `editor` = usuario con el módulo **Administrador** (`finanzas`) habilitado. */
export function rolDesdeModulosPermitidos(modulos: readonly MainAppAreaId[]): Rol {
  return modulos.includes("finanzas") ? "editor" : "simple";
}
