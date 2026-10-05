"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  obtenerStockComprobanteDetalleAction,
  type StockComprobanteDetalle,
} from "@/actions/stockMovimientos";
import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
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
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import { fmtCantidad, fmtCelda } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockComprobanteId: string | null;
};

export default function StockComprobanteDetalleModal({
  open,
  onOpenChange,
  stockComprobanteId,
}: Props) {
  const [datos, setDatos] = useState<StockComprobanteDetalle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !stockComprobanteId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setDatos(null);
      setLoading(true);
    });
    void obtenerStockComprobanteDetalleAction({ stockComprobanteId }).then(
      (res) => {
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          toast.error(res.error);
          setDatos(null);
          return;
        }
        setDatos(res.data);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, stockComprobanteId]);

  const titulo = datos?.tipoEtiqueta ?? "COMPROBANTE DE STOCK";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        title={titulo}
        bodyClassName="space-y-4"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-foreground">Cargando…</p>
        ) : null}
        {!loading && datos ? (
          <>
            <div className="modal-seccion-formulario space-y-2">
              <LineaLecturaModal
                etiqueta="FECHA"
                valor={formatDdMmHhMmArgentina(new Date(datos.fechaMs))}
                tabular
              />
              <LineaLecturaModal
                etiqueta="TIPO"
                valor={fmtCelda(datos.tipoEtiqueta)}
              />
              <LineaLecturaModal
                etiqueta="USUARIO"
                valor={fmtCelda(datos.usuarioNombre)}
              />
              <LineaLecturaModal
                etiqueta="SUCURSAL"
                valor={fmtCelda(datos.sucursalOrigen)}
              />
              {datos.sucursalDestino ? (
                <LineaLecturaModal
                  etiqueta="SUCURSAL DESTINO"
                  valor={fmtCelda(datos.sucursalDestino)}
                />
              ) : null}
            </div>
            <div className="contenedor-tabla-gestion max-h-[40vh]">
              <Table variant="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>ITEM</TableHead>
                    <TableHead>TIPO</TableHead>
                    <TableHead>CATEGORÍA</TableHead>
                    <TableHead>SUCURSAL</TableHead>
                    <TableHead className="text-right">CANT.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.lineas.length === 0 ? (
                    <EmptyTableRow colSpan={5} message="Sin líneas" />
                  ) : (
                    datos.lineas.map((linea) => (
                      <TableRow key={linea.id}>
                        <TableCell className="celda-datos min-w-0">
                          {fmtCelda(linea.item)}
                        </TableCell>
                        <TableCell className="celda-datos">
                          {fmtCelda(linea.tipoEtiqueta)}
                        </TableCell>
                        <TableCell className="celda-datos">
                          {fmtCelda(linea.categoriaEtiqueta)}
                        </TableCell>
                        <TableCell className="celda-datos">
                          {fmtCelda(linea.sucursalCodigo)}
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          {fmtCantidad(linea.cantidad)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
        {!loading && !datos ? (
          <p className="py-6 text-center text-sm text-foreground">
            Sin datos del comprobante.
          </p>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
