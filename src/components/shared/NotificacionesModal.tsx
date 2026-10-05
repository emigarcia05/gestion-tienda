"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
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
import { fmtCelda } from "@/lib/format";
import { marcarNotificacionLeidaApi } from "@/lib/stockTransferenciasClient";
import type { UsuarioSesion } from "@/lib/usuarioSesion";
import type {
  NotificacionDto,
  NotificacionesSucursal,
} from "@/services/notificaciones.service";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: UsuarioSesion;
  data: NotificacionesSucursal | null;
  onCambio: () => void;
  onAbrirTransferencia: (transferenciaId: string) => void;
}

/**
 * Lista de notificaciones: **MÓDULO** | **DESCRIPCIÓN** | **ACCEDER**.
 */
export default function NotificacionesModal({
  open,
  onOpenChange,
  usuario,
  data,
  onCambio,
  onAbrirTransferencia,
}: Props) {
  const [marcando, setMarcando] = useState<string | null>(null);
  const items = data?.items ?? [];

  async function marcarLeida(n: NotificacionDto) {
    setMarcando(n.id);
    const res = await marcarNotificacionLeidaApi(n.id, usuario.idPersonal);
    setMarcando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onCambio();
  }

  function abrir(n: NotificacionDto) {
    if (!n.transferenciaId) return;
    if (!n.leida && !n.accionable) void marcarLeida(n);
    onAbrirTransferencia(n.transferenciaId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        className="max-h-[85vh]"
        title="Notificaciones"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="contenedor-tabla-gestion">
          <Table variant="compact">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[58%]" />
              <col className="w-[20%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>MÓDULO</TableHead>
                <TableHead>DESCRIPCIÓN</TableHead>
                <TableHead className="text-center">ACCEDER</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <EmptyTableRow colSpan={3} message="No hay notificaciones." />
              ) : (
                items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell
                      className={cn(
                        "celda-datos text-left font-semibold uppercase",
                        n.leida && "text-muted-foreground"
                      )}
                    >
                      {fmtCelda(n.moduloEtiqueta)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "celda-datos min-w-0 text-left",
                        n.leida ? "text-muted-foreground" : "font-semibold"
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span>{fmtCelda(n.mensaje)}</span>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          {formatDdMmHhMmArgentina(new Date(n.createdAtIso))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="celda-datos text-center">
                      {n.transferenciaId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={marcando === n.id}
                          onClick={() => abrir(n)}
                        >
                          Acceder
                        </Button>
                      ) : (
                        ""
                      )}
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
