"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { obtenerDetalleCobroComprobanteAction } from "@/actions/factura";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  lineasFormaPagoCobro,
  type FacturaCobroDetalle,
} from "@/lib/factura";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ActionResult } from "@/lib/types";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobroId: string | null;
  obtenerCobro?: (input: {
    id: string;
  }) => Promise<ActionResult<FacturaCobroDetalle>>;
  obtenerPdf?: (input: {
    id: string;
  }) => Promise<ActionResult<FacturaComprobantePdfDatos>>;
};

export default function FacturaCobroDetalleModal({
  open,
  onOpenChange,
  cobroId,
  obtenerCobro = obtenerDetalleCobroComprobanteAction,
  obtenerPdf,
}: Props) {
  const [datos, setDatos] = useState<FacturaCobroDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [comprobanteId, setComprobanteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !cobroId) return;
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    void obtenerCobro({ id: cobroId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setDatos(null);
        return;
      }
      setDatos(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, cobroId, obtenerCobro]);

  const forma = datos ? lineasFormaPagoCobro(datos.cobro) : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setComprobanteId(null);
          onOpenChange(next);
        }}
      >
        <AppModal
          size="lg"
          padding="sm"
          title="COBRO"
          actions={
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          }
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : datos == null || forma == null ? (
            <p className="text-sm text-muted-foreground">No se pudo mostrar el cobro.</p>
          ) : (
            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed text-center">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[25%]" />
                  <col className="w-[35%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">FORMA DE PAGO</TableHead>
                    <TableHead className="text-center">MONTO</TableHead>
                    <TableHead className="text-center">
                      COMPROBANTES ASIGNADOS
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="celda-datos text-center whitespace-normal">
                      <span className="flex w-full flex-col items-center justify-center text-center leading-tight">
                        <span className="uppercase">{forma.linea1}</span>
                        {forma.linea2 ? (
                          <span className="uppercase">{forma.linea2}</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      ${fmtPrecio(datos.cobro.montoCents / 100)}
                    </TableCell>
                    <TableCell className="celda-datos text-center whitespace-normal">
                      {datos.comprobantes.length === 0 ? (
                        fmtCelda("")
                      ) : (
                        <span className="flex w-full flex-col items-center justify-center gap-1">
                          {datos.comprobantes.map((cbte) => (
                            <Button
                              key={cbte.id}
                              type="button"
                              variant="link"
                              className={cn(
                                "h-auto min-h-0 px-0 py-0 font-semibold tabular-nums underline",
                                "!h-auto !min-h-0 !p-0"
                              )}
                              onClick={() => setComprobanteId(cbte.id)}
                            >
                              {fmtCelda(cbte.nroComprobante)}
                            </Button>
                          ))}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </AppModal>
      </Dialog>
      <FacturaComprobanteDetalleModal
        open={comprobanteId != null}
        onOpenChange={(next) => {
          if (!next) setComprobanteId(null);
        }}
        comprobanteId={comprobanteId}
        obtenerPdf={obtenerPdf}
      />
    </>
  );
}
