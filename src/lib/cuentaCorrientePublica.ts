/** Visor público de cuenta corriente (link para el cliente). Sin sidenav. */

export type CuentaCorrientePublicaCuenta = {
  id: string;
  etiqueta: string;
};

export type CuentaCorrientePublicaSesion = {
  titularId: string;
  cuentas: CuentaCorrientePublicaCuenta[];
};

export const CUENTA_CORRIENTE_PUBLICA_BASE = "/cc";

export const SESION_CC_VISOR_COOKIE = "tienda-cc-visor";

export const CUENTA_CORRIENTE_TOKEN_MIN = 20;
export const CUENTA_CORRIENTE_TOKEN_MAX = 64;

const TOKEN_RE = /^[A-Za-z0-9_-]+$/;

export function rutaCuentaCorrientePublica(token: string): string {
  return `${CUENTA_CORRIENTE_PUBLICA_BASE}/${token}`;
}

export function esRutaCuentaCorrientePublica(pathname: string): boolean {
  return (
    pathname === CUENTA_CORRIENTE_PUBLICA_BASE ||
    pathname.startsWith(`${CUENTA_CORRIENTE_PUBLICA_BASE}/`)
  );
}

export function tokenCuentaCorrienteDesdePath(pathname: string): string | null {
  if (!pathname.startsWith(`${CUENTA_CORRIENTE_PUBLICA_BASE}/`)) return null;
  const token = pathname.slice(CUENTA_CORRIENTE_PUBLICA_BASE.length + 1).split("/")[0] ?? "";
  if (
    token.length < CUENTA_CORRIENTE_TOKEN_MIN ||
    token.length > CUENTA_CORRIENTE_TOKEN_MAX ||
    !TOKEN_RE.test(token)
  ) {
    return null;
  }
  return token;
}
