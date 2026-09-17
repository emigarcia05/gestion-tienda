import { NextResponse } from "next/server";
import { firstZodErrorMessage } from "@/lib/actionResult";
import { guardClientesMutacion } from "@/lib/apiRouteAuth";
import { consultarConstanciaArcaSchema } from "@/lib/validations/arcaConstancia";
import { consultarConstanciaArca } from "@/services/arcaConstancia.service";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET: Constancia de Inscripción por CUIT (`getPersona_v2`).
 * Query `cuit` (11 dígitos o máscara). No expone WSAA.
 */
export async function GET(request: Request) {
  const denied = await guardClientesMutacion();
  if (denied) return denied;

  const cuit = new URL(request.url).searchParams.get("cuit") ?? "";
  const parsed = consultarConstanciaArcaSchema.safeParse({ cuit });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: firstZodErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const result = await consultarConstanciaArca(parsed.data.cuit);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, data: result.data });
  } catch (e) {
    console.error("[arca][constancia]", e instanceof Error ? e.message : "error");
    return NextResponse.json(
      { ok: false, error: "No se pudo consultar la constancia en ARCA." },
      { status: 502 }
    );
  }
}
