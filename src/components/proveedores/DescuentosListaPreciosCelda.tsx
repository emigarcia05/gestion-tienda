"use client";

import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { FilaListaPrecioParaCliente } from "@/services/listaPrecios.service";

interface Props {
  fila: FilaListaPrecioParaCliente;
  puedeEditar: boolean;
  onAbrir: () => void;
}

export default function DescuentosListaPreciosCelda({ fila, puedeEditar, onAbrir }: Props) {
  const tieneDescuentos = (fila.descuentosActivos?.length ?? 0) > 0;
  const puedeAbrir = puedeEditar || tieneDescuentos;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!puedeAbrir}
      className={cn(
        TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
        !puedeAbrir && "opacity-40"
      )}
      aria-label={
        tieneDescuentos
          ? `Ver descuentos de ${fila.codExt}`
          : puedeEditar
            ? `Descuentos y Px Promo Fijo de ${fila.codExt}`
            : `Sin descuentos activos en ${fila.codExt}`
      }
      onClick={onAbrir}
    >
      <Percent className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
    </Button>
  );
}
