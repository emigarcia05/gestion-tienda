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

type TablaControlItemHeadProps = {
  className?: string;
  /**
   * Si está definido, el encabezado (sin etiqueta visible) alterna el filtro
   * de ítems pendientes de confirmación. `filtroActivo` marca ese filtro encendido.
   */
  filtroActivo?: boolean;
  onFiltroClick?: () => void;
};

/**
 * Encabezado de la columna **Control de ítem** (primera columna de checklist).
 * Ícono `Check` en el `thead`; el texto queda en `sr-only`.
 * Con `onFiltroClick`, el mismo ícono filtra pendientes de confirmación.
 */
export function TablaControlItemHead({
  className,
  filtroActivo = false,
  onFiltroClick,
}: TablaControlItemHeadProps) {
  const icono = (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        filtroActivo && "rounded-sm bg-primary-foreground/25"
      )}
    >
      <Check className={TABLA_CONTROL_ITEM_HEAD_ICON_CLASS} aria-hidden />
    </span>
  );

  return (
    <TableHead className={cn("w-[5%] text-center", className)}>
      {onFiltroClick ? (
        <button
          type="button"
          aria-pressed={filtroActivo}
          aria-label="Filtrar ítems pendientes de confirmación"
          onClick={onFiltroClick}
          className="cursor-pointer"
        >
          <span className="sr-only">LISTA DE VERIFICACIÓN</span>
          {icono}
        </button>
      ) : (
        <>
          <span className="sr-only">LISTA DE VERIFICACIÓN</span>
          {icono}
        </>
      )}
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
