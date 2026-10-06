import { fetchApiJson } from "@/lib/apiFetchJson";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import type { NotificacionesSucursal } from "@/services/notificaciones.service";
import type { TransfDepositosData } from "@/lib/transfDepositosTypes";
import type {
  AceptarStockTransferenciaResult,
  StockTransferenciaDetalle,
  StockTransferenciaHistorialFila,
} from "@/services/stockTransferencias.service";

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
  return fetchApiJson<{ id: string; confirmaNombre: string; numero: string }>(
    "/api/stock/transferencias",
    { method: "POST", body }
  );
}

export function listarTransferenciasApi(sucursalCodigo: SucursalTransf) {
  return fetchApiJson<StockTransferenciaHistorialFila[]>(
    `/api/stock/transferencias?sucursalCodigo=${encodeURIComponent(sucursalCodigo)}`
  );
}

export function actualizarTransferenciaApi(
  id: string,
  body: {
    origenCodigo: SucursalTransf;
    destinoCodigo: SucursalTransf;
    personalId: number;
    items: Array<{ codItem: string; cantidad: number }>;
  }
) {
  return fetchApiJson<{ id: string; numero: string }>(
    `/api/stock/transferencias/${encodeURIComponent(id)}`,
    { method: "PUT", body }
  );
}

export function listarCatalogoTransfDepositosApi(params: {
  origen: SucursalTransf;
  destino?: SucursalTransf | null;
  q?: string;
  marca?: string;
  rubro?: string;
  pagina?: number;
}) {
  const q = new URLSearchParams();
  q.set("origen", params.origen);
  if (params.destino) q.set("destino", params.destino);
  if (params.q) q.set("q", params.q);
  if (params.marca) q.set("marca", params.marca);
  if (params.rubro) q.set("rubro", params.rubro);
  q.set("pagina", String(params.pagina ?? 1));
  return fetchApiJson<TransfDepositosData>(`/api/stock/transf-depositos?${q.toString()}`);
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
    items: Array<{ itemId?: string; codItem: string; cantidadConfirmada: number }>;
    comentario?: string;
  }
) {
  return fetchApiJson<AceptarStockTransferenciaResult>(
    `/api/stock/transferencias/${encodeURIComponent(id)}/aceptar`,
    { method: "POST", body }
  );
}

export function eliminarTransferenciaApi(
  id: string,
  body: { personalId: number; motivo?: string }
) {
  return fetchApiJson<void>(
    `/api/stock/transferencias/${encodeURIComponent(id)}/cancelar`,
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
