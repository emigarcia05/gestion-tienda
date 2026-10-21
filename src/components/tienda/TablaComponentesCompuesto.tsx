"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import {
  costoProductoCompuesto,
  formatCantidadComponenteInput,
  parseCantidadComponente,
  type ComponenteCompuestoItem,
} from "@/lib/productoCompuesto";
import { fmtPrecio } from "@/lib/format";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-8 w-8 min-h-8 max-h-8");

/** Fila en edición: `cantidadInput` es el texto del input (`0,005`). */
export type FilaComponente = ComponenteCompuestoItem & { cantidadInput: string };

export function aFilaComponente(c: ComponenteCompuestoItem): FilaComponente {
  return { ...c, cantidadInput: formatCantidadComponenteInput(c.cantidad) };
}

/**
 * Tabla de componentes de un producto compuesto (Editar producto y Agregar Item):
 * COD. · DESCRIPCIÓN · CANT. · COSTO UN. · SUBTOTAL · quitar, con pie COSTO COMPUESTO.
 */
export default function TablaComponentesCompuesto({
  filas,
  cargando = false,
  bloqueado,
  puedeQuitar = true,
  onCantidadChange,
  onCantidadBlur,
  onQuitar,
}: {
  filas: FilaComponente[];
  cargando?: boolean;
  bloqueado: boolean;
  puedeQuitar?: boolean;
  onCantidadChange: (codTienda: string, valor: string) => void;
  onCantidadBlur?: (codTienda: string) => void;
  onQuitar: (codTienda: string) => void;
}) {
  const costoTotal = costoProductoCompuesto(
    filas.map((f) => ({ cantidad: parseCantidadComponente(f.cantidadInput) ?? 0, costoUnitario: f.costoUnitario }))
  );

  return (
    <Table variant="compact" scrollX={false} className="table-fixed w-full">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-20 text-center">COD.</TableHead>
          <TableHead>DESCRIPCIÓN</TableHead>
          <TableHead className="w-20 text-center">CANT.</TableHead>
          <TableHead className="w-28 text-center">COSTO UN.</TableHead>
          <TableHead className="w-28 text-center">SUBTOTAL</TableHead>
          <TableHead className="w-14 text-center" aria-label="Quitar" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cargando ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6}>
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Cargando componentes...
              </div>
            </TableCell>
          </TableRow>
        ) : filas.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6}>
              <TableEmptyState message="SIN COMPONENTES." placement="panel" />
            </TableCell>
          </TableRow>
        ) : (
          filas.map((f) => (
            <TableRow key={f.codTienda}>
              <TableCell className="celda-datos celda-mono text-center text-xs">{f.codTienda}</TableCell>
              <TableCell className="celda-datos min-w-0">
                <span className="block truncate text-xs" title={f.descripcion}>
                  {f.descripcion}
                </span>
              </TableCell>
              <TableCell className="celda-datos text-center">
                <Input
                  value={f.cantidadInput}
                  onChange={(e) => onCantidadChange(f.codTienda, e.target.value)}
                  onBlur={onCantidadBlur ? () => onCantidadBlur(f.codTienda) : undefined}
                  inputMode="decimal"
                  className="h-8 text-center tabular-nums"
                  aria-label={`Cantidad de ${f.descripcion || f.codTienda}`}
                  disabled={bloqueado}
                />
              </TableCell>
              <TableCell className="celda-datos celda-numero tabular-nums text-center">
                ${fmtPrecio(f.costoUnitario)}
              </TableCell>
              <TableCell className="celda-datos celda-numero tabular-nums text-center">
                ${fmtPrecio((parseCantidadComponente(f.cantidadInput) ?? 0) * f.costoUnitario)}
              </TableCell>
              <TableCell className="text-center">
                {puedeQuitar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={ROW_ICON_BTN_CLASS}
                    aria-label={`Quitar ${f.descripcion || f.codTienda}`}
                    disabled={bloqueado}
                    onClick={() => onQuitar(f.codTienda)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="text-right text-xs font-bold uppercase">
            COSTO COMPUESTO
          </TableCell>
          <TableCell className="celda-numero tabular-nums text-center font-bold">
            ${fmtPrecio(costoTotal)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}
