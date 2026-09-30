"use client";

import { fmtPrecio } from "@/lib/format";
import {
  TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS,
  TYPEAHEAD_LISTBOX_CELL_CLASS,
  TYPEAHEAD_LISTBOX_HEADER_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS,
  TYPEAHEAD_LISTBOX_UL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";
import FacturaProductoStockCelda from "@/components/facturacion/FacturaProductoStockCelda";

export const FILA_BUSQUEDA_PRODUCTOS_GRID =
  "grid w-full grid-cols-[5.5rem_minmax(0,1fr)_6.5rem_6.5rem] items-center justify-items-stretch gap-1.5 px-2";

interface FacturaProductoBusquedaListaProps {
  items: readonly ProductoFacturaBusquedaItem[];
  sucursalCodigo: string | null;
  activoIndex: number;
  onActivar: (index: number) => void;
  onElegir: (item: ProductoFacturaBusquedaItem) => void;
  onVerStock: (item: ProductoFacturaBusquedaItem) => void;
  className?: string;
}

/** Misma grilla COD. / DESCRIPCIÓN / PRECIOS / STOCK del buscador de Factura · Crear. */
export default function FacturaProductoBusquedaLista({
  items,
  sucursalCodigo,
  activoIndex,
  onActivar,
  onElegir,
  onVerStock,
  className,
}: FacturaProductoBusquedaListaProps) {
  return (
    <div className={cn(TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS, className)}>
      <div
        className={cn(FILA_BUSQUEDA_PRODUCTOS_GRID, TYPEAHEAD_LISTBOX_HEADER_CLASS)}
        aria-hidden
      >
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>COD.</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>DESCRIPCIÓN</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>PRECIOS</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>STOCK</span>
      </div>
      <ul className={cn(TYPEAHEAD_LISTBOX_UL_CLASS, "flex-none overflow-visible")}>
        {items.map((item, idx) => {
          const activo = idx === activoIndex;
          return (
            <li key={item.codTienda} role="option" aria-selected={activo}>
              <div
                role="button"
                tabIndex={-1}
                className={cn(
                  FILA_BUSQUEDA_PRODUCTOS_GRID,
                  "min-h-5 cursor-pointer py-0 text-sm leading-tight text-foreground transition-colors",
                  activo && TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS
                )}
                onMouseEnter={() => onActivar(idx)}
                onClick={() => onElegir(item)}
              >
                <span
                  className={cn(
                    TYPEAHEAD_LISTBOX_CELL_CLASS,
                    "tabular-nums text-foreground"
                  )}
                >
                  {item.codTienda}
                </span>
                <span className={cn(TYPEAHEAD_LISTBOX_CELL_CLASS, "text-foreground")}>
                  {item.descripcion}
                </span>
                <span
                  className={cn(
                    TYPEAHEAD_LISTBOX_CELL_CLASS,
                    "tabular-nums text-foreground"
                  )}
                >
                  {`$${fmtPrecio(item.pxLista)}`}
                </span>
                <FacturaProductoStockCelda
                  item={item}
                  sucursalCodigo={sucursalCodigo}
                  onVerStock={onVerStock}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
