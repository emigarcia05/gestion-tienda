"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import {
  esBorradorCantidadUnDecimal,
  fmtCantidad,
  parseCantidadUnDecimal,
} from "@/lib/cantidadUnDecimal";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import {
  aceptarTransferenciaApi,
  cerrarTransferenciaApi,
  obtenerTransferenciaApi,
  pedirRefrescoNotificaciones,
} from "@/lib/stockTransferenciasClient";
import type { UsuarioSesion } from "@/lib/usuarioSesion";
import type { StockTransferenciaDetalle } from "@/services/stockTransferencias.service";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferenciaId: string;
  usuario: UsuarioSesion;
  onResuelta?: () => void;
}

const ESTADO_ETIQUETA: Record<StockTransferenciaDetalle["estado"], string> = {
  PENDIENTE: "PENDIENTE",
  ACEPTADA: "ACEPTADA",
  RECHAZADA: "RECHAZADA",
  CANCELADA: "CANCELADA",
};

/**
 * Detalle de `stock_transferencias`. Sucursal que confirma (pendiente): edita
 * **CANT. RECIBIDA** (≤ enviada) y **Aceptar** (registra el stock) o **Rechazar**.
 * Sucursal creadora (pendiente): **Cancelar Transf.** Motivo opcional al rechazar / cancelar.
 */
