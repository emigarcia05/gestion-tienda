"use client";

import { Button } from "@/components/ui/button";
import { TYPEAHEAD_STOCK_CANT_BTN_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface FacturaProductoDescEspecialCeldaProps {
  item: ProductoFacturaBusquedaItem;
  onVerEspeciales: (item: ProductoFacturaBusquedaItem) => void;
}

/** Botón VER de DESC. ESPECIAL: no agrega el ítem al remito. */
export default function FacturaProductoDescEspecialCelda({
  item,
  onVerEspeciales,
}: FacturaProductoDescEspecialCeldaProps) {
  return (
    <div className="flex w-full items-center justify-center">
      <Button
        type="button"
        variant="ghost"
        className={cn(TYPEAHEAD_STOCK_CANT_BTN_CLASS, "uppercase")}
        title="Ver promociones especiales"
        aria-label={`Ver promociones especiales de ${item.descripcion}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVerEspeciales(item);
        }}
      >
        Ver
      </Button>
    </div>
  );
}
