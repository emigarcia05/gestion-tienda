"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NotificacionesModal from "@/components/shared/NotificacionesModal";
import StockTransferenciaModal from "@/components/stock/StockTransferenciaModal";
import { HEADER_ACCIONES_TRIGGER_CLASS } from "@/lib/ui-classes";
import {
  EVENTO_NOTIFICACIONES_REFRESCAR,
  listarNotificacionesApi,
} from "@/lib/stockTransferenciasClient";
import {
  EVENTO_USUARIO_SESION,
  leerUsuarioSesion,
  type UsuarioSesion,
} from "@/lib/usuarioSesion";
import type { NotificacionesSucursal } from "@/services/notificaciones.service";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;
/** Espera el cierre animado de la lista antes de abrir el detalle (no apilar `Dialog`). */
const CAMBIO_DIALOG_MS = 450;

/**
 * Botón **NOTIFICACIONES** del header (`PageSectionHeader`), a la izquierda de ACCIONES.
 * Destinatario = sucursal del usuario de pestaña. Polling 60 s + al cambiar de ruta
 * + `EVENTO_NOTIFICACIONES_REFRESCAR`. Sin usuario o sin permiso (403) no se muestra.
 * Lista y detalle de transferencia no se apilan: se abre uno a la vez.
 */
export default function NotificacionesHeaderButton() {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [data, setData] = useState<NotificacionesSucursal | null>(null);
  const [visible, setVisible] = useState(false);
  const [listaOpen, setListaOpen] = useState(false);
  const [transferenciaId, setTransferenciaId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setUsuario(leerUsuarioSesion());
    queueMicrotask(sync);
    window.addEventListener(EVENTO_USUARIO_SESION, sync);
    return () => window.removeEventListener(EVENTO_USUARIO_SESION, sync);
  }, []);

  const sucursal = usuario?.sucursalPorDefecto ?? null;

  const cargar = useCallback(async () => {
    if (!sucursal) return;
    if (document.visibilityState === "hidden") return;
    const res = await listarNotificacionesApi(sucursal);
    if (res.ok) {
      setData(res.data);
      setVisible(true);
    } else if (res.status === 401 || res.status === 403) {
      setVisible(false);
    }
  }, [sucursal]);

  useEffect(() => {
    if (!sucursal) return;
    queueMicrotask(() => void cargar());
    const timer = window.setInterval(() => void cargar(), POLL_MS);
    const onRefrescar = () => void cargar();
    window.addEventListener(EVENTO_NOTIFICACIONES_REFRESCAR, onRefrescar);
    document.addEventListener("visibilitychange", onRefrescar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(EVENTO_NOTIFICACIONES_REFRESCAR, onRefrescar);
      document.removeEventListener("visibilitychange", onRefrescar);
    };
  }, [sucursal, cargar, pathname]);

  if (!usuario || !visible) return null;

  const noLeidas = data?.noLeidas ?? 0;

  return (
    <>
      <Button
        type="button"
        variant="default"
        className={cn(HEADER_ACCIONES_TRIGGER_CLASS, "gap-2")}
        onClick={() => setListaOpen(true)}
        aria-label={
          noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"
        }
      >
        <Bell className="size-4" aria-hidden />
        NOTIFICACIONES
        {noLeidas > 0 ? (
          <Badge variant="destructive" className="min-w-5 px-1.5 tabular-nums">
            {noLeidas > 99 ? "99+" : noLeidas}
          </Badge>
        ) : null}
      </Button>

      <NotificacionesModal
        open={listaOpen}
        onOpenChange={setListaOpen}
        usuario={usuario}
        data={data}
        onCambio={() => void cargar()}
        onAbrirTransferencia={(id) => {
          setListaOpen(false);
          window.setTimeout(() => setTransferenciaId(id), CAMBIO_DIALOG_MS);
        }}
      />

      {transferenciaId ? (
        <StockTransferenciaModal
          open={transferenciaId !== null}
          onOpenChange={(open) => {
            if (!open) setTransferenciaId(null);
          }}
          transferenciaId={transferenciaId}
          usuario={usuario}
          onResuelta={() => void cargar()}
        />
      ) : null}
    </>
  );
}
