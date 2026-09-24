"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CuentaCorrientePublicaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cuenta-corriente-publica][error-boundary]", error.digest, error.message);
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">No se pudo cargar la cuenta corriente.</p>
      <Button type="button" className="mt-4" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
