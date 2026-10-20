"use client";

import { useMemo, useRef, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MONTO_AR_MASK_MAX_CENTS,
  montoArCentsToNormalizedString,
  montoArCentsToDisplayWithCurrency,
  montoArNormalizedStringToCents,
  montoArSignedCentsToDisplayWithCurrency,
  montoArSignedCentsToNormalizedString,
  montoArSignedNormalizedStringToCents,
} from "@/lib/montoArMask";

const montoArInputVariants = cva("", {
  variants: {
    variant: {
      /** Total pedido en pie de recepción (sin padding izquierdo). */
      totalPedido:
        "ml-0 h-9 w-full min-w-0 pl-0 pr-3 py-1 tabular-nums text-center font-semibold",
      /** Modales y formularios estándar. */
      form: "h-9 w-full min-w-0 px-3 py-1 tabular-nums text-center",
    },
  },
  defaultVariants: {
    variant: "form",
  },
});

export type MontoArInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "onFocus" | "onBlur" | "onKeyDown" | "onPaste"
> &
  VariantProps<typeof montoArInputVariants> & {
    valueNormalized: string;
    onValueNormalizedChange: (next: string) => void;
    /**
     * Si es `true`, cuando `valueNormalized` es `""` el input se muestra vacío (no `$0,00`);
     * al borrar hasta 0 centavos se emite `""`. Default `false` (comportamiento histórico).
     */
    treatEmptyNormalizedAsBlank?: boolean;
    /** Tecla `-` / pegado con signo: persiste normalizado negativo (`"-123.45"`). */
    allowNegative?: boolean;
    /**
     * Cada dígito agrega pesos (no centavos): el valor siempre es entero (cobros / pagos).
     * Al pegar se descarta la parte decimal (`,XX`).
     */
    soloPesosEnteros?: boolean;
  };

export default function MontoArInput({
  valueNormalized,
  onValueNormalizedChange,
  treatEmptyNormalizedAsBlank = false,
  allowNegative = false,
  soloPesosEnteros = false,
  variant,
  className,
  disabled,
  ...props
}: MontoArInputProps) {
  const overwriteOnNextInputRef = useRef(true);
  const paso = soloPesosEnteros ? 100 : 1;
  const maxMag = Math.floor(MONTO_AR_MASK_MAX_CENTS / paso) * paso;
  const centsValue = useMemo(
    () =>
      allowNegative
        ? montoArSignedNormalizedStringToCents(valueNormalized)
        : montoArNormalizedStringToCents(valueNormalized),
    [allowNegative, valueNormalized]
  );

  const display = useMemo(() => {
    if (treatEmptyNormalizedAsBlank && valueNormalized.trim() === "") return "";
    return allowNegative
      ? montoArSignedCentsToDisplayWithCurrency(centsValue, "$")
      : montoArCentsToDisplayWithCurrency(centsValue, "$");
  }, [allowNegative, centsValue, treatEmptyNormalizedAsBlank, valueNormalized]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      value={display}
      onFocus={() => {
        overwriteOnNextInputRef.current = true;
      }}
      onBlur={() => {
        overwriteOnNextInputRef.current = true;
      }}
      onChange={() => {
        // Entrada solo por teclado / pegado (máscara POS centavos).
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

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
          if (centsValue === 0 && valueNormalized.trim() === "") return;
          onValueNormalizedChange(montoArSignedCentsToNormalizedString(-centsValue));
          return;
        }

        if (isDigit) {
          event.preventDefault();
          const unidades = Math.floor(Math.abs(centsValue) / paso);
          const base = overwriteOnNextInputRef.current ? 0 : unidades;
          const nextMag = Math.min((base * 10 + Number(key)) * paso, maxMag);
          overwriteOnNextInputRef.current = false;
          const keepNeg = allowNegative && centsValue < 0 && nextMag !== 0;
          const next = keepNeg ? -nextMag : nextMag;
          onValueNormalizedChange(
            allowNegative
              ? montoArSignedCentsToNormalizedString(next)
              : montoArCentsToNormalizedString(nextMag)
          );
          return;
        }

        if (key === "Backspace" || key === "Delete") {
          event.preventDefault();
          overwriteOnNextInputRef.current = false;
          const nextMag = Math.floor(Math.abs(centsValue) / paso / 10) * paso;
          const keepNeg = allowNegative && centsValue < 0 && nextMag !== 0;
          const normalized =
            treatEmptyNormalizedAsBlank && nextMag === 0
              ? ""
              : allowNegative
                ? montoArSignedCentsToNormalizedString(keepNeg ? -nextMag : nextMag)
                : montoArCentsToNormalizedString(nextMag);
          onValueNormalizedChange(normalized);
          return;
        }

        if (allowedControl) return;
        event.preventDefault();
      }}
      onPaste={(event) => {
        event.preventDefault();
        if (disabled) return;
        overwriteOnNextInputRef.current = false;
        const text = event.clipboardData.getData("text");
        const pasteNeg = allowNegative && text.trim().startsWith("-");
        const parteEntera = soloPesosEnteros ? text.split(",")[0] : text;
        const digits = parteEntera.replace(/\D/g, "");
        if (!digits) return;
        const pasted = Number(digits);
        if (!Number.isFinite(pasted)) return;
        const nextMag = Math.min(pasted * paso, maxMag);
        const next = pasteNeg && nextMag !== 0 ? -nextMag : nextMag;
        onValueNormalizedChange(
          allowNegative
            ? montoArSignedCentsToNormalizedString(next)
            : montoArCentsToNormalizedString(nextMag)
        );
      }}
      className={cn(montoArInputVariants({ variant }), className)}
      {...props}
    />
  );
}
