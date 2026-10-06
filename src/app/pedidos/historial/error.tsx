"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error Boundary del módulo Recepción de Compra.
 *
 * Captura excepciones lanzadas durante el render del Server Component
 * `src/app/pedidos/historial/page.tsx` (lecturas a Prisma, sesión, etc.) y
 * cualquier hijo. Sin este boundary, las excepciones aterrizan en el mensaje
 * genérico de Next.js ("An error occurred in the Server Components render…")
 * que el usuario reportó.
 *
 * Adicionalmente loggeamos el `digest` para que el error sea grepeable en
 * Vercel Function Logs (no opacar la causa raíz).
 */
export default function HistorialPedidosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const tag = "[pedidos/historial][error-boundary]";
    if (process.env.NODE_ENV === "production") {
      console.error(tag, "digest:", error.digest);
    } else {
      console.error(tag, error);
    }
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          No se pudo cargar Recepción de Compra
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocurrió un error inesperado al renderizar la página. Reintentá la
          operación; si el problema persiste, avisá al equipo con el código
          indicado abajo.
        </p>
        {error.digest ? (
          <p className="mt-3 break-all font-mono text-xs text-foreground/80">
            digest: {error.digest}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Reintentar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              router.push(GP_ROUTES.analisisPrecios.listaProveedores.listaPrecios);
            }}
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
