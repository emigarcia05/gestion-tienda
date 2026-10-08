import { getIronSession, IronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import type { Rol } from "./permisos";
import {
  SESION_FORZAR_ROL_SIMPLE_HEADER,
  SESION_ROL_IRON_COOKIE,
} from "./sesion-arranque";

export interface SesionData {
  rol: Rol;
  /** Usuario que ingresó con contraseña (`usuarios.id_personal`). Sin valor = sin ingreso. */
  idPersonal?: number;
}

/** Fallback dev (≥32) para iron-session. */
const DEV_SESSION_PASSWORD = "dev-secret-min-32-chars-para-iron-session";
/** Solo para `next build` con NODE_ENV=production y sin secret válido (collect static). */
const BUILD_PLACEHOLDER_PASSWORD =
  "next-build-placeholder-use-real-SESSION_SECRET-in-.env";

function isLikelyNextBuildProcess(): boolean {
  // Next.js fija esto en el proceso principal y en workers durante `next build`.
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  if (process.env.npm_lifecycle_event === "build") return true;
  const args = process.argv;
  if (!args.includes("build")) return false;
  return args.some((arg) => {
    const n = arg.replace(/\\/g, "/");
    return (
      n.endsWith("/next") ||
      n.endsWith("/next.js") ||
      n.includes("/next/dist/") ||
      n.includes("node_modules/next/")
    );
  });
}

/**
 * Resuelve la contraseña de iron-session. No ejecutar en top-level: `next build`
 * corre con NODE_ENV=production y aún así debe poder importar este módulo.
 */
function getSessionPassword(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV !== "production") {
    return DEV_SESSION_PASSWORD;
  }
  if (isLikelyNextBuildProcess()) {
    return BUILD_PLACEHOLDER_PASSWORD;
  }
  throw new Error(
    "SESSION_SECRET no configurado o demasiado corto. Añade SESSION_SECRET en .env con al menos 32 caracteres. " +
      "Puedes copiar .env.example a .env y editar SESSION_SECRET."
  );
}

let sessionOptionsCached:
  | {
      password: string;
      cookieName: string;
      cookieOptions: {
        secure: boolean;
        maxAge: number;
      };
    }
  | undefined;

function getSessionOptions() {
  if (!sessionOptionsCached) {
    sessionOptionsCached = {
      password: getSessionPassword(),
      cookieName: SESION_ROL_IRON_COOKIE,
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 8, // 8 horas
      },
    };
  }
  return sessionOptionsCached;
}

export async function getSesion(): Promise<IronSession<SesionData>> {
  const cookieStore = await cookies();
  return getIronSession<SesionData>(cookieStore, getSessionOptions());
}

/**
 * Devuelve el rol actual o "simple" si la cookie está corrupta / expirada /
 * firmada con un secret distinto. iron-session puede lanzar al verificar la
 * firma de una cookie inválida; antes este throw subía hasta el render del
 * Server Component y disparaba el mensaje genérico
 *   "An error occurred in the Server Components render…"
 * sin dejar rastro útil. Ahora caemos a "simple" y dejamos un log grepeable.
 */
export async function getRol(): Promise<Rol> {
  const h = await headers();
  if (h.get(SESION_FORZAR_ROL_SIMPLE_HEADER) === "1") {
    return "simple";
  }
  try {
    const sesion = await getSesion();
    return sesion.rol ?? "simple";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Intentos de prerender donde `cookies()` fuerza ruta dinámica; no es cookie corrupta.
    if (msg.includes("Dynamic server usage") && msg.includes("cookies")) {
      return "simple";
    }
    console.error("[sesion][getRol] cookie inválida o sesion no recuperable:", msg);
    return "simple";
  }
}

/** `id_personal` del usuario ingresado, o null (sin ingreso / cookie inválida / arranque). */
export async function getIdPersonalSesion(): Promise<number | null> {
  const h = await headers();
  if (h.get(SESION_FORZAR_ROL_SIMPLE_HEADER) === "1") return null;
  try {
    const sesion = await getSesion();
    return typeof sesion.idPersonal === "number" ? sesion.idPersonal : null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!(msg.includes("Dynamic server usage") && msg.includes("cookies"))) {
      console.error("[sesion][getIdPersonalSesion] cookie inválida:", msg);
    }
    return null;
  }
}

export async function esEditor(): Promise<boolean> {
  return (await getRol()) === "editor";
}
