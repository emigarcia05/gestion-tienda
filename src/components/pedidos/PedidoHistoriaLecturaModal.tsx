"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { fetchPedidoHistoriaDetalle } from "@/lib/fetchPedidoHistoriaDetalle";
import type {
  PedidoHistoriaDetalle,
  PedidoHistoriaItemDetalle,
} from "@/services/pedidosHistoria.service";
import { AlertTriangle } from "lucide-react";
import { Download, Loader2 } from "lucide-react";
import { ICON_WARNING_INTERACTIVE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";

function deltaCantidades(it: PedidoHistoriaItemDetalle): number {
  return (it.cantRecibida ?? 0) - it.cantPedida;
}

function tituloCeldaCantRecibida(it: PedidoHistoriaItemDetalle): string {
  const d = deltaCantidades(it);
  if (d === 0) return "";
  const sign = d > 0 ? "+" : "";
  const rec = (it.cantRecibida ?? 0).toLocaleString("es-AR");
  return `Pedido ${it.cantPedida.toLocaleString("es-AR")}, recibido ${rec}. Diferencia: ${sign}${d.toLocaleString("es-AR")}.`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoHistoriaId: string | null;
  /** Si el pedido está en estado ABIERTO y hay callback, se muestra junto a Cerrar. */
  onIrARecepcion?: () => void;
  onDescargarPdf?: () => Promise<void> | void;
  descargandoPdf?: boolean;
}

export default function PedidoHistoriaLecturaModal({
  open,
  onOpenChange,
  pedidoHistoriaId,
  onIrARecepcion,
  onDescargarPdf,
  descargandoPdf = false,
}: Props) {
  const [detalle, setDetalle] = useState<PedidoHistoriaDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pedidoHistoriaId) return;

    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setErrorMsg(null);
      setDetalle(null);
    });

    void (async () => {
      const res = await fetchPedidoHistoriaDetalle(pedidoHistoriaId);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setDetalle(null);
        setErrorMsg(res.error ?? "Error al cargar el detalle.");
        return;
      }
      setDetalle(res.data);
      setErrorMsg(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pedidoHistoriaId]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setDetalle(null);
        setErrorMsg(null);
        setLoading(false);
      });
    }
  }, [open]);

  const esRecibido = detalle?.estado === "RECEPCIONADO";

  const fechaSubcabecera = useMemo(() => {
    if (!detalle) return "";
    const ref =
      esRecibido && detalle.registradoAt != null
        ? detalle.registradoAt
        : detalle.generadoAt;
    const d = toDate(ref);
    return d ? formatDdMmHhMmArgentina(d) : "";
  }, [detalle, esRecibido]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Ver Pedido"
        size="xl"
        scrollBody={false}
        padding="default"
        actions={
          <div className={cn("flex flex-wrap items-center justify-end gap-2")}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {detalle && !esRecibido && onIrARecepcion ? (
              <Button type="button" variant="default" onClick={() => onIrARecepcion()}>
                Recepción de Compra
              </Button>
            ) : null}
            {detalle ? (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  void onDescargarPdf?.();
                }}
                disabled={descargandoPdf}
              >
                {descargandoPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Descargar PDF
              </Button>
            ) : null}
          </div>
        }
      >
        {errorMsg ? (
          <p className="text-sm text-destructive">{errorMsg}</p>
        ) : detalle ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-w-0 shrink-0 flex-col gap-1 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge
                  className="w-fit shrink-0"
                  variant={esRecibido ? "secondary" : "default"}
                >
                  {esRecibido ? "Recepcionado" : "Sin Recepción"}
                </Badge>
                <p className="min-w-0 flex-1 text-base font-semibold leading-snug break-words text-foreground">
                  {detalle.proveedorNombre?.trim() ?? ""}
                </p>
              </div>
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-medium text-foreground">
                {detalle.sucursalNombre?.trim() ? (
                  <span className="min-w-0 break-words">{detalle.sucursalNombre}</span>
                ) : null}
                {detalle.sucursalNombre?.trim() && fechaSubcabecera ? (
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    —
                  </span>
                ) : null}
                {fechaSubcabecera ? (
                  <span className="text-sm font-normal tabular-nums text-muted-foreground">
                    {fechaSubcabecera}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="contenedor-tabla-gestion no-scroll-x no-scrollbar relative min-h-0 min-w-0 flex-1">
              <Table variant="compact" scrollX={false} className="min-w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[52%] text-left">DESCRIPCIÓN</TableHead>
                    {esRecibido ? (
                      <TableHead className="w-[10%] px-1 text-center">
                        <span className="sr-only">Diferencia cantidades</span>
                      </TableHead>
                    ) : null}
                    <TableHead className="w-[19%]">CANT. PED.</TableHead>
                    {esRecibido ? (
                      <TableHead className="w-[19%]">CANT. REC.</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.items.length === 0 ? (
                    <EmptyTableRow
                      colSpan={esRecibido ? 4 : 2}
                      message="SIN ÍTEMS."
                    />
                  ) : (
                    detalle.items.map((it) => {
                      const delta = esRecibido ? deltaCantidades(it) : 0;
                      const hayDiferencia = esRecibido && delta !== 0;
                      const tituloDiff = tituloCeldaCantRecibida(it);
                      return (
                        <TableRow key={it.id}>
                          <TableCell
                            className="celda-datos min-w-0 whitespace-normal text-left align-top"
                            title={
                              it.codTienda
                                ? `${it.codTienda} — ${it.descripcionTienda}`
                                : it.descripcionTienda
                            }
                          >
                            {it.descripcionTienda?.trim() ?? ""}
                          </TableCell>
                          {esRecibido ? (
                            <TableCell className="celda-datos w-[10%] px-1 text-center align-middle">
                              {hayDiferencia ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className={ICON_WARNING_INTERACTIVE_CLASS}
                                      aria-label={tituloDiff}
                                    >
                                      <AlertTriangle
                                        className="h-4 w-4 shrink-0"
                                        aria-hidden
                                      />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    {tituloDiff}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="inline-block w-4" aria-hidden />
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell className="celda-datos tabular-nums">
                            {it.cantPedida.toLocaleString("es-AR")}
                          </TableCell>
                          {esRecibido ? (
                            <TableCell
                              className="celda-datos tabular-nums text-foreground"
                              title={tituloDiff || undefined}
                            >
                              {it.cantRecibida != null
                                ? it.cantRecibida.toLocaleString("es-AR")
                                : ""}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
