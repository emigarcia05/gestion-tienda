import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { prismaCuidSchema } from "@/lib/validations/common";
import { obtenerStockComprobanteDetalle } from "@/services/stockMovimientos.service";

/**
 * Detalle del justificante de stock (ajuste / transferencia / compra) como JSON HTTP.
 * Evita digests opacos de Server Actions en previews de producción.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;

    const { id } = await ctx.params;
    const parsedId = prismaCuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { ok: false as const, error: "ID de comprobante inválido." },
        { status: 400 }
      );
    }

    const res = await obtenerStockComprobanteDetalle(parsedId.data);
    if (!res.success) {
      return NextResponse.json({ ok: false as const, error: res.error });
    }
    return NextResponse.json({ ok: true as const, data: res.data });
  } catch (e) {
    const supportId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api][stock][comprobantes]", supportId, msg);
    return NextResponse.json(
      {
        ok: false as const,
        error: `No se pudo cargar el comprobante de stock (ref. ${supportId}).`,
        supportId,
      },
      { status: 500, headers: { "x-support-id": supportId } }
    );
  }
}
