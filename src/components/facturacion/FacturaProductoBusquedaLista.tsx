"use client";

import { fmtPrecio } from "@/lib/format";
import { itemTieneDescEspecial } from "@/lib/descPromo";
import {
  porcentajeDescuentoParaProductoBusqueda,
  pxConDescuento,
  type FacturaDescuentoEstado,
  type FacturaLineaLocal,
} from "@/lib/factura";
import {
  TYPEAHEAD_FILA_DESC_ESPECIAL_CLASS,
  TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS,
  TYPEAHEAD_LISTBOX_CELL_CLASS,
  TYPEAHEAD_LISTBOX_HEADER_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS,
  TYPEAHEAD_LISTBOX_UL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";
import FacturaProductoDescEspecialCelda from "@/components/facturacion/FacturaProductoDescEspecialCelda";
import FacturaProductoStockCelda from "@/components/facturacion/FacturaProductoStockCelda";

const FILA_BUSQUEDA_GRID_BASE =
  "grid w-full items-center justify-items-stretch gap-1.5 px-2";

/** COD. | DESCRIPCIÓN | PX. LISTA | STOCK */
export const FILA_BUSQUEDA_PRODUCTOS_GRID = cn(
  FILA_BUSQUEDA_GRID_BASE,
  "grid-cols-[5.5rem_minmax(0,1fr)_6.75rem_4rem]"
);

/** COD. | DESCRIPCIÓN | PX. LISTA | DESC. | PX C/ DESC. | STOCK */
export const FILA_BUSQUEDA_PRODUCTOS_GRID_CON_DESC = cn(
  FILA_BUSQUEDA_GRID_BASE,
  "grid-cols-[5.5rem_minmax(0,1fr)_6.75rem_4.5rem_6.75rem_4rem]"
);

/** COD. | DESCRIPCIÓN | PX. LISTA | VER | STOCK */
export const FILA_BUSQUEDA_PRODUCTOS_GRID_CON_VER = cn(
  FILA_BUSQUEDA_GRID_BASE,
  "grid-cols-[5.5rem_minmax(0,1fr)_6.75rem_3.25rem_4rem]"
);

/** COD. | DESCRIPCIÓN | PX. LISTA | DESC. | PX C/ DESC. | VER | STOCK */
export const FILA_BUSQUEDA_PRODUCTOS_GRID_CON_DESC_VER = cn(
  FILA_BUSQUEDA_GRID_BASE,
  "grid-cols-[5.5rem_minmax(0,1fr)_6.75rem_4.5rem_6.75rem_3.25rem_4rem]"
);

export function filaBusquedaProductosGridClass(opts: {
  conDesc: boolean;
  conVer: boolean;
}): string {
  if (opts.conDesc && opts.conVer) return FILA_BUSQUEDA_PRODUCTOS_GRID_CON_DESC_VER;
  if (opts.conDesc) return FILA_BUSQUEDA_PRODUCTOS_GRID_CON_DESC;
  if (opts.conVer) return FILA_BUSQUEDA_PRODUCTOS_GRID_CON_VER;
  return FILA_BUSQUEDA_PRODUCTOS_GRID;
}

interface FacturaProductoBusquedaListaProps {
  items: readonly ProductoFacturaBusquedaItem[];
  sucursalCodigo: string | null;
  activoIndex: number;
  onActivar: (index: number) => void;
  onElegir: (item: ProductoFacturaBusquedaItem) => void;
  onVerStock: (item: ProductoFacturaBusquedaItem) => void;
  onVerEspeciales: (item: ProductoFacturaBusquedaItem) => void;
  className?: string;
  /** Alto de fila. El typeahead en `main` crece a 2.5rem por `main button`; el modal (portal) hay que fijarlo. */
  filaClassName?: string;
  descuento?: FacturaDescuentoEstado | null;
  lineas?: readonly FacturaLineaLocal[];
}

/** Misma grilla COD. / DESCRIPCIÓN / precios / VER / STOCK del buscador de Factura · Crear. */
export default function FacturaProductoBusquedaLista({
  items,
  sucursalCodigo,
  activoIndex,
  onActivar,
  onElegir,
  onVerStock,
  onVerEspeciales,
  className,
  filaClassName = "min-h-5",
  descuento = null,
  lineas = [],
}: FacturaProductoBusquedaListaProps) {
  const mostrarColumnasDesc = items.some((item) => {
    const pct = porcentajeDescuentoParaProductoBusqueda(
      item,
      descuento,
      lineas
    );
    return pct > 0 && pxConDescuento(item.pxLista, pct) !== item.pxLista;
  });
  const mostrarColumnaVer = items.some(itemTieneDescEspecial);
  const filaGrid = filaBusquedaProductosGridClass({
    conDesc: mostrarColumnasDesc,
    conVer: mostrarColumnaVer,
  });

  return (
    <div className={cn(TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS, className)}>
      <div
        className={cn(filaGrid, TYPEAHEAD_LISTBOX_HEADER_CLASS)}
        aria-hidden
      >
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>COD.</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>DESCRIPCIÓN</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>PX. LISTA</span>
        {mostrarColumnasDesc ? (
          <>
            <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>DESC.</span>
            <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>PX C/ DESC.</span>
          </>
        ) : null}
        {mostrarColumnaVer ? (
          <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>VER</span>
        ) : null}
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>STOCK</span>
      </div>
      <ul className={cn(TYPEAHEAD_LISTBOX_UL_CLASS, "flex-none overflow-visible")}>
        {items.map((item, idx) => {
          const activo = idx === activoIndex;
          const pct = porcentajeDescuentoParaProductoBusqueda(
            item,
            descuento,
            lineas
          );
          const pxLista = item.pxLista;
          const pxDesc = pxConDescuento(pxLista, pct);
          const mostrarDescFila = pct > 0 && pxDesc !== pxLista;
          const esDescEspecial = itemTieneDescEspecial(item);
          return (
            <li key={item.codTienda} role="option" aria-selected={activo}>
              <div
                role="button"
                tabIndex={-1}
                className={cn(
                  filaGrid,
                  filaClassName,
                  "cursor-pointer py-0 text-sm leading-tight text-foreground transition-colors",
                  activo && TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS,
                  esDescEspecial && TYPEAHEAD_FILA_DESC_ESPECIAL_CLASS
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
                  {`$${fmtPrecio(pxLista)}`}
                </span>
                {mostrarColumnasDesc ? (
                  <>
                    <span
                      className={cn(
                        TYPEAHEAD_LISTBOX_CELL_CLASS,
                        "tabular-nums text-foreground"
                      )}
                    >
                      {mostrarDescFila ? `${Math.round(pct)}%` : ""}
                    </span>
                    <span
                      className={cn(
                        TYPEAHEAD_LISTBOX_CELL_CLASS,
                        "tabular-nums text-foreground"
                      )}
                    >
                      {mostrarDescFila ? `$${fmtPrecio(pxDesc)}` : ""}
                    </span>
                  </>
                ) : null}
                {mostrarColumnaVer ? (
                  esDescEspecial ? (
                    <FacturaProductoDescEspecialCelda
                      item={item}
                      onVerEspeciales={onVerEspeciales}
                    />
                  ) : (
                    <span className={TYPEAHEAD_LISTBOX_CELL_CLASS} />
                  )
                ) : null}
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
