"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { fmtPrecio } from "@/lib/format";
import { itemTieneDescEspecial } from "@/lib/descPromo";
import {
  porcentajeDescuentoParaProductoBusqueda,
  pxConDescuento,
  type FacturaDescuentoEstado,
  type FacturaLineaLocal,
} from "@/lib/factura";
import {
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

/** COD. | DESCRIPCIÓN | PX. LISTA | PX C/ DESC. | STOCK | DESC. ESPECIAL */
export const FILA_BUSQUEDA_PRODUCTOS_GRID = cn(
  FILA_BUSQUEDA_GRID_BASE,
  "grid-cols-[5.5rem_minmax(0,1fr)_6.75rem_6.75rem_4rem_6.5rem]"
);

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

/** Grilla COD. / DESCRIPCIÓN / PX. LISTA / PX C/ DESC. / STOCK / DESC. ESPECIAL. */
export default function FacturaProductoBusquedaLista({
  items,
  sucursalCodigo,
  activoIndex,
  onActivar,
  onElegir,
  onVerStock,
  onVerEspeciales,
  className,
  filaClassName = "min-h-7 py-1",
  descuento = null,
  lineas = [],
}: FacturaProductoBusquedaListaProps) {
  const filaGrid = FILA_BUSQUEDA_PRODUCTOS_GRID;
  const [prioridadAbierta, setPrioridadAbierta] = useState<string | null>(null);

  return (
    <div className={cn(TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS, className)}>
      <div
        className={cn(filaGrid, TYPEAHEAD_LISTBOX_HEADER_CLASS)}
        aria-hidden
      >
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>COD.</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>DESCRIPCIÓN</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>PX. LISTA</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>PX C/ DESC.</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>STOCK</span>
        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>DESC. ESPECIAL</span>
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
          const esDescEspecial = itemTieneDescEspecial(item);
          const prioridad = item.prioridadVenta;
          return (
            <li
              key={item.codTienda}
              role="option"
              aria-selected={activo}
              onMouseEnter={() => {
                if (prioridad) setPrioridadAbierta(item.codTienda);
              }}
              onMouseLeave={() => {
                setPrioridadAbierta((actual) =>
                  actual === item.codTienda ? null : actual
                );
              }}
            >
              <div
                role="button"
                tabIndex={-1}
                className={cn(
                  filaGrid,
                  filaClassName,
                  "cursor-pointer text-sm leading-tight text-foreground transition-colors",
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
                <span
                  className={cn(
                    TYPEAHEAD_LISTBOX_CELL_CLASS,
                    "whitespace-normal text-foreground"
                  )}
                >
                  <span className="inline-flex max-w-full items-center justify-center gap-1">
                    <span className="truncate">{item.descripcion}</span>
                    {prioridad ? (
                      <Info
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                </span>
                <span
                  className={cn(
                    TYPEAHEAD_LISTBOX_CELL_CLASS,
                    "tabular-nums text-foreground"
                  )}
                >
                  {`$${fmtPrecio(pxLista)}`}
                </span>
                <span
                  className={cn(
                    TYPEAHEAD_LISTBOX_CELL_CLASS,
                    "tabular-nums text-foreground"
                  )}
                >
                  {`$${fmtPrecio(pxDesc)}`}
                </span>
                <FacturaProductoStockCelda
                  item={item}
                  sucursalCodigo={sucursalCodigo}
                  onVerStock={onVerStock}
                />
                {esDescEspecial ? (
                  <FacturaProductoDescEspecialCelda
                    item={item}
                    onVerEspeciales={onVerEspeciales}
                  />
                ) : (
                  <span className={TYPEAHEAD_LISTBOX_CELL_CLASS} />
                )}
              </div>
              {prioridad && prioridadAbierta === item.codTienda ? (
                <div className="border-t border-border bg-muted/40 px-3 py-2 text-left text-xs text-foreground">
                  <p className="mb-1.5 text-muted-foreground">
                    {`En ${prioridad.categoriaNombre} le podemos recomendar al cliente estas opciones:`}
                  </p>
                  <div className="flex flex-col">
                    {prioridad.opciones.map((opcion) => {
                      const comoItem = { ...opcion, prioridadVenta: null };
                      const pxOpcion = opcion.pxLista;
                      const pxOpcionDesc = pxConDescuento(
                        pxOpcion,
                        porcentajeDescuentoParaProductoBusqueda(
                          comoItem,
                          descuento,
                          lineas
                        )
                      );
                      return (
                        <button
                          key={`${opcion.orden}-${opcion.codTienda}`}
                          type="button"
                          className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-accent"
                          onClick={() => onElegir(comoItem)}
                        >
                          <span className="text-muted-foreground">{`Prioridad ${opcion.orden}`}</span>
                          <span className="truncate">{opcion.descripcion}</span>
                          <span className="text-right tabular-nums">{`$${fmtPrecio(pxOpcion)}`}</span>
                          <span className="text-right tabular-nums">{`$${fmtPrecio(pxOpcionDesc)}`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
