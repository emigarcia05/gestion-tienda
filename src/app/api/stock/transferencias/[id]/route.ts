import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonDesdeServicio, jsonErrorInterno } from "@/lib/apiRouteJson";
import { prismaCuidSchema } from "@/lib/validations/common";
import { obtenerStockTransferenciaDetalle } from "@/services/stockTransferencias.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const parsedId = prismaCuidSchema.safeParse((await ctx.params).id);
    if (!parsedId.success) {
      return NextResponse.json(
        { ok: false as const, error: "ID de transferencia inválido." },
        { status: 400 }
      );
    }
    return jsonDesdeServicio(await obtenerStockTransferenciaDetalle(parsedId.data));
  } catch (e) {
    return jsonErrorInterno("[api][stock][transferencias][id]", e, "No se pudo cargar la transferencia");
  }
}
