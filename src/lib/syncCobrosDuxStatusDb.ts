import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const SYNC_COBROS_DUX_STATUS_ID = "cobros-dux";

export type SyncCobrosDuxMeta = {
  fechaDesde: string;
  fechaHasta: string;
  sucursales: number[];
  sucursalIndex: number;
  offset: number;
  inserted: number;
};

export interface SyncCobrosDuxStatusState {
  running: boolean;
  processed: number;
  total: number;
  error: string | null;
  lastCompletedAt: Date | null;
  meta: SyncCobrosDuxMeta | null;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

export function parseSyncCobrosDuxMeta(
  raw: Prisma.JsonValue | null | undefined
): SyncCobrosDuxMeta | null {
  if (!isRecord(raw)) return null;
  const fechaDesde = String(raw.fechaDesde ?? "").trim();
  const fechaHasta = String(raw.fechaHasta ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    return null;
  }
  const sucursales = Array.isArray(raw.sucursales)
    ? raw.sucursales.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const sucursalIndex = Number(raw.sucursalIndex);
  const offset = Number(raw.offset);
  const inserted = Number(raw.inserted);
  return {
    fechaDesde,
    fechaHasta,
    sucursales,
    sucursalIndex: Number.isFinite(sucursalIndex) ? sucursalIndex : 0,
    offset: Number.isFinite(offset) ? offset : 0,
    inserted: Number.isFinite(inserted) ? inserted : 0,
  };
}

export async function getSyncCobrosDuxStatusFromDb(): Promise<SyncCobrosDuxStatusState> {
  const row = await prisma.syncDuxStatus.findUnique({
    where: { id: SYNC_COBROS_DUX_STATUS_ID },
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
    meta: parseSyncCobrosDuxMeta(row.meta),
  };
}

export async function startSyncCobrosDuxInDb(
  total: number,
  meta: SyncCobrosDuxMeta
): Promise<void> {
  const totalNorm = Math.max(0, Math.floor(total));
  await prisma.syncDuxStatus.upsert({
    where: { id: SYNC_COBROS_DUX_STATUS_ID },
    create: {
      id: SYNC_COBROS_DUX_STATUS_ID,
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

export async function setSyncCobrosDuxProgressInDb(params: {
  processed: number;
  total: number;
  meta: SyncCobrosDuxMeta;
}): Promise<void> {
  await prisma.syncDuxStatus.update({
    where: { id: SYNC_COBROS_DUX_STATUS_ID },
    data: {
      processed: Math.max(0, Math.floor(params.processed)),
      total: Math.max(0, Math.floor(params.total)),
      fetchOffset: params.meta.offset,
      meta: params.meta as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function setSyncCobrosDuxSuccessInDb(
  processed: number,
  total: number
): Promise<void> {
  await prisma.syncDuxStatus.update({
    where: { id: SYNC_COBROS_DUX_STATUS_ID },
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

export async function setSyncCobrosDuxErrorInDb(message: string): Promise<void> {
  await prisma.syncDuxStatus.upsert({
    where: { id: SYNC_COBROS_DUX_STATUS_ID },
    create: {
      id: SYNC_COBROS_DUX_STATUS_ID,
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
