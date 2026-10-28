"use client";

import { useMemo, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type NativeInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
>;

export type PorcentajeEnteroMaskInputProps = NativeInputProps & {
  /** Entero; `null` se trata como 0 en pantalla y edición. */
  value: number | null;
  onValueChange: (next: number) => void;
  /** Permite valores negativos (teclas `-` / `+`). */
  signed?: boolean;
  /**
   * Con `signed`: al tipear dígitos el valor nace negativo salvo que el usuario
   * pulse `+` explícitamente (caso DESCUENTO de Margen Contribución).
   */
  defaultNegative?: boolean;
  min?: number;
  max?: number;
  /**
   * `value === null` se muestra vacío (placeholder visible, sin `%`) y borrar el último
   * dígito llama a `onEmpty` en lugar de dejar 0 (p. ej. filtro PORC. UTILIDAD).
   */
  emptyWhenNull?: boolean;
  onEmpty?: () => void;
  /** `%` pegado al número dentro del texto (p. ej. `60%`) en lugar del sufijo alineado a la derecha. */
  sufijoEnTexto?: boolean;
  inputClassName?: string;
};

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Parte editable del valor (sin `%`). */
function formatUnsignedEnteroBody(n: number): string {
  return n.toLocaleString("es-AR");
}

/** Parte editable con signo (sin `%`). */
function formatSignedEnteroBody(n: number): string {
  const entero = Math.round(n);
  if (entero > 0) return `+${entero.toLocaleString("es-AR")}`;
  if (entero < 0) return entero.toLocaleString("es-AR");
  return "0";
}

function parsePastedInt(
  text: string,
  signed: boolean,
  defaultNegative: boolean
): number | null {
  const trimmed = text.replace(/%/g, "").trim();
  if (!trimmed) return 0;
  const hasExplicitPlus = signed && trimmed.startsWith("+");
  const hasExplicitMinus = signed && trimmed.startsWith("-");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    if (signed && (trimmed === "-" || trimmed === "+")) return null;
    return 0;
  }
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return null;
  if (!signed) return n;
  if (hasExplicitMinus) return -n;
  if (hasExplicitPlus) return n;
  return defaultNegative ? -n : n;
}

/**
 * Porcentaje entero con `%` fijo como sufijo visual (no seleccionable).
 * Contenedor `.input-mascara-sufijo` + flex: el sufijo no se mueve al hover de fila en tablas.
 */
