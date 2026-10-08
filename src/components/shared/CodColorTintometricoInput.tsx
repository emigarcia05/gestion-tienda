"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  aplicarEntradaCodigoFormato,
  longitudCompletaFormatoCod,
} from "@/lib/tintometricoFormatoCod";
import { cn } from "@/lib/utils";

interface Props {
  /** Máscara de la marca (`prod_marcas.formato_cod_tintometrico`); `null` = código libre. */
  formatoCod: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  onEnter?: () => void;
}

/**
 * COD. COLOR tintométrico con máscara en vivo (MAYÚSCULAS; fijos y separadores automáticos).
 * Usado en Pedir Mercadería → Agregar Tintométrico y en Factura · Crear.
 */
const CodColorTintometricoInput = forwardRef<HTMLInputElement, Props>(function CodColorTintometricoInput(
  { formatoCod, value, onChange, disabled, autoFocus, className, onEnter },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [error, setError] = useState<string | null>(null);
  const maxLen = formatoCod ? longitudCompletaFormatoCod(formatoCod) : null;

  function aplicar(raw: string) {
    const r = aplicarEntradaCodigoFormato(formatoCod, raw);
    onChange(r.value);
    setError(r.error);
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      el.setSelectionRange(r.value.length, r.value.length);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => aplicar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={formatoCod ? undefined : "CÓDIGO"}
        maxLength={maxLen ?? undefined}
        aria-invalid={error ? true : undefined}
        className={cn("h-10 text-center tabular-nums", error && "border-destructive", className)}
        aria-label="Código de color"
        autoComplete="off"
        spellCheck={false}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
});

export default CodColorTintometricoInput;
