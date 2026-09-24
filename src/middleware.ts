import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  esRutaCuentaCorrientePublica,
  rutaCuentaCorrientePublica,
  SESION_CC_VISOR_COOKIE,
  tokenCuentaCorrienteDesdePath,
} from "@/lib/cuentaCorrientePublica";
import {
  SESION_APP_BOOT_COOKIE,
  SESION_FORZAR_ROL_SIMPLE_HEADER,
  SESION_ROL_IRON_COOKIE,
} from "@/lib/sesion-arranque";

function cookieVisorOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tokenEnPath = tokenCuentaCorrienteDesdePath(pathname);
  const visorCookie = request.cookies.get(SESION_CC_VISOR_COOKIE)?.value;
  const visorToken = tokenEnPath ?? visorCookie ?? null;

  if (visorToken && !esRutaCuentaCorrientePublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = rutaCuentaCorrientePublica(visorToken);
    url.search = "";
    const redir = NextResponse.redirect(url);
    redir.cookies.set(SESION_CC_VISOR_COOKIE, visorToken, cookieVisorOptions());
    return redir;
  }

  const hasBoot = request.cookies.has(SESION_APP_BOOT_COOKIE);
  const hadRolCookie = request.cookies.has(SESION_ROL_IRON_COOKIE);

  const requestHeaders = new Headers(request.headers);
  if (!hasBoot && hadRolCookie) {
    requestHeaders.set(SESION_FORZAR_ROL_SIMPLE_HEADER, "1");
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!hasBoot) {
    res.cookies.set(SESION_APP_BOOT_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    if (hadRolCookie) {
      res.cookies.delete(SESION_ROL_IRON_COOKIE);
    }
  }

  if (tokenEnPath) {
    res.cookies.set(SESION_CC_VISOR_COOKIE, tokenEnPath, cookieVisorOptions());
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
