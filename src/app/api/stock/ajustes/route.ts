import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { firstZodErrorMessage } from "@/lib/actionResult";
import { confirmarAjusteControlStockSchema } from "@/lib/validations/stockMovimientos";
import { confirmarAjusteControlStock } from "@/services/stockMovimientos.service";

/**
 * Confirmar Ajuste de Control Stock → `stock_comprobantes` AJUSTE_STOCK +
 * líneas `stock_movimientos` (VARIACIÓN ≠ 0).
 * JSON HTTP para evitar digests opacos de Server Actions en previews.
 */
export async function POST(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    const parsed = confirmarAjusteControlStockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: firstZodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }

    const res = await confirmarAjusteControlStock(parsed.data);
    if (!res.success) {
      return NextResponse.json({ ok: false as const, error: res.error });
    }
    return NextResponse.json({ ok: true as const, data: res.data });
  } catch (e) {
    const supportId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api][stock][ajustes]", supportId, msg);
    return NextResponse.json(
      {
        ok: false as const,
        error: `No se pudo confirmar el ajuste (ref. ${supportId}).`,
        supportId,
      },
      { status: 500, headers: { "x-support-id": supportId } }
    );
  }
}
