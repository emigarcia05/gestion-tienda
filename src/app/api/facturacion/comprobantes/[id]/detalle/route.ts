import { NextResponse } from "next/server";
import { guardFacturacionOStockLectura } from "@/lib/apiRouteAuth";
import { prismaCuidSchema } from "@/lib/validations/common";
import { obtenerFacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";

/**
 * Datos del comprobante para preview modal / PDF (JSON HTTP).
 * Alternativa al Flight de `obtenerFacturaComprobantePdfAction` en previews
 * donde Server Actions quedan colgadas o devuelven solo digest.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await guardFacturacionOStockLectura();
    if (denied) return denied;

    const { id } = await ctx.params;
    const parsedId = prismaCuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { ok: false as const, error: "ID de comprobante inválido." },
        { status: 400 }
      );
    }

    const res = await obtenerFacturaComprobantePdfDatos(parsedId.data);
    if (!res.success) {
      return NextResponse.json({ ok: false as const, error: res.error });
    }
    return NextResponse.json({ ok: true as const, data: res.data });
  } catch (e) {
    const supportId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api][facturacion][comprobantes][detalle]", supportId, msg);
    return NextResponse.json(
      {
        ok: false as const,
        error: `No se pudo leer el comprobante (ref. ${supportId}).`,
        supportId,
      },
      { status: 500, headers: { "x-support-id": supportId } }
    );
  }
}
