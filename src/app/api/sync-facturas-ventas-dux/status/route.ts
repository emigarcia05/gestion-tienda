import { NextResponse } from "next/server";
import { guardFinanzasLectura } from "@/lib/apiRouteAuth";
import { getSyncFacturasVentasDuxStatusFromDb } from "@/lib/syncFacturasVentasDuxStatusDb";

export async function GET() {
  const denied = await guardFinanzasLectura();
  if (denied) return denied;

  const progress = await getSyncFacturasVentasDuxStatusFromDb();
  return NextResponse.json({
    running: progress.running,
    processed: progress.processed,
    total: progress.total,
    error: progress.error,
    lastCompletedAt: progress.lastCompletedAt?.toISOString() ?? null,
    mes: progress.meta?.mes ?? null,
    anio: progress.meta?.anio ?? null,
  });
}
