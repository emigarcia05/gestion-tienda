"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  asignarClienteCobroComoCobroAction,
  obtenerDetalleCobroComprobanteAction,
} from "@/actions/factura";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
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
  type FacturaCobroDetalle,
} from "@/lib/factura";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ActionResult } from "@/lib/types";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobroId: string | null;
  puedeAsignar?: boolean;
  onAsignado?: () => void;
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
  puedeAsignar = false,
  onAsignado,
  obtenerCobro = obtenerDetalleCobroComprobanteAction,
  obtenerPdf,
}: Props) {
  const [datos, setDatos] = useState<FacturaCobroDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [comprobanteId, setComprobanteId] = useState<string | null>(null);
  const obtenerCobroRef = useRef(obtenerCobro);
  const datosCobroIdRef = useRef<string | null>(null);

  useEffect(() => {
    obtenerCobroRef.current = obtenerCobro;
  }, [obtenerCobro]);

  useEffect(() => {
    if (!open || !cobroId) return;
    let cancelled = false;
    const yaTieneEsteCobro = datosCobroIdRef.current === cobroId;
    if (!yaTieneEsteCobro) {
      queueMicrotask(() => {
        if (cancelled) return;
        setDatos(null);
        setLoading(true);
      });
    }
    void obtenerCobroRef.current({ id: cobroId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setDatos(null);
        datosCobroIdRef.current = null;
        return;
      }
      datosCobroIdRef.current = cobroId;
      setDatos(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, cobroId]);

  const forma = datos ? lineasFormaPagoCobro(datos.cobro) : null;
  const muestraAsignar =
    puedeAsignar &&
    datos != null &&
    datos.esClienteCobro &&
    datos.saldoDisponible > 0 &&
    datos.ventasPendientes.length > 0;

  async function recargar() {
    if (!cobroId) return;
    const res = await obtenerCobroRef.current({ id: cobroId });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    datosCobroIdRef.current = cobroId;
    setDatos(res.data);
  }

  async function asignar(ventaId: string) {
    if (!cobroId) return;
    setAsignandoId(ventaId);
    const res = await asignarClienteCobroComoCobroAction({ cobroId, ventaId });
    setAsignandoId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cobro asignado.");
    await recargar();
    onAsignado?.();
  }

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
          className="max-w-[43.2rem]"
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
            <div className="flex min-h-0 flex-col gap-3">
              {datos.esClienteCobro ? (
                <p className="text-center text-sm font-semibold tabular-nums">
                  SALDO DISPONIBLE: ${fmtPrecio(datos.saldoDisponible)}
                </p>
              ) : null}
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
              {muestraAsignar ? (
                <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
                  <Table className="w-full table-fixed text-center">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[34%]" />
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">FECHA</TableHead>
                        <TableHead className="text-center">COMPROBANTE</TableHead>
                        <TableHead className="text-center">SALDO</TableHead>
                        <TableHead className="text-center">ASIGNAR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {datos.ventasPendientes.length === 0 ? (
                        <EmptyTableRow
                          colSpan={4}
                          message="No hay comprobantes con saldo."
                        />
                      ) : (
                        datos.ventasPendientes.map((venta) => (
                          <TableRow key={venta.id}>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatIsoYmdDdMmYyyyArgentina(venta.fechaIso)}
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              <Button
                                type="button"
                                variant="link"
                                aria-label={`Ver ${venta.nroComprobante}`}
                                className={cn(
                                  "h-auto min-h-0 px-0 py-0 font-semibold tabular-nums underline",
                                  "!h-auto !min-h-0 !p-0"
                                )}
                                onClick={() => setComprobanteId(venta.id)}
                              >
                                {venta.nroComprobante}
                              </Button>
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              ${fmtPrecio(venta.saldoPendiente)}
                            </TableCell>
                            <TableCell className="celda-datos text-center">
                              <Button
                                type="button"
                                size="sm"
                                disabled={asignandoId != null}
                                onClick={() => void asignar(venta.id)}
                              >
                                Asignar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
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
