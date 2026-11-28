"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { fmtCantidad } from "@/lib/cantidadUnDecimal";
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
import type {
  ProductoFacturaBusquedaItem,
  ProductoFacturaOpcionPrioridad,
} from "@/services/facturaProductos.service";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import FacturaProductoDescEspecialCelda from "@/components/facturacion/FacturaProductoDescEspecialCelda";
import FacturaProductoStockCelda from "@/components/facturacion/FacturaProductoStockCelda";

const SUBFILA_DETALLE_CLASS = "tabla-fila-detalle-competencia";
const SUBFILA_CELDA_CLASS = "tabla-fila-detalle-competencia-celda";
const SUBFILA_HUECA_CLASS = "tabla-fila-detalle-competencia-hueca";

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
                <PrioridadVentaSubtabla
                  categoriaNombre={prioridad.categoriaNombre}
                  opciones={prioridad.opciones.filter(
                    (opcion) => opcion.codTienda !== item.codTienda
                  )}
                  descuento={descuento}
                  lineas={lineas}
                  onElegir={onElegir}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PrioridadVentaSubtabla({
  categoriaNombre,
  opciones,
  descuento,
  lineas,
  onElegir,
}: {
  categoriaNombre: string;
  opciones: readonly ProductoFacturaOpcionPrioridad[];
  descuento: FacturaDescuentoEstado | null;
  lineas: readonly FacturaLineaLocal[];
  onElegir: (item: ProductoFacturaBusquedaItem) => void;
}) {
  if (opciones.length === 0) return null;
  const frase = `En la categoria "${categoriaNombre}", podemos ofrecerle estas otras alternativas`;
  return (
    <Table scrollX={false}>
      <colgroup>
        <col className="w-6" />
        <col className="w-28" />
        <col />
        <col className="w-24" />
        <col className="w-28" />
        <col className="w-16" />
      </colgroup>
      <TableBody>
        <TableRow className={cn(SUBFILA_DETALLE_CLASS, "hover:bg-transparent")}>
          <TableCell
            className={cn("celda-datos", SUBFILA_HUECA_CLASS)}
            aria-hidden
          />
          <TableCell
            colSpan={5}
            className={cn("celda-datos max-w-0", SUBFILA_CELDA_CLASS)}
          >
            <span className="block truncate text-xs text-foreground" title={frase}>
              {frase}
            </span>
          </TableCell>
        </TableRow>
        <TableRow className={cn(SUBFILA_DETALLE_CLASS, "hover:bg-transparent")}>
          <TableCell className={cn("celda-datos", SUBFILA_HUECA_CLASS)} aria-hidden />
          <TableCell className={cn("celda-datos", SUBFILA_CELDA_CLASS)}>PRIORIDAD</TableCell>
          <TableCell className={cn("celda-datos", SUBFILA_CELDA_CLASS)}>DESCRIPCIÓN</TableCell>
          <TableCell className={cn("celda-datos", SUBFILA_CELDA_CLASS)}>PX LISTA</TableCell>
          <TableCell className={cn("celda-datos", SUBFILA_CELDA_CLASS)}>PX C/ DESC.</TableCell>
          <TableCell className={cn("celda-datos", SUBFILA_CELDA_CLASS)}>STOCK</TableCell>
        </TableRow>
        {opciones.map((opcion) => {
          const comoItem = { ...opcion, prioridadVenta: null };
          const pxOpcion = opcion.pxLista;
          const pxOpcionDesc = pxConDescuento(
            pxOpcion,
            porcentajeDescuentoParaProductoBusqueda(comoItem, descuento, lineas)
          );
          return (
            <TableRow
              key={`${opcion.orden}-${opcion.codTienda}`}
              className={cn(
                SUBFILA_DETALLE_CLASS,
                "cursor-pointer hover:bg-transparent"
              )}
              onClick={() => onElegir(comoItem)}
            >
              <TableCell className={cn("celda-datos", SUBFILA_HUECA_CLASS)} aria-hidden />
              <TableCell className={cn("celda-datos", SUBFILA_CELDA_CLASS)}>
                {`PRIORIDAD ${opcion.orden}`}
              </TableCell>
              <TableCell className={cn("celda-datos max-w-0", SUBFILA_CELDA_CLASS)}>
                <span className="block truncate text-xs text-foreground" title={opcion.descripcion}>
                  {opcion.descripcion}
                </span>
              </TableCell>
              <TableCell className={cn("celda-datos celda-numero", SUBFILA_CELDA_CLASS)}>
                {`$${fmtPrecio(pxOpcion)}`}
              </TableCell>
              <TableCell className={cn("celda-datos celda-numero", SUBFILA_CELDA_CLASS)}>
                {`$${fmtPrecio(pxOpcionDesc)}`}
              </TableCell>
              <TableCell className={cn("celda-datos celda-numero", SUBFILA_CELDA_CLASS)}>
                {fmtCantidad(opcion.stock)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
