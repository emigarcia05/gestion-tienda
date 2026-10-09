"use client";

import { Button } from "@/components/ui/button";
import { chequePuedeAcreditarsePorFechaArgentina } from "@/lib/fechaArgentina";
import { cn } from "@/lib/utils";

/**
 * Botón **Depositar** de un cheque en cartera.
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
      size="sm"
      className={cn(className)}
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
      Depositar
    </Button>
  );
}
