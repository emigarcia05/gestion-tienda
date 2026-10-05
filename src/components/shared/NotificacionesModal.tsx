"use client";

import { useState } from "react";
import { ArrowRightLeft, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppModal from "@/components/shared/AppModal";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
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
 * Lista de notificaciones de la sucursal (no leídas primero).
 * Pendientes de acción → **Revisar** (abre la transferencia); informativas → **Ver** + marcar leída.
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
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground">
            No hay notificaciones.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 py-3",
                  n.leida && "text-muted-foreground"
                )}
              >
                <ArrowRightLeft
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    n.leida ? "text-muted-foreground" : "text-primary"
                  )}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm",
                        n.leida ? "font-medium" : "font-semibold text-foreground"
                      )}
                    >
                      {n.titulo}
                    </span>
                    {n.accionable ? <Badge variant="destructive">Pendiente</Badge> : null}
                  </div>
                  <p className="text-sm">{n.mensaje}</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDdMmHhMmArgentina(new Date(n.createdAtIso))}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.transferenciaId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={n.accionable ? "default" : "outline"}
                      onClick={() => abrir(n)}
                    >
                      {n.accionable ? (
                        "Revisar"
                      ) : (
                        <>
                          <Eye className="size-4" aria-hidden />
                          Ver
                        </>
                      )}
                    </Button>
                  ) : null}
                  {!n.leida && !n.accionable ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={marcando === n.id}
                      onClick={() => void marcarLeida(n)}
                      aria-label="Marcar como leída"
                      title="Marcar como leída"
                    >
                      <Check className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppModal>
    </Dialog>
  );
}
