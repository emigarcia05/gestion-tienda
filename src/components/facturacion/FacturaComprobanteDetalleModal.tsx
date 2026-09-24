"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { obtenerFacturaComprobantePdfAction } from "@/actions/factura";
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
  FACTURA_TIPO_LABELS,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  pxConDescuento,
  resumenTotalesFactura,
  totalLineaConDescuento,
} from "@/lib/factura";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";

import type { ActionResult } from "@/lib/types";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobanteId: string | null;
  obtenerPdf?: (input: {
    id: string;
  }) => Promise<ActionResult<FacturaComprobantePdfDatos>>;
};

function tituloDetalle(datos: FacturaComprobantePdfInput | null): string {
  if (datos == null) return "COMPROBANTE";
  const letra = datos.letra?.trim();
  const base = FACTURA_TIPO_LABELS[datos.tipo];
  return letra ? `${base} ${letra}` : base;
}

export default function FacturaComprobanteDetalleModal({
  open,
  onOpenChange,
  comprobanteId,
  obtenerPdf = obtenerFacturaComprobantePdfAction,
}: Props) {
  const [datos, setDatos] = useState<FacturaComprobantePdfInput | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !comprobanteId) return;
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    void obtenerPdf({ id: comprobanteId }).then((res) => {
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
  }, [open, comprobanteId, obtenerPdf]);

  const pctGlobal = useMemo(
    () => (datos ? porcentajeDescuentoGlobal(datos.lineas, datos.descuento) : 0),
    [datos]
  );
  const resumen = useMemo(
    () => (datos ? resumenTotalesFactura(datos.lineas, datos.descuento) : null),
    [datos]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="xl"
        padding="sm"
        title={tituloDetalle(datos)}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : datos == null ? (
          <p className="text-sm text-muted-foreground">No se pudo mostrar el comprobante.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <p>
                <span className="font-semibold">CLIENTE: </span>
                {fmtCelda(datos.cliente)}
              </p>
              <p className="tabular-nums">
                <span className="font-semibold">FECHA: </span>
                {formatIsoYmdDdMmYyyyArgentina(datos.fechaIso)}
              </p>
              <p className="tabular-nums">
                <span className="font-semibold">N°: </span>
                {fmtCelda(datos.nroComprobante)}
              </p>
              {datos.comentarios.trim() ? (
                <p className="col-span-2">
                  <span className="font-semibold">COMENTARIOS: </span>
                  {datos.comentarios.trim()}
                </p>
              ) : null}
            </div>

            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[4.5rem]">COD.</TableHead>
                    <TableHead>DESCRIPCIÓN</TableHead>
                    <TableHead className="w-[4.5rem] text-center">CANT.</TableHead>
                    <TableHead className="w-[5.5rem] text-right">PX. LISTA</TableHead>
                    <TableHead className="w-[4.5rem] text-center">DESC.</TableHead>
                    <TableHead className="w-[5.5rem] text-right">PX C/D</TableHead>
                    <TableHead className="w-[5.5rem] text-right">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.lineas.length === 0 ? (
                    <EmptyTableRow colSpan={7} message="Sin ítems." />
                  ) : (
                    datos.lineas.map((linea) => {
                      const pct = porcentajeDescuentoLinea(linea, pctGlobal);
                      const pxDesc = pxConDescuento(linea.pxLista, pct);
                      const total = totalLineaConDescuento(linea, pct);
                      const comentario = linea.comentario.trim();
                      return (
                        <TableRow key={linea.key}>
                          <TableCell className="celda-datos tabular-nums">
                            {fmtCelda(linea.codTienda)}
                          </TableCell>
                          <TableCell className="celda-datos text-left">
                            <span className="flex flex-col gap-0.5">
                              <span>{linea.descripcion}</span>
                              {comentario ? (
                                <span className="font-normal">{comentario}</span>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="celda-datos text-center tabular-nums">
                            {linea.cantidad.toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="celda-datos text-right tabular-nums">
                            ${fmtPrecio(linea.pxLista)}
                          </TableCell>
                          <TableCell className="celda-datos text-center tabular-nums">
                            {fmtPorcentajeTabla(pct)}
                          </TableCell>
                          <TableCell className="celda-datos text-right tabular-nums">
                            ${fmtPrecio(pxDesc)}
                          </TableCell>
                          <TableCell className="celda-datos text-right tabular-nums">
                            ${fmtPrecio(total)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {resumen ? (
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-3 text-sm font-semibold">
                <p>TOTAL ITEM: {resumen.totalItem}</p>
                <p className="tabular-nums">TOTAL $: ${fmtPrecio(resumen.totalLista)}</p>
                <p className="tabular-nums">
                  DESC. % PROMEDIO: {fmtPorcentajeTabla(resumen.descPctPromedio)}
                </p>
                <p className="tabular-nums">DESC. $: ${fmtPrecio(resumen.descPesos)}</p>
                <p className="tabular-nums">
                  TOTAL C/ DESC.: ${fmtPrecio(resumen.totalConDesc)}
                </p>
              </div>
            ) : null}

            {datos.cae?.trim() ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold tabular-nums">CAE: {datos.cae.trim()}</p>
                <p className="tabular-nums">
                  VTO. CAE:{" "}
                  {datos.caeVtoIso
                    ? formatIsoYmdDdMmYyyyArgentina(datos.caeVtoIso)
                    : fmtCelda("")}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
