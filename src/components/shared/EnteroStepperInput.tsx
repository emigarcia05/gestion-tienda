"use client";

import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const MAX_ENTERO_STEPPER = 1_000_000;

const stepperContenedorVariants = cva("", {
  variants: {
    variante: {
      tabla: TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
      formulario: "flex h-9 w-full min-w-0 items-center gap-1",
    },
  },
  defaultVariants: { variante: "tabla" },
});

const stepperInputVariants = cva("text-center tabular-nums", {
  variants: {
    variante: {
      tabla: "h-6 w-14 self-center text-sm font-normal",
      formulario: "h-9 min-w-0 flex-1 text-sm",
    },
  },
  defaultVariants: { variante: "tabla" },
});

/** `formulario`: + / − apilados a la derecha del input (mitad de alto cada uno). */
const STEPPER_BTN_APILADO_CLASS =
  "h-auto min-h-0 w-full flex-1 rounded-sm border-0 bg-[#0072BB] p-0 text-xs leading-none text-white shadow-none hover:bg-[#0072BB]/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

function parseEnteroLibre(raw: string, max = MAX_ENTERO_STEPPER): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.trunc(n), max);
}

function parseEnteroDraft(raw: string, min: number, max?: number): number | null {
  const i = parseEnteroLibre(raw, max);
  return i == null || i < min ? null : i;
}

/**
 * Input entero con botones − / + de a 1 (mismo patrón que Control Stock).
 * `value` vacío = sin número. `variante="formulario"` para modales (alto `h-9`).
 * Si el padre persiste por campo, usa `onCommit` (blur o paso).
 * `clampAlMinimo`: `min` es un piso duro (no se tipea un 0 inicial, − se detiene en `min`
 * y un número menor se sube a `min` al salir del campo).
 * `max`: tope duro (+ se detiene y lo tipeado de más baja a `max`).
 */
export default function EnteroStepperInput({
  value,
  onChange,
  onCommit,
  min = 1,
  max = MAX_ENTERO_STEPPER,
  allowEmpty = true,
  disabled = false,
  ariaLabel,
  className,
  endAction,
  variante = "tabla",
  tabIndex,
  autoFocus,
  onEnter,
  clampAlMinimo = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit?: (next: string) => void;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  /** Acción extra a la derecha del + (p. ej. tilde en Pedido A Fáb.). */
  endAction?: ReactNode;
  variante?: "tabla" | "formulario";
  tabIndex?: number;
  autoFocus?: boolean;
  onEnter?: () => void;
  clampAlMinimo?: boolean;
}) {
  function commitParsed(raw: string) {
    const libre = parseEnteroLibre(raw, max);
    const parsed = parseEnteroDraft(raw, min, max);
    let next: string;
    if (parsed != null) next = String(parsed);
    else if (clampAlMinimo && libre != null) next = String(min);
    else next = allowEmpty ? "" : String(min);
    onChange(next);
    onCommit?.(next);
  }

  function cambiarTexto(raw: string) {
    if (clampAlMinimo && min >= 1 && /^\s*[0-]/.test(raw)) return;
    const n = Number(raw);
    onChange(raw.trim() !== "" && Number.isFinite(n) && n > max ? String(max) : raw);
  }

  function ajustar(delta: -1 | 1) {
    const parsed = parseEnteroDraft(value, min, max);
    let nextN: number | null;
    if (parsed == null) {
      const libre = clampAlMinimo ? parseEnteroLibre(value) : null;
      if (libre != null) nextN = min;
      else nextN = delta > 0 ? Math.max(min, 1) : allowEmpty ? null : min;
    } else {
      const candidato = parsed + delta;
      if (candidato < min) {
        nextN = clampAlMinimo || !allowEmpty ? min : null;
      } else {
        nextN = Math.min(candidato, max);
      }
    }
    const next = nextN == null ? "" : String(nextN);
    onChange(next);
    onCommit?.(next);
  }

  const input = (
    <Input
      type="number"
      min={min}
      max={max}
      step={1}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      autoFocus={autoFocus}
      placeholder={variante === "formulario" ? "0" : undefined}
      onChange={(e) => cambiarTexto(e.target.value)}
      onBlur={() => commitParsed(value)}
      onKeyDown={
        onEnter
          ? (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }
          : undefined
      }
      className={stepperInputVariants({ variante })}
    />
  );

  if (variante === "formulario") {
    return (
      <div className={cn(stepperContenedorVariants({ variante }), className)}>
        {input}
        <div className="flex h-full w-7 shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            className={STEPPER_BTN_APILADO_CLASS}
            aria-label={`Aumentar ${ariaLabel}`}
            disabled={disabled}
            tabIndex={tabIndex}
            onClick={() => ajustar(1)}
          >
            +
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={STEPPER_BTN_APILADO_CLASS}
            aria-label={`Disminuir ${ariaLabel}`}
            disabled={disabled}
            tabIndex={tabIndex}
            onClick={() => ajustar(-1)}
          >
            -
          </Button>
        </div>
        {endAction}
      </div>
    );
  }

  return (
    <div className={cn(stepperContenedorVariants({ variante }), className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
        aria-label={`Disminuir ${ariaLabel}`}
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => ajustar(-1)}
      >
        -
      </Button>
      {input}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
        aria-label={`Aumentar ${ariaLabel}`}
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => ajustar(1)}
      >
        +
      </Button>
      {endAction}
    </div>
  );
}
