"use client";

import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface FacturaProductoDescEspecialCeldaProps {
  item: ProductoFacturaBusquedaItem;
  onVerEspeciales: (item: ProductoFacturaBusquedaItem) => void;
}

/** Ícono DESC. de DESC. ESPECIAL: no agrega el ítem al remito. */
export default function FacturaProductoDescEspecialCelda({
  item,
  onVerEspeciales,
}: FacturaProductoDescEspecialCeldaProps) {
  return (
    <div className="flex w-full items-center justify-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
          "!h-5 !w-5 min-h-5 min-w-5"
        )}
        title="Desc. Especial"
        aria-label={`Ver desc. especial de ${item.descripcion}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVerEspeciales(item);
        }}
      >
        <Percent className="h-3 w-3 shrink-0" aria-hidden />
      </Button>
    </div>
  );
}
