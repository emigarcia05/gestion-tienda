"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listarCobrosComprobanteFacturaAction } from "@/actions/factura";
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
import {
  lineasFormaPagoCobro,
  type FacturaComprobanteCobroItem,
} from "@/lib/factura";
import { formatInstanteDdMmYyHhMmArgentina } from "@/lib/fechaArgentina";
import { fmtCelda } from "@/lib/format";
import { montoArCentsToDisplayWithCurrency } from "@/lib/montoArMask";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobanteId: string | null;
  nroComprobante: string;
};

export default function FacturaComprobanteCobrosModal({
  open,
  onOpenChange,
  comprobanteId,
  nroComprobante,
}: Props) {
  const [items, setItems] = useState<FacturaComprobanteCobroItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !comprobanteId) return;
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    void listarCobrosComprobanteFacturaAction({ id: comprobanteId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setItems([]);
        return;
      }
      setItems(res.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [open, comprobanteId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        padding="sm"
        title={`COBROS ${nroComprobante}`.trim()}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="contenedor-tabla-gestion min-h-0 max-h-[50vh] overflow-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[7.5rem]">FECHA</TableHead>
                  <TableHead>FORMA PAGO</TableHead>
                  <TableHead className="w-[6.5rem] text-right">MONTO</TableHead>
                  <TableHead className="w-[8rem]">PERSONAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <EmptyTableRow colSpan={4} message="No hay cobros registrados." />
                ) : (
                  items.map((cobro) => {
                    const { linea1, linea2 } = lineasFormaPagoCobro(cobro);
                    return (
                      <TableRow key={cobro.id}>
                        <TableCell className="celda-datos tabular-nums">
                          {formatInstanteDdMmYyHhMmArgentina(new Date(cobro.createdAtIso))}
                        </TableCell>
                        <TableCell className="celda-datos text-left">
                          <span className="flex flex-col gap-0.5">
                            <span>{linea1}</span>
                            {linea2 ? (
                              <span className="font-normal">{linea2}</span>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          {montoArCentsToDisplayWithCurrency(cobro.montoCents, "$")}
                        </TableCell>
                        <TableCell className="celda-datos text-left">
                          {fmtCelda(cobro.personalNombre)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
