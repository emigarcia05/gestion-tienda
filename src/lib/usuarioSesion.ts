/**
 * Usuario elegido en la sesión de navegador (onboarding slidenav).
 * La sucursal por defecto se copia a `main-app-sucursal-preferida`.
 */

import {
  isMainAppAreaId,
  type MainAppAreaId,
} from "@/lib/main-app-areas";
import {
  guardarSucursalPreferida,
  parseSucursalPreferida,
  type SucursalPreferida,
} from "@/lib/sucursalPreferida";
import { ordenarModulosPermitidos } from "@/lib/usuarios";

export const STORAGE_USUARIO_SESION = "main-app-usuario-sesion";

export const EVENTO_USUARIO_SESION = "main-app-usuario-sesion-changed";

export type UsuarioSesion = {
  idPersonal: number;
  nombrePersonal: string;
  sucursalPorDefecto: SucursalPreferida;
  modulosPermitidos: MainAppAreaId[];
};

function parseUsuarioSesion(raw: unknown): UsuarioSesion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.idPersonal !== "number" || !Number.isInteger(o.idPersonal) || o.idPersonal <= 0) {
    return null;
  }
  if (typeof o.nombrePersonal !== "string" || o.nombrePersonal.trim() === "") {
    return null;
  }
  const sucursal = parseSucursalPreferida(
    typeof o.sucursalPorDefecto === "string" ? o.sucursalPorDefecto : null
  );
  if (!sucursal) return null;
  if (!Array.isArray(o.modulosPermitidos)) return null;
  const modulos = ordenarModulosPermitidos(
    o.modulosPermitidos.filter((m): m is string => typeof m === "string" && isMainAppAreaId(m))
  );
  if (modulos.length === 0) return null;
  return {
    idPersonal: o.idPersonal,
    nombrePersonal: o.nombrePersonal.trim(),
    sucursalPorDefecto: sucursal,
    modulosPermitidos: modulos,
  };
}

export function leerUsuarioSesion(): UsuarioSesion | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_USUARIO_SESION);
    if (!raw) return null;
    return parseUsuarioSesion(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function guardarUsuarioSesion(usuario: UsuarioSesion): void {
  try {
    sessionStorage.setItem(STORAGE_USUARIO_SESION, JSON.stringify(usuario));
    guardarSucursalPreferida(usuario.sucursalPorDefecto);
    window.dispatchEvent(new Event(EVENTO_USUARIO_SESION));
  } catch {
    /* ignore */
  }
}

export function usuarioSesionDesdeItem(item: {
  idPersonal: number;
  nombrePersonal: string;
  sucursalPorDefecto: SucursalPreferida | null;
  modulosPermitidos: MainAppAreaId[];
}): UsuarioSesion | null {
  if (!item.sucursalPorDefecto || item.modulosPermitidos.length === 0) {
    return null;
  }
  return {
    idPersonal: item.idPersonal,
    nombrePersonal: item.nombrePersonal,
    sucursalPorDefecto: item.sucursalPorDefecto,
    modulosPermitidos: ordenarModulosPermitidos(item.modulosPermitidos),
  };
}
