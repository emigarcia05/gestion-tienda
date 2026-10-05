import { fetchApiJson } from "@/lib/apiFetchJson";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import type { NotificacionesSucursal } from "@/services/notificaciones.service";
import type { StockTransferenciaDetalle } from "@/services/stockTransferencias.service";

/** Evento de ventana: refrescar NOTIFICACIONES tras crear / resolver una transferencia. */
export const EVENTO_NOTIFICACIONES_REFRESCAR = "main-app-notificaciones-refrescar";

export function pedirRefrescoNotificaciones(): void {
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES_REFRESCAR));
}

export function crearTransferenciaApi(body: {
  origenCodigo: SucursalTransf;
  destinoCodigo: SucursalTransf;
  personalId: number;
  items: Array<{ codItem: string; cantidad: number }>;
}) {
  return fetchApiJson<{ id: string; confirmaNombre: string }>("/api/stock/transferencias", {
    method: "POST",
    body,
  });
}

export function obtenerTransferenciaApi(id: string) {
  return fetchApiJson<StockTransferenciaDetalle>(
    `/api/stock/transferencias/${encodeURIComponent(id)}`
  );
}

export function aceptarTransferenciaApi(
  id: string,
  body: {
    personalId: number;
    items: Array<{ itemId: string; cantidadConfirmada: number }>;
  }
) {
  return fetchApiJson<{ comprobanteId: string; movimientos: number }>(
    `/api/stock/transferencias/${encodeURIComponent(id)}/aceptar`,
    { method: "POST", body }
  );
}

export function cerrarTransferenciaApi(
  id: string,
  accion: "rechazar" | "cancelar",
  body: { personalId: number; motivo?: string }
) {
  return fetchApiJson<void>(
    `/api/stock/transferencias/${encodeURIComponent(id)}/${accion}`,
    { method: "POST", body }
  );
}

export function listarNotificacionesApi(sucursalCodigo: SucursalTransf) {
  return fetchApiJson<NotificacionesSucursal>(
    `/api/notificaciones?sucursalCodigo=${encodeURIComponent(sucursalCodigo)}`
  );
}

export function marcarNotificacionLeidaApi(id: string, personalId: number) {
  return fetchApiJson<void>(`/api/notificaciones/${encodeURIComponent(id)}/leida`, {
    method: "POST",
    body: { personalId },
  });
}
