"use client";

import { Button } from "@/components/ui/button";
import { fmtCantidad } from "@/lib/format";
import { TYPEAHEAD_STOCK_CANT_BTN_CLASS } from "@/lib/ui-classes";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface FacturaProductoStockCeldaProps {
  item: ProductoFacturaBusquedaItem;
  sucursalCodigo: string | null;
  onVerStock: (item: ProductoFacturaBusquedaItem) => void;
}

/** Stock de la sucursal activa: el número abre STOCK POR SUCURSALES. */
export default function FacturaProductoStockCelda({
  item,
  sucursalCodigo,
  onVerStock,
}: FacturaProductoStockCeldaProps) {
  const etiquetaSucursal = sucursalCodigo
    ? `Stock en la sucursal ${sucursalCodigo}`
    : "Stock";
  return (
    <div className="flex w-full items-center justify-center">
      <Button
        type="button"
        variant="ghost"
        className={TYPEAHEAD_STOCK_CANT_BTN_CLASS}
        title={`${etiquetaSucursal} — ver por sucursales`}
        aria-label={`${etiquetaSucursal} ${fmtCantidad(item.stock)} — ver detalle de ${item.descripcion}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVerStock(item);
        }}
      >
        {fmtCantidad(item.stock)}
      </Button>
    </div>
  );
}
