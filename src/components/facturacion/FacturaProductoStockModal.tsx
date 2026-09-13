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
import { fmtNumero } from "@/lib/format";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoFacturaBusquedaItem | null;
}

/**
 * Detalle de stock por sucursal (lupa del typeahead Factura · Crear).
 */
export default function FacturaProductoStockModal({
  open,
  onOpenChange,
  producto,
}: Props) {
  const titulo = producto?.descripcion?.trim()
    ? producto.descripcion
    : "Stock por sucursal";
  const filas = producto?.stockPorSucursal ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title={titulo}
        actions={
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 max-h-[50vh] overflow-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>SUCURSAL</TableHead>
                <TableHead className="w-[8rem] text-right">STOCK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <EmptyTableRow colSpan={2} message="Sin sucursales con depósito." />
              ) : (
                filas.map((f) => (
                  <TableRow key={f.codigo}>
                    <TableCell className="celda-datos text-left">
                      {f.nombre.toLocaleUpperCase("es")}
                    </TableCell>
                    <TableCell className="celda-datos text-right tabular-nums">
                      {fmtNumero(f.stock)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AppModal>
    </Dialog>
  );
}
