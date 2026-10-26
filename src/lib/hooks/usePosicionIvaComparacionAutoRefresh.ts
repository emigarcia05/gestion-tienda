"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPosicionIvaComparacionRevisionTokenAction } from "@/actions/pedidos";

/** Intervalo entre consultas del token (otra pestaña / otra PC puede haber cambiado Balance IVA). */
export const POSICION_IVA_COMPARACION_POLL_MS = 30_000;

export function usePosicionIvaComparacionAutoRefresh(
  initialToken: string,
  options?: { intervalMs?: number; enabled?: boolean }
): void {
  const router = useRouter();
  const tokenRef = useRef(initialToken);
  const enabled = options?.enabled !== false && initialToken.length > 0;
  const intervalMs = options?.intervalMs ?? POSICION_IVA_COMPARACION_POLL_MS;

  useEffect(() => {
    tokenRef.current = initialToken;
  }, [initialToken]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function checkRevision() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const { token } = await getPosicionIvaComparacionRevisionTokenAction();
        if (cancelled || !token) return;
        if (token !== tokenRef.current) {
          tokenRef.current = token;
          router.refresh();
        }
      } catch {
        // Errores transitorios de red: no refrescar.
      }
    }

    const onVisible = () => void checkRevision();

    void checkRevision();
    const intervalId = setInterval(() => void checkRevision(), intervalMs);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, initialToken, intervalMs, router]);
}