export default function PorcentajeEnteroMaskInput({
  value,
  onValueChange,
  signed = false,
  defaultNegative = false,
  min,
  max,
  emptyWhenNull = false,
  onEmpty,
  sufijoEnTexto = false,
  inputClassName,
  className,
  disabled,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: PorcentajeEnteroMaskInputProps) {
  const overwriteOnNextInputRef = useRef(true);
  const [focused, setFocused] = useState(false);
  /**
   * Signo pendiente mientras el valor es 0 o al empezar a editar.
   * Con `defaultNegative`, al foco arranca en -1.
   */
  const [pendingSign, setPendingSign] = useState<-1 | 1>(
    signed && defaultNegative ? -1 : 1
  );

  const effectiveMin = min ?? (signed ? -999_999 : 0);
  const effectiveMax = max ?? (signed ? 999_999 : 99);
  const intValue = value ?? 0;
  const vacio = emptyWhenNull && value === null;

  const displayBody = useMemo(() => {
    if (vacio) return "";
    if (!signed) return formatUnsignedEnteroBody(intValue);
    if (intValue === 0 && focused) {
      return pendingSign < 0 ? "-" : "+";
    }
    return formatSignedEnteroBody(intValue);
  }, [vacio, intValue, signed, pendingSign, focused]);

  function resetEditState() {
    overwriteOnNextInputRef.current = true;
    setPendingSign(signed && defaultNegative ? -1 : 1);
  }

  function applyValue(next: number) {
    onValueChange(clampInt(next, effectiveMin, effectiveMax));
  }

  function isMinusKey(key: string): boolean {
    return key === "-" || key === "Subtract";
  }

  function isPlusKey(key: string): boolean {
    return key === "+" || key === "Add";
  }

  return (
    <div className={cn("input-mascara-sufijo w-full min-w-0", className)}>
      <input
        type="text"
        data-slot="input"
        inputMode={signed ? "text" : "numeric"}
        autoComplete="off"
        disabled={disabled}
        value={sufijoEnTexto && displayBody !== "" ? `${displayBody}%` : displayBody}
        onFocus={(event) => {
          setFocused(true);
          resetEditState();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          resetEditState();
          onBlur?.(event);
        }}
        onChange={() => {
          // Entrada solo por teclado / pegado (máscara POS).
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.ctrlKey || event.metaKey || event.altKey) {
            onKeyDown?.(event);
            return;
          }

          const key = event.key;
          const isDigit = /^[0-9]$/.test(key);
          const allowedControl =
            key === "ArrowLeft" ||
            key === "ArrowRight" ||
            key === "Tab" ||
            key === "Home" ||
            key === "End";

          if (isPlusKey(key) && signed) {
            event.preventDefault();
            setPendingSign(1);
            overwriteOnNextInputRef.current = false;
            if (intValue !== 0) applyValue(Math.abs(intValue));
            return;
          }

          if (isMinusKey(key) && signed) {
            event.preventDefault();
            setPendingSign(-1);
            overwriteOnNextInputRef.current = false;
            if (intValue !== 0) applyValue(-Math.abs(intValue));
            return;
          }

          if (isDigit) {
            event.preventDefault();
            const digit = Number(key);
            const negative = overwriteOnNextInputRef.current
              ? pendingSign < 0
              : pendingSign < 0 || intValue < 0;
            const base = overwriteOnNextInputRef.current ? 0 : Math.abs(intValue);
            let next = base * 10 + digit;
            if (negative) next = -next;
            overwriteOnNextInputRef.current = false;
            setPendingSign(next < 0 ? -1 : 1);
            applyValue(next);
            return;
          }

          if (key === "Backspace" || key === "Delete") {
            event.preventDefault();
            overwriteOnNextInputRef.current = false;
            if (emptyWhenNull) {
              if (vacio) return;
              if (Math.abs(intValue) < 10) {
                onEmpty?.();
                return;
              }
            }
            if (intValue === 0) {
              setPendingSign(signed && defaultNegative ? -1 : 1);
              return;
            }
            const abs = Math.floor(Math.abs(intValue) / 10);
            const next = intValue < 0 ? -abs : abs;
            if (next === 0) {
              setPendingSign(signed && defaultNegative ? -1 : 1);
            } else {
              setPendingSign(next < 0 ? -1 : 1);
            }
            applyValue(next);
            return;
          }

          if (allowedControl) {
            onKeyDown?.(event);
            return;
          }
          if (key === "Enter" || key === "Escape") {
            onKeyDown?.(event);
            return;
          }
          event.preventDefault();
        }}
        onPaste={(event) => {
          event.preventDefault();
          if (disabled) return;
          overwriteOnNextInputRef.current = false;
          const parsed = parsePastedInt(
            event.clipboardData.getData("text"),
            signed,
            Boolean(signed && defaultNegative)
          );
          if (parsed === null) return;
          setPendingSign(parsed < 0 ? -1 : 1);
          applyValue(parsed);
        }}
        className={cn(
          "min-h-0 min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm tabular-nums shadow-none outline-none",
          "focus-visible:ring-0 focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-50",
          inputClassName
        )}
        {...props}
      />
      {sufijoEnTexto ? null : (
        <span
          className={cn(
            "input-mascara-sufijo__pct pointer-events-none select-none px-1.5 text-xs text-muted-foreground tabular-nums",
            vacio && "invisible"
          )}
          aria-hidden
        >
          %
        </span>
      )}
    </div>
  );
}
