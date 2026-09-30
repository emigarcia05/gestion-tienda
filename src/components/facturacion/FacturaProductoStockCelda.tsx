"use client";

import { AlertTriangle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtNumero } from "@/lib/format";
import {
  TYPEAHEAD_STORE_BTN_SIN_STOCK_OTRA_CLASS,
  TYPEAHEAD_STORE_BTN_STOCK_OTRA_CLASS,
  TYPEAHEAD_STORE_ICON_CLASS,
} from "@/lib/ui-classes";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

export function hayStockEnOtraSucursal(
  item: ProductoFacturaBusquedaItem,
  sucursalCodigo: string | null
): boolean {
  return item.stockPorSucursal.some((s) => {
    if (s.stock <= 0) return false;
    if (sucursalCodigo == null) return true;
    return s.codigo !== sucursalCodigo;
  });
}

const FILA_BUSQUEDA_STOCK =
  "mx-auto grid w-fit grid-cols-[1.75rem_1.25rem] items-center justify-items-center gap-1";

const FILA_BUSQUEDA_STOCK_VALOR =
  "flex w-full items-center justify-center tabular-nums text-foreground";

interface FacturaProductoStockCeldaProps {
  item: ProductoFacturaBusquedaItem;
  sucursalCodigo: string | null;
  onVerStock: (item: ProductoFacturaBusquedaItem) => void;
}

/** Cantidad o alerta + ícono Store. Misma grilla en el typeahead y en la búsqueda avanzada. */
export default function FacturaProductoStockCelda({
  item,
  sucursalCodigo,
  onVerStock,
}: FacturaProductoStockCeldaProps) {
  const sinStockLocal = item.stock <= 0;
  const stockEnOtra = hayStockEnOtraSucursal(item, sucursalCodigo);

  return (
    <div className={FILA_BUSQUEDA_STOCK}>
      <span className={FILA_BUSQUEDA_STOCK_VALOR}>
        {sinStockLocal ? (
          <span className="inline-flex" title="Sin stock en la sucursal">
            <AlertTriangle
              className="size-4 shrink-0 text-destructive"
              aria-label="Sin stock en la sucursal"
            />
          </span>
        ) : (
          fmtNumero(item.stock)
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={
          stockEnOtra
            ? TYPEAHEAD_STORE_BTN_STOCK_OTRA_CLASS
            : TYPEAHEAD_STORE_BTN_SIN_STOCK_OTRA_CLASS
        }
        title={
          stockEnOtra
            ? "Hay stock en otra sucursal"
            : "No hay stock en otras sucursales"
        }
        aria-label={
          stockEnOtra
            ? `Hay stock en otra sucursal — ver detalle de ${item.descripcion}`
            : `No hay stock en otras sucursales — ver detalle de ${item.descripcion}`
        }
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVerStock(item);
        }}
      >
        <Store className={TYPEAHEAD_STORE_ICON_CLASS} aria-hidden />
      </Button>
    </div>
  );
}
