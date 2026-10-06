import type { StockTransferenciaEstado } from "@prisma/client";

/** N° de transferencia interna: `0001` (v1) o `0001-2` (rectificación). */
export function fmtNumeroTransferenciaInterna(numero: number, version: number): string {
  const base = String(numero).padStart(4, "0");
  return version <= 1 ? base : `${base}-${version}`;
}

/** Etiqueta de estado para historial / modal. */
export function etiquetaEstadoTransferencia(
  estado: StockTransferenciaEstado,
  version: number
): string {
  if (estado === "ACEPTADA") return "ACEPTADO";
  if (estado === "CANCELADA") return "ELIMINADA";
  if (estado === "RECHAZADA") return "RECHAZADA";
  if (estado === "RECTIFICADO_PENDIENTE" || version >= 2) {
    return "RECTIFICACION PENDIENTE DE ACEPTACION";
  }
  return "EMITIDO, PENDIENTE DE ACEPTACIÓN";
}

export function estaAbiertaTransferencia(
  estado: StockTransferenciaEstado
): estado is "EMITIDO_PENDIENTE" | "RECTIFICADO_PENDIENTE" {
  return estado === "EMITIDO_PENDIENTE" || estado === "RECTIFICADO_PENDIENTE";
}
