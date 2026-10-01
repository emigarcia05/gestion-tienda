"use client";

import { Check } from "lucide-react";
import { TableCell, TableHead } from "@/components/ui/table";
import {
  TABLA_CONTROL_ITEM_BADGE_CLASS,
  TABLA_CONTROL_ITEM_BADGE_ICON_CLASS,
  TABLA_CONTROL_ITEM_HEAD_ICON_CLASS,
  TABLA_CONTROL_ITEM_PLACEHOLDER_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/**
 * Encabezado de la columna **Control de ítem** (primera columna de checklist).
 * Ícono `Check` en el `thead`; el texto queda en `sr-only`.
 */
export function TablaControlItemHead({ className }: { className?: string }) {
  return (
    <TableHead className={cn("w-[5%] text-center", className)}>
      <span className="sr-only">LISTA DE VERIFICACIÓN</span>
      <Check className={TABLA_CONTROL_ITEM_HEAD_ICON_CLASS} aria-hidden />
    </TableHead>
  );
}

type TablaControlItemCeldaProps = {
  verificado: boolean;
  /** Si true, no reserva el hueco cuando el ítem aún no está marcado (p. ej. Recepción en modo lectura). */
  ocultarPlaceholder?: boolean;
  /** Tooltip del hueco vacío (cómo marcar el ítem). */
  placeholderTitle?: string;
  className?: string;
};

/**
 * Celda de **Control de ítem**: badge circular si está marcado; hueco `h-7` si no.
 */
export function TablaControlItemCelda({
  verificado,
  ocultarPlaceholder = false,
  placeholderTitle,
  className,
}: TablaControlItemCeldaProps) {
  return (
    <TableCell
      className={cn("celda-datos w-[5%] text-center align-middle", className)}
    >
      {verificado ? (
        <span className={TABLA_CONTROL_ITEM_BADGE_CLASS} aria-label="Ítem verificado">
          <Check className={TABLA_CONTROL_ITEM_BADGE_ICON_CLASS} aria-hidden />
        </span>
      ) : ocultarPlaceholder ? null : (
        <span
          aria-label="Lista de verificación"
          title={placeholderTitle}
          className={TABLA_CONTROL_ITEM_PLACEHOLDER_CLASS}
        />
      )}
    </TableCell>
  );
}
