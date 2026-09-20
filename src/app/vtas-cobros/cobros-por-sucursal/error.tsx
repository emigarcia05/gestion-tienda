"use client";

export default function VtasCobrosPorSucursalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="text-sm text-muted-foreground">
        No se pudo cargar Cobros por sucursal.
      </p>
      <button
        type="button"
        className="text-sm font-medium text-primary underline"
        onClick={reset}
      >
        Reintentar
      </button>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
      ) : null}
    </div>
  );
}
