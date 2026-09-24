"use client";

import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CuentaCorrienteTotalPorItem } from "@/lib/factura";
import { fmtCelda, fmtNumero } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CuentaCorrienteTotalPorItem[];
};

export default function FacturaCuentaCorrienteTotalesItemModal({
  open,
  onOpenChange,
  items,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title="TOTALES POR ITEM"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="contenedor-tabla-gestion max-h-[min(24rem,50vh)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">DESCRIPCIÓN</TableHead>
                <TableHead className="w-[6rem] text-center">CANTIDAD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <EmptyTableRow colSpan={2} message="NO HAY PRODUCTOS." />
              ) : (
                items.map((item) => (
                  <TableRow key={item.descripcion}>
                    <TableCell className="text-left">
                      {fmtCelda(item.descripcion)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {fmtNumero(item.cantidad)}
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
