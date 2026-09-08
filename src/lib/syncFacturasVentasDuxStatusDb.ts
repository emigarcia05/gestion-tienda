import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const SYNC_FACTURAS_VENTAS_DUX_STATUS_ID = "facturas-ventas-dux";

export type SyncFacturasVentasDuxMeta = {
  mes: number;
  anio: number;
  sucursales: number[];
  sucursalIndex: number;
  offset: number;
  acumulado: Record<string, string>;
  idsVistos: number[];
  scanned: number;
};

export interface SyncFacturasVentasDuxStatusState {
  running: boolean;
  processed: number;
  total: number;
  error: string | null;
  lastCompletedAt: Date | null;
  meta: SyncFacturasVentasDuxMeta | null;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

export function parseSyncFacturasVentasDuxMeta(
  raw: Prisma.JsonValue | null | undefined
): SyncFacturasVentasDuxMeta | null {
  if (!isRecord(raw)) return null;
  const mes = Number(raw.mes);
  const anio = Number(raw.anio);
  if (!Number.isFinite(mes) || !Number.isFinite(anio)) return null;
  const sucursales = Array.isArray(raw.sucursales)
    ? raw.sucursales.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const sucursalIndex = Number(raw.sucursalIndex);
  const offset = Number(raw.offset);
  const scanned = Number(raw.scanned);
  const acumulado: Record<string, string> = {};
  if (isRecord(raw.acumulado)) {
    for (const [k, v] of Object.entries(raw.acumulado)) {
      if (typeof v === "string" || typeof v === "number") acumulado[k] = String(v);
    }
  }
  const idsVistos = Array.isArray(raw.idsVistos)
    ? raw.idsVistos.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  return {
    mes,
    anio,
    sucursales,
    sucursalIndex: Number.isFinite(sucursalIndex) ? sucursalIndex : 0,
    offset: Number.isFinite(offset) ? offset : 0,
    acumulado,
    idsVistos,
    scanned: Number.isFinite(scanned) ? scanned : 0,
  };
}

export async function getSyncFacturasVentasDuxStatusFromDb(): Promise<SyncFacturasVentasDuxStatusState> {
  const row = await prisma.syncDuxStatus.findUnique({
    where: { id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID },
    select: {
      running: true,
      processed: true,
      total: true,
      error: true,
      lastCompletedAt: true,
      meta: true,
    },
  });
  if (!row) {
    return {
      running: false,
      processed: 0,
      total: 0,
      error: null,
      lastCompletedAt: null,
      meta: null,
    };
  }
  return {
    running: row.running,
    processed: row.processed,
    total: row.total,
    error: row.error,
    lastCompletedAt: row.lastCompletedAt,
    meta: parseSyncFacturasVentasDuxMeta(row.meta),
  };
}

export async function startSyncFacturasVentasDuxInDb(
  total: number,
  meta: SyncFacturasVentasDuxMeta
): Promise<void> {
  const totalNorm = Math.max(0, Math.floor(total));
  await prisma.syncDuxStatus.upsert({
    where: { id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID },
    create: {
      id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID,
      running: true,
      phase: "sincronizando",
      processed: 0,
      total: totalNorm,
      error: null,
      lastCompletedAt: null,
      fetchOffset: 0,
      apiFetchComplete: false,
      meta: meta as unknown as Prisma.InputJsonValue,
    },
    update: {
      running: true,
      phase: "sincronizando",
      processed: 0,
      total: totalNorm,
      error: null,
      fetchOffset: 0,
      apiFetchComplete: false,
      meta: meta as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function setSyncFacturasVentasDuxProgressInDb(params: {
  processed: number;
  total: number;
  meta: SyncFacturasVentasDuxMeta;
}): Promise<void> {
  await prisma.syncDuxStatus.update({
    where: { id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID },
    data: {
      processed: Math.max(0, Math.floor(params.processed)),
      total: Math.max(0, Math.floor(params.total)),
      fetchOffset: params.meta.offset,
      meta: params.meta as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function setSyncFacturasVentasDuxSuccessInDb(
  processed: number,
  total: number
): Promise<void> {
  await prisma.syncDuxStatus.update({
    where: { id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID },
    data: {
      running: false,
      phase: null,
      processed: Math.max(0, Math.floor(processed)),
      total: Math.max(0, Math.floor(total)),
      error: null,
      apiFetchComplete: true,
      lastCompletedAt: new Date(),
    },
  });
}

export async function setSyncFacturasVentasDuxErrorInDb(message: string): Promise<void> {
  await prisma.syncDuxStatus.upsert({
    where: { id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID },
    create: {
      id: SYNC_FACTURAS_VENTAS_DUX_STATUS_ID,
      running: false,
      phase: null,
      processed: 0,
      total: 0,
      error: message,
      lastCompletedAt: null,
    },
    update: {
      running: false,
      phase: null,
      error: message,
    },
  });
}
