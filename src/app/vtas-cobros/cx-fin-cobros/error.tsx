"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VTAS_COBROS_ROUTES } from "@/lib/vtasCobrosRoutes";

export default function VtasCobrosCxFinCobrosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const tag = "[vtas-cobros][cx-fin-cobros][error-boundary]";
    if (process.env.NODE_ENV === "production") {
      console.error(tag, "digest:", error.digest);
    } else {
      console.error(tag, error);
    }
  }, [error]);

  return (
    <div className="area-page-shell flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          No Se Pudo Cargar Cx. Fin. Cobros
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocurrió un error inesperado al renderizar la página. Reintentá la operación.
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
            onClick={() => router.push(VTAS_COBROS_ROUTES.cxFinCobros)}
          >
            Recargar Módulo
          </Button>
        </div>
      </div>
    </div>
  );
}
