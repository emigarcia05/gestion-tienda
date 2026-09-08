import { NextResponse } from "next/server";
import { guardFinanzasEditor } from "@/lib/apiRouteAuth";
import { syncFacturasVentasDuxBodySchema } from "@/lib/validations/finFactCobros";
import { syncFacturasVentasDuxRunStep } from "@/services/finFactCobros.service";

export const maxDuration = 300;

/**
 * POST: un paso de GET `/v2/remitos-venta` DUX (una página). Encadenar mientras `continuing`.
 */
export async function POST(req: Request) {
  const denied = await guardFinanzasEditor();
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const parsed = syncFacturasVentasDuxBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Periodo inválido." }, { status: 400 });
  }

  const result = await syncFacturasVentasDuxRunStep({
    mes: parsed.data.mes,
    anio: parsed.data.anio,
  });
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result.data });
}
