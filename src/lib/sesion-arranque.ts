/**
 * Primera petición tras abrir el navegador (cookie de sesión ausente): el middleware
 * limpia la cookie iron-session y redirige a `/ingresar` (se pide la contraseña en cada arranque).
 */
export const SESION_APP_BOOT_COOKIE = "tienda-app-arranque";

/** Cabecera interna que el middleware añade al request cuando limpia el rol en ese mismo ciclo. */
export const SESION_FORZAR_ROL_SIMPLE_HEADER = "x-tienda-forzar-rol-simple";

/** Cabecera interna con el pathname (el layout raíz decide si exige ingreso). */
export const SESION_PATHNAME_HEADER = "x-tienda-pathname";

/** Nombre de la cookie iron-session (debe coincidir con `cookieName` en `sesion.ts`). */
export const SESION_ROL_IRON_COOKIE = "gestion-rol";
