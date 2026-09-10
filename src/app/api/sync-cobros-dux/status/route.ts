import { NextResponse } from "next/server";
import { guardFinanzasLectura } from "@/lib/apiRouteAuth";
import { getSyncCobrosDuxStatusFromDb } from "@/lib/syncCobrosDuxStatusDb";

export async function GET() {
  const denied = await guardFinanzasLectura();
  if (denied) return denied;

  const progress = await getSyncCobrosDuxStatusFromDb();
  return NextResponse.json({
    running: progress.running,
    processed: progress.processed,
    total: progress.total,
    error: progress.error,
    lastCompletedAt: progress.lastCompletedAt?.toISOString() ?? null,
    fechaDesde: progress.meta?.fechaDesde ?? null,
    fechaHasta: progress.meta?.fechaHasta ?? null,
  });
}
