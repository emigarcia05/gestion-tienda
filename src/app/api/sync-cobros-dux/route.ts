import { NextResponse } from "next/server";
import { guardFinanzasEditor } from "@/lib/apiRouteAuth";
import { syncCobrosDuxBodySchema } from "@/lib/validations/finVtasCobros";
import { syncCobrosDuxRunStep } from "@/services/finVtasCobros.service";

export const maxDuration = 300;

/**
 * POST: un paso de GET `/v2/cobros` DUX (una página). Encadenar mientras `continuing`.
 */
export async function POST(req: Request) {
  const denied = await guardFinanzasEditor();
  if (denied) return denied;

  let raw: unknown = {};
  try {
    const text = await req.text();
    if (text.trim() !== "") raw = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const parsed = syncCobrosDuxBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const result = await syncCobrosDuxRunStep();
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result.data });
}
