import { NextResponse } from "next/server";
import { guardFacturacionEditor } from "@/lib/apiRouteAuth";
import { healthArca } from "@/services/facturaComprobantes.service";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET: ping WSFEv1 `FEDummy` (sin exponer WSAA). Gate editor de facturación.
 */
export async function GET() {
  const denied = await guardFacturacionEditor();
  if (denied) return denied;

  const result = await healthArca();
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
