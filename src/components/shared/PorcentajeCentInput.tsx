"use client";

import { useMemo, useRef, type ClipboardEvent, type ComponentProps, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PORCENTAJE_CENT_MASK_MAX_CENTS,
  porcentajeCentCentsToNormalizedString,
  porcentajeCentNormalizedStringToCents,
  porcentajeCentNormalizedToDisplay,
  porcentajeCentSignedCentsToNormalizedString,
  porcentajeCentSignedNormalizedStringToCents,
  porcentajeCentSignedNormalizedToDisplay,
} from "@/lib/porcentajeCentMask";

export type PorcentajeCentInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "onFocus" | "onBlur" | "onKeyDown" | "onPaste"
> & {
  valueNormalized: string;
  onValueNormalizedChange: (next: string) => void;
  /** Se invoca al perder el foco del input (tras edición con máscara). */
  onCommit?: () => void;
  /**
   * Si es `false`, input plano sin sufijo `%` (legacy / casos excepcionales).
   * Default `true`: `%` fijo a la derecha, no seleccionable (`.input-mascara-sufijo`).
   */
  showPctSuffix?: boolean;
  /**
   * Muestra el `%` aunque el valor esté vacío (formularios). Default: visible si hay valor o no hay placeholder.
   */
  pctSuffixAlwaysVisible?: boolean;
  /**
   * Tecla `-` / pegado con signo: persiste normalizado negativo (`"-4.00"`).
   */
  allowNegative?: boolean;
  /**
   * Cada dígito suma puntos enteros (no centésimas). Al pegar se descarta la parte decimal.
   * El valor se sigue guardando en centésimas (`"12.00"`).
   */
  soloEnteros?: boolean;
  /**
   * Si es `true`, al borrar hasta 0 se emite `""` (no `"0"`).
   */
  treatEmptyNormalizedAsBlank?: boolean;
  /**
   * Tope en centésimas de % (default 99,99 %). Px Listas: {@link MARGEN_PX_LISTA_MAX_CENTS}.
   */
  maxCents?: number;
  /**
   * Si es `true`, valor `0` / `0,00` se muestra vacío (útil en filtros con placeholder).
   */
  emptyWhenZero?: boolean;
  /**
   * Tacho dentro del contenedor, a la derecha del `%`. Solo visible si hay valor mostrado.
   */
  onClear?: () => void;
};

/**
 * Input de porcentaje con máscara POS (2 decimales, es-AR).
 * Estado: string normalizado parseable (`"12.26"`). Vacío si el usuario borró todo.
 * Al enfocar, el primer dígito reemplaza el valor previo; los siguientes desplazan (POS).
 * El `%` vive en un `<span>` aparte: no se puede seleccionar, editar ni borrar.
 */
