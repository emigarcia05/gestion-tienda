/**
 * Sucursal preferida de la sesión de navegador (slidenav).
 * Default de filtros; en Trans. Depósitos una punta del par queda fija en la sucursal del usuario.
 */

export type SucursalPreferida = "guaymallen" | "maipu";

export const SUCURSALES_PREFERIDAS: {
  value: SucursalPreferida;
  label: string;
}[] = [
  { value: "guaymallen", label: "GUAYMALLÉN" },
  { value: "maipu", label: "MAIPÚ" },
];

/** Sesión de navegador: sucursal elegida junto al módulo. */
export const STORAGE_SUCURSAL_PREFERIDA = "main-app-sucursal-preferida";

/** Evento de ventana: la sucursal preferida cambió en esta pestaña. */
export const EVENTO_SUCURSAL_PREFERIDA = "main-app-sucursal-preferida-changed";

export function parseSucursalPreferida(
  raw: string | null | undefined
): SucursalPreferida | null {
  return raw === "guaymallen" || raw === "maipu" ? raw : null;
}

export function leerSucursalPreferida(): SucursalPreferida | null {
  try {
    return parseSucursalPreferida(
      sessionStorage.getItem(STORAGE_SUCURSAL_PREFERIDA)
    );
  } catch {
    return null;
  }
}

export function guardarSucursalPreferida(codigo: SucursalPreferida): void {
  try {
    sessionStorage.setItem(STORAGE_SUCURSAL_PREFERIDA, codigo);
    window.dispatchEvent(new Event(EVENTO_SUCURSAL_PREFERIDA));
  } catch {
    /* ignore */
  }
}

export function sucursalPreferidaLabel(codigo: SucursalPreferida): string {
  const found = SUCURSALES_PREFERIDAS.find((s) => s.value === codigo);
  return found?.label ?? codigo.toLocaleUpperCase("es");
}
