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

function parseEnteroDraft(raw: string, min: number): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min) return null;
  return Math.min(i, MAX_ENTERO_STEPPER);
}

/**
 * Input entero con botones − / + de a 1 (mismo patrón que Control Stock).
 * `value` vacío = sin número. `variante="formulario"` para modales (alto `h-9`).
 * Si el padre persiste por campo, usa `onCommit` (blur o paso).
 */
export default function EnteroStepperInput({
  value,
  onChange,
  onCommit,
  min = 1,
  allowEmpty = true,
  disabled = false,
  ariaLabel,
  className,
  endAction,
  variante = "tabla",
  tabIndex,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit?: (next: string) => void;
  min?: number;
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
}) {
  function commitParsed(raw: string) {
    const parsed = parseEnteroDraft(raw, min);
    const next = parsed == null ? (allowEmpty ? "" : String(min)) : String(parsed);
    onChange(next);
    onCommit?.(next);
  }

  function ajustar(delta: -1 | 1) {
    const parsed = parseEnteroDraft(value, min);
    let nextN: number | null;
    if (parsed == null) {
      nextN = delta > 0 ? Math.max(min, 1) : allowEmpty ? null : min;
    } else {
      const candidato = parsed + delta;
      if (candidato < min) {
        nextN = allowEmpty ? null : min;
      } else {
        nextN = Math.min(candidato, MAX_ENTERO_STEPPER);
      }
    }
    const next = nextN == null ? "" : String(nextN);
    onChange(next);
    onCommit?.(next);
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
      <Input
        type="number"
        min={min}
        max={MAX_ENTERO_STEPPER}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        autoFocus={autoFocus}
        placeholder={variante === "formulario" ? "0" : undefined}
        onChange={(e) => onChange(e.target.value)}
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