export default function PorcentajeCentInput({
  valueNormalized,
  onValueNormalizedChange,
  onCommit,
  showPctSuffix = true,
  pctSuffixAlwaysVisible = false,
  allowNegative = false,
  soloEnteros = false,
  treatEmptyNormalizedAsBlank = false,
  maxCents = PORCENTAJE_CENT_MASK_MAX_CENTS,
  emptyWhenZero = false,
  onClear,
  className,
  disabled,
  readOnly,
  placeholder,
  ...props
}: PorcentajeCentInputProps) {
  const overwriteOnNextInputRef = useRef(true);
  const paso = soloEnteros ? 100 : 1;
  const topeUnidades = Math.floor(maxCents / paso);

  const centsValue = useMemo(
    () =>
      allowNegative
        ? porcentajeCentSignedNormalizedStringToCents(valueNormalized, maxCents)
        : porcentajeCentNormalizedStringToCents(valueNormalized, maxCents),
    [allowNegative, valueNormalized, maxCents]
  );

  const displayBody = useMemo(() => {
    if (allowNegative && valueNormalized.trim() === "-") return "-";
    if (treatEmptyNormalizedAsBlank && valueNormalized.trim() === "") return "";
    if (valueNormalized.trim() === "") return "";
    if (emptyWhenZero && centsValue === 0) return "";
    if (soloEnteros) {
      const entero = Math.round(Math.abs(centsValue) / 100);
      const body = entero.toLocaleString("es-AR", { maximumFractionDigits: 0 });
      return allowNegative && centsValue < 0 && entero !== 0 ? `-${body}` : body;
    }
    return allowNegative
      ? porcentajeCentSignedNormalizedToDisplay(valueNormalized, maxCents)
      : porcentajeCentNormalizedToDisplay(valueNormalized, maxCents);
  }, [
    allowNegative,
    soloEnteros,
    valueNormalized,
    maxCents,
    emptyWhenZero,
    centsValue,
    treatEmptyNormalizedAsBlank,
  ]);

  const showPctVisual =
    showPctSuffix && (pctSuffixAlwaysVisible || displayBody !== "" || !placeholder);
  const showClear = Boolean(onClear) && displayBody !== "" && !disabled;

  function resetEditState() {
    overwriteOnNextInputRef.current = true;
  }

  function emitCents(next: number) {
    if (treatEmptyNormalizedAsBlank && next === 0) {
      onValueNormalizedChange("");
      return;
    }
    onValueNormalizedChange(
      allowNegative
        ? porcentajeCentSignedCentsToNormalizedString(next, maxCents)
        : porcentajeCentCentsToNormalizedString(Math.abs(next), maxCents)
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || readOnly) return;

    const key = event.key;
    const isDigit = /^[0-9]$/.test(key);
    const allowedControl =
      key === "Backspace" ||
      key === "Delete" ||
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "Tab" ||
      key === "Home" ||
      key === "End";

    if (allowNegative && key === "-") {
      event.preventDefault();
      const t = valueNormalized.trim();
      if (t === "" || t === "-") {
        onValueNormalizedChange(t === "-" ? "" : "-");
        overwriteOnNextInputRef.current = false;
        return;
      }
      if (centsValue === 0) return;
      emitCents(-centsValue);
      return;
    }

    if (isDigit) {
      event.preventDefault();
      const pendingNeg = allowNegative && (centsValue < 0 || valueNormalized.trim() === "-");
      const unidades = Math.floor(Math.abs(centsValue) / paso);
      const base = overwriteOnNextInputRef.current ? 0 : unidades;
      const nextMag = Math.min(base * 10 + Number(key), topeUnidades) * paso;
      overwriteOnNextInputRef.current = false;
      const keepNeg = pendingNeg && nextMag !== 0;
      emitCents(keepNeg ? -nextMag : nextMag);
      return;
    }

    if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      overwriteOnNextInputRef.current = false;
      if (allowNegative && valueNormalized.trim() === "-") {
        onValueNormalizedChange("");
        return;
      }
      const nextMag = Math.floor(Math.abs(centsValue) / paso / 10) * paso;
      const keepNeg = allowNegative && centsValue < 0 && nextMag !== 0;
      emitCents(keepNeg ? -nextMag : nextMag);
      return;
    }

    if (allowedControl) return;
    if (key === "Enter" || key === "Escape") return;
    event.preventDefault();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    if (disabled || readOnly) return;
    overwriteOnNextInputRef.current = false;
    const text = event.clipboardData.getData("text").replace(/%/g, "");
    const pasteNeg = allowNegative && text.trim().startsWith("-");
    const parte = soloEnteros ? text.split(",")[0]?.split(".")[0] ?? "" : text;
    const digits = parte.replace(/\D/g, "");
    if (!digits) return;
    const pasted = Number(digits);
    if (!Number.isFinite(pasted)) return;
    const nextMag = Math.min(pasted, topeUnidades) * paso;
    emitCents(pasteNeg && nextMag !== 0 ? -nextMag : nextMag);
  }

  const inputClassName = cn(
    "min-h-0 min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm tabular-nums shadow-none outline-none",
    "focus-visible:ring-0 focus-visible:outline-none",
    disabled && "cursor-not-allowed opacity-50",
    readOnly && "cursor-default"
  );

  const pctSpan = (
    <span
      className={cn(
        "input-mascara-sufijo__pct pointer-events-none select-none px-1.5 text-xs text-muted-foreground tabular-nums",
        !showPctVisual && "invisible"
      )}
      aria-hidden
    >
      %
    </span>
  );

  if (!showPctSuffix) {
    return (
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        readOnly={readOnly}
        value={displayBody}
        placeholder={placeholder}
        onFocus={() => {
          resetEditState();
        }}
        onBlur={() => {
          resetEditState();
          onCommit?.();
        }}
        onChange={() => {
          // Entrada solo por teclado / pegado (máscara POS).
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn("tabular-nums border-primary", className)}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        "input-mascara-sufijo flex w-full min-w-0 items-center rounded-md border border-primary bg-transparent",
        showClear && "input-mascara-sufijo--con-clear",
        className
      )}
    >
      <input
        type="text"
        data-slot="input"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        readOnly={readOnly}
        value={displayBody}
        placeholder={placeholder}
        onFocus={() => {
          resetEditState();
        }}
        onBlur={() => {
          resetEditState();
          onCommit?.();
        }}
        onChange={() => {
          // Entrada solo por teclado / pegado (máscara POS).
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={inputClassName}
        {...props}
      />
      {pctSpan}
      {showClear ? (
        <Button
          type="button"
          variant="primaryIcon"
          size="icon-lg"
          onClick={() => onClear?.()}
          className="filtro-individual-clear-btn input-mascara-sufijo__clear"
          aria-label="Limpiar este filtro"
          title="Limpiar este filtro"
          tabIndex={-1}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