export default function StockTransferenciaModal({
  open,
  onOpenChange,
  transferenciaId,
  usuario,
  onResuelta,
}: Props) {
  const [detalle, setDetalle] = useState<StockTransferenciaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recibidas, setRecibidas] = useState<Record<string, string>>({});
  const [cierre, setCierre] = useState<"rechazar" | "cancelar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    queueMicrotask(() => {
      setDetalle(null);
      setError(null);
      setCierre(null);
      setMotivo("");
    });
    void (async () => {
      const res = await obtenerTransferenciaApi(transferenciaId);
      if (cancelado) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDetalle(res.data);
      setRecibidas(
        Object.fromEntries(
          res.data.items.map((i) => [i.id, fmtCantidad(i.cantidadConfirmada ?? i.cantidad)])
        )
      );
    })();
    return () => {
      cancelado = true;
    };
  }, [open, transferenciaId]);

  const pendiente = detalle?.estado === "PENDIENTE";
  const puedeConfirmar = pendiente && usuario.sucursalPorDefecto === detalle?.confirmaCodigo;
  const puedeCancelar = pendiente && usuario.sucursalPorDefecto === detalle?.creadoraCodigo;
  const mostrarRecibida = puedeConfirmar || detalle?.estado === "ACEPTADA";

  function terminar(mensaje: string, descripcion?: string) {
    toast.success(mensaje, descripcion ? { description: descripcion } : undefined);
    pedirRefrescoNotificaciones();
    onResuelta?.();
    onOpenChange(false);
  }

  function aceptar() {
    if (!detalle) return;
    const items: Array<{ itemId: string; cantidadConfirmada: number }> = [];
    for (const item of detalle.items) {
      const raw = recibidas[item.id] ?? "";
      const n = raw.trim() === "" ? 0 : parseCantidadUnDecimal(raw);
      if (n == null || n < 0) {
        toast.error(`Cantidad inválida en ${item.codItem}.`);
        return;
      }
      if (n > item.cantidad) {
        toast.error(`${item.codItem}: la recibida supera la enviada (${fmtCantidad(item.cantidad)}).`);
        return;
      }
      items.push({ itemId: item.id, cantidadConfirmada: n });
    }
    startTransition(async () => {
      const res = await aceptarTransferenciaApi(detalle.id, {
        personalId: usuario.idPersonal,
        items,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      terminar("Transferencia aceptada.", `Se registraron ${res.data.movimientos} movimientos de stock.`);
    });
  }

  function confirmarCierre() {
    if (!detalle || !cierre) return;
    startTransition(async () => {
      const res = await cerrarTransferenciaApi(detalle.id, cierre, {
        personalId: usuario.idPersonal,
        motivo: motivo.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      terminar(cierre === "rechazar" ? "Transferencia rechazada." : "Transferencia cancelada.");
    });
  }

  const acciones = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => (cierre ? setCierre(null) : onOpenChange(false))}
        disabled={isPending}
      >
        {cierre ? "Volver" : "Cerrar"}
      </Button>
      {cierre ? (
        <Button type="button" onClick={confirmarCierre} disabled={isPending}>
          {cierre === "rechazar" ? "Confirmar Rechazo" : "Confirmar Cancelación"}
        </Button>
      ) : null}
      {!cierre && puedeCancelar ? (
        <Button type="button" onClick={() => setCierre("cancelar")} disabled={isPending}>
          Cancelar Transf.
        </Button>
      ) : null}
      {!cierre && puedeConfirmar ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCierre("rechazar")}
            disabled={isPending}
          >
            Rechazar
          </Button>
          <Button type="button" onClick={aceptar} disabled={isPending}>
            Aceptar
          </Button>
        </>
      ) : null}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="xl"
        className="h-[85vh] max-h-[85vh]"
        title="Transferencia entre sucursales"
        scrollBody={false}
        bodyClassName="flex min-h-0 flex-1 flex-col gap-4"
        actions={acciones}
      >
        {error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : null}
        {!error && !detalle ? (
          <p className="py-6 text-center text-sm text-foreground">Cargando…</p>
        ) : null}

        {detalle ? (
          <>
            <div className="flex shrink-0 flex-col gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                <div className="flex flex-col items-center gap-1">
                  <ModalMicroLabel align="center">SUC. ORIGEN</ModalMicroLabel>
                  <span className="text-sm font-semibold uppercase">{detalle.origenNombre}</span>
                </div>
                <ArrowRight className="mb-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="flex flex-col items-center gap-1">
                  <ModalMicroLabel align="center">SUC. DESTINO</ModalMicroLabel>
                  <span className="text-sm font-semibold uppercase">{detalle.destinoNombre}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
                <Badge variant={pendiente ? "destructive" : "secondary"}>
                  {ESTADO_ETIQUETA[detalle.estado]}
                </Badge>
                <span>
                  <strong>Generada por:</strong> {detalle.creadaPorNombre} ·{" "}
                  <span className="tabular-nums">
                    {formatDdMmHhMmArgentina(new Date(detalle.createdAtIso))}
                  </span>
                </span>
                {detalle.resueltaPorNombre && detalle.resueltaAtIso ? (
                  <span>
                    <strong>Resuelta por:</strong> {detalle.resueltaPorNombre} ·{" "}
                    <span className="tabular-nums">
                      {formatDdMmHhMmArgentina(new Date(detalle.resueltaAtIso))}
                    </span>
                  </span>
                ) : null}
              </div>
              {detalle.motivo ? (
                <p className="text-center text-sm">
                  <strong>Motivo:</strong> {detalle.motivo}
                </p>
              ) : null}
              {puedeConfirmar && !cierre ? (
                <p className="text-center text-sm text-foreground">
                  Verificá lo recibido. Si llegó menos, corregí <strong>CANT. RECIBIDA</strong>.
                  El stock se registra al aceptar.
                </p>
              ) : null}
              {cierre ? (
                <div className="flex flex-col gap-1">
                  <ModalMicroLabel>
                    {cierre === "rechazar" ? "MOTIVO DEL RECHAZO" : "MOTIVO DE LA CANCELACIÓN"} (OPCIONAL)
                  </ModalMicroLabel>
                  <Input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={500}
                    autoFocus
                  />
                </div>
              ) : null}
            </div>

            <div className="contenedor-tabla-gestion no-scroll-x min-h-0 flex-1" style={{ height: "auto" }}>
              <Table variant="compact" scrollX={false}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[16%]">COD. TIENDA</TableHead>
                    <TableHead>DESCRIPCIÓN</TableHead>
                    <TableHead className="w-[14%] text-center">CANT. ENVIADA</TableHead>
                    {mostrarRecibida ? (
                      <TableHead className="w-[14%] text-center">CANT. RECIBIDA</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.items.map((item) => {
                    const raw = recibidas[item.id] ?? "";
                    const n = parseCantidadUnDecimal(raw);
                    const difiere = n != null && n !== item.cantidad;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="celda-datos tabular-nums">{item.codItem}</TableCell>
                        <TableCell className="celda-datos min-w-0 truncate" title={item.descripcion}>
                          {item.descripcion}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {fmtCantidad(item.cantidad)}
                        </TableCell>
                        {mostrarRecibida ? (
                          <TableCell className="celda-datos text-center tabular-nums">
                            {puedeConfirmar ? (
                              <div className="flex justify-center">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={raw}
                                  disabled={isPending || cierre !== null}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== "" && !esBorradorCantidadUnDecimal(v)) return;
                                    setRecibidas((prev) => ({ ...prev, [item.id]: v }));
                                  }}
                                  className={cn(
                                    "h-6 w-16 text-center text-sm tabular-nums",
                                    difiere && "text-destructive"
                                  )}
                                  aria-label={`Cantidad recibida de ${item.codItem}`}
                                />
                              </div>
                            ) : (
                              <span className={cn(difiere && "text-destructive")}>
                                {fmtCantidad(item.cantidadConfirmada)}
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </AppModal>
    </Dialog>
  );
}
