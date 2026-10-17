/**
 * Visor público del Conductor (link sin login para el celular del chofer). Sin sidenav; el middleware
 * lo encierra en `/conductor/{token}` mientras tenga la cookie. Apto para middleware (sin APIs de Node);
 * la validación contra `ENVIOS_CONDUCTOR_TOKEN` vive en `enviosConductorPublico.service.ts`.
 */

export const ENVIOS_CONDUCTOR_PUBLICO_BASE = "/conductor";

export const SESION_CONDUCTOR_VISOR_COOKIE = "tienda-conductor-visor";

export const ENVIOS_CONDUCTOR_TOKEN_MIN = 32;
export const ENVIOS_CONDUCTOR_TOKEN_MAX = 128;

const TOKEN_RE = /^[A-Za-z0-9_-]+$/;

export function tokenEnviosConductorFormatoValido(token: string): boolean {
  return (
    token.length >= ENVIOS_CONDUCTOR_TOKEN_MIN &&
    token.length <= ENVIOS_CONDUCTOR_TOKEN_MAX &&
    TOKEN_RE.test(token)
  );
}

export function rutaEnviosConductorPublica(token: string): string {
  return `${ENVIOS_CONDUCTOR_PUBLICO_BASE}/${token}`;
}

export function esRutaEnviosConductorPublica(pathname: string): boolean {
  return (
    pathname === ENVIOS_CONDUCTOR_PUBLICO_BASE ||
    pathname.startsWith(`${ENVIOS_CONDUCTOR_PUBLICO_BASE}/`)
  );
}

export function tokenEnviosConductorDesdePath(pathname: string): string | null {
  if (!pathname.startsWith(`${ENVIOS_CONDUCTOR_PUBLICO_BASE}/`)) return null;
  const token = pathname.slice(ENVIOS_CONDUCTOR_PUBLICO_BASE.length + 1).split("/")[0] ?? "";
  return tokenEnviosConductorFormatoValido(token) ? token : null;
}
