"use client";

import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chequePuedeAcreditarsePorFechaArgentina } from "@/lib/fechaArgentina";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/**
 * Ícono **Depositar** de un cheque en cartera (fila ACCIONES).
 * Queda `disabled` si la fecha de acreditación (calendario AR) aún no está al día.
 * El `onClick` lo define cada pantalla (Fondos u otra ventana).
 */
export default function BotonDepositarCheque({
  fechaAcreditacionIso,
  onClick,
  disabled = false,
  className,
}: {
  fechaAcreditacionIso: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const fechaAlDia = chequePuedeAcreditarsePorFechaArgentina(fechaAcreditacionIso);
  const bloqueado = disabled || !fechaAlDia;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, className)}
      disabled={bloqueado}
      onClick={onClick}
      title={
        fechaAlDia
          ? "Depositar"
          : "La fecha de acreditación aún no está al día"
      }
      aria-label={
        fechaAlDia
          ? "Depositar"
          : "Depositar (la fecha de acreditación aún no está al día)"
      }
    >
      <Landmark className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
    </Button>
  );
}
