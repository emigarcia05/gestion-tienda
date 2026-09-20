"use client";

import { Switch } from "@/components/ui/switch";
import {
  MODAL_BOOLEAN_SWITCH_LABEL_CLASS,
  MODAL_BOOLEAN_SWITCH_ROW_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface ModalSiNoChoiceProps {
  /** Etiqueta MAYÚSCULAS. Sin texto de ayuda debajo. */
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Configuración TRUE/FALSE (SÍ/NO) en modales: fila con etiqueta a la izquierda y `Switch` a la derecha.
 * No usar pares de botones SÍ/NO ni Select SI/NO para un booleano con valor conocido.
 */
export default function ModalSiNoChoice({
  label,
  value,
  onChange,
  disabled,
  className,
}: ModalSiNoChoiceProps) {
  return (
    <div className={cn(MODAL_BOOLEAN_SWITCH_ROW_CLASS, className)}>
      <p className={MODAL_BOOLEAN_SWITCH_LABEL_CLASS}>{label}</p>
      <Switch
        checked={value}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(checked === true)}
        aria-label={label}
      />
    </div>
  );
}
