"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { fmtCantidad } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoFacturaBusquedaItem | null;
  /** Sucursal de la sesión. Su fila se separa del resto. */
  sucursalCodigo: string | null;
}

/**
 * Detalle de stock por sucursal (ícono Store del typeahead Factura · Crear).
 * Título fijo. El ítem va en el cuerpo. La sucursal activa queda aparte de las demás.
 */
export default function FacturaProductoStockModal({
  open,
  onOpenChange,
  producto,
  sucursalCodigo,
}: Props) {
  const nombreItem = producto?.descripcion?.trim() ?? "";
  const filas = producto?.stockPorSucursal ?? [];
  const activa =
    sucursalCodigo != null
      ? (filas.find((f) => f.codigo === sucursalCodigo) ?? null)
      : null;
  const otras = filas.filter((f) => f.codigo !== activa?.codigo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title="STOCK POR SUCURSALES"
        actions={
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm font-semibold uppercase leading-snug text-foreground">
            {nombreItem}
          </p>

          {activa ? (
            <section className="flex flex-col gap-2">
              <ModalMicroLabel>SUCURSAL ACTIVA</ModalMicroLabel>
              <div
                className={cn(
                  "flex min-h-10 items-center justify-between gap-3 rounded-md border border-primary bg-primary/10 px-3"
                )}
              >
                <span className="min-w-0 truncate text-sm font-semibold uppercase text-foreground">
                  {activa.nombre.toLocaleUpperCase("es")}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {fmtCantidad(activa.stock)}
                </span>
              </div>
            </section>
          ) : null}

          <section className={cn("flex flex-col gap-2", activa && "border-t border-border pt-4")}>
            <ModalMicroLabel>
              {activa ? "OTRAS SUCURSALES" : "SUCURSALES"}
            </ModalMicroLabel>
            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>SUCURSAL</TableHead>
                    <TableHead className="w-[8rem] text-right">STOCK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otras.length === 0 ? (
                    <EmptyTableRow
                      colSpan={2}
                      message={
                        activa ? "Sin otras sucursales." : "Sin sucursales con depósito."
                      }
                    />
                  ) : (
                    otras.map((f) => (
                      <TableRow key={f.codigo}>
                        <TableCell className="celda-datos text-left">
                          {f.nombre.toLocaleUpperCase("es")}
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          {fmtCantidad(f.stock)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
