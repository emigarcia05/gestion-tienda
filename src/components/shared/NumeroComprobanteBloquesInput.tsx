"use client";

import { useRef, type KeyboardEvent, type RefObject, type SyntheticEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  COMPROBANTE_COMPRA_NRO_DIGITOS,
  COMPROBANTE_COMPRA_PV_DIGITOS,
  digitosBloqueComprobante,
} from "@/lib/numeroComprobanteCompra";

interface Props {
  puntoVenta: string;
  numero: string;
  onPuntoVentaChange: (digitos: string) => void;
  onNumeroChange: (digitos: string) => void;
  /** Enter / Tab en el segundo bloque (p. ej. pasar a la fecha). */
  onCompletar?: () => void;
  disabled?: boolean;
  puntoVentaRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  inputClassName?: string;
}

function cursorAlFinal(e: SyntheticEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const fin = el.value.length;
  if (el.selectionStart !== fin || el.selectionEnd !== fin) el.setSelectionRange(fin, fin);
}

/**
 * N° de comprobante `0000-00000000` en dos bloques. Los dígitos entran por la derecha;
 * Enter o Tab pasa del punto de venta al número y del número a `onCompletar`.
 */
export default function NumeroComprobanteBloquesInput({
  puntoVenta,
  numero,
  onPuntoVentaChange,
  onNumeroChange,
  onCompletar,
  disabled,
  puntoVentaRef,
  className,
  inputClassName,
}: Props) {
  const numeroRef = useRef<HTMLInputElement>(null);

  function avanzarCon(e: KeyboardEvent<HTMLInputElement>, siguiente: () => void) {
    if (e.shiftKey || (e.key !== "Enter" && e.key !== "Tab")) return;
    e.preventDefault();
    siguiente();
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Input
        ref={puntoVentaRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={puntoVenta.padStart(COMPROBANTE_COMPRA_PV_DIGITOS, "0")}
        onChange={(e) =>
          onPuntoVentaChange(digitosBloqueComprobante(e.target.value, COMPROBANTE_COMPRA_PV_DIGITOS))
        }
        onKeyDown={(e) => avanzarCon(e, () => numeroRef.current?.focus())}
        onSelect={cursorAlFinal}
        disabled={disabled}
        aria-label="Punto de venta"
        className={cn("h-9 w-[4.5rem] shrink-0 text-center tabular-nums", inputClassName)}
      />
      <span className="text-muted-foreground" aria-hidden>
        -
      </span>
      <Input
        ref={numeroRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={numero.padStart(COMPROBANTE_COMPRA_NRO_DIGITOS, "0")}
        onChange={(e) =>
          onNumeroChange(digitosBloqueComprobante(e.target.value, COMPROBANTE_COMPRA_NRO_DIGITOS))
        }
        onKeyDown={(e) => {
          if (onCompletar) avanzarCon(e, onCompletar);
        }}
        onSelect={cursorAlFinal}
        disabled={disabled}
        aria-label="Número de comprobante"
        className={cn("h-9 min-w-0 flex-1 text-center tabular-nums", inputClassName)}
      />
    </div>
  );
}
