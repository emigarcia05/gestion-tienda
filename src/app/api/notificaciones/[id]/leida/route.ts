import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonDesdeServicio, jsonErrorInterno, parseJsonBody } from "@/lib/apiRouteJson";
import { prismaCuidSchema } from "@/lib/validations/common";
import { marcarNotificacionLeidaSchema } from "@/lib/validations/stockTransferencias";
import { marcarNotificacionLeida } from "@/services/notificaciones.service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const parsedId = prismaCuidSchema.safeParse((await ctx.params).id);
    if (!parsedId.success) {
      return NextResponse.json(
        { ok: false as const, error: "ID de notificación inválido." },
        { status: 400 }
      );
    }
    const parsed = await parseJsonBody(req, marcarNotificacionLeidaSchema);
    if ("response" in parsed) return parsed.response;
    return jsonDesdeServicio(
      await marcarNotificacionLeida(parsedId.data, parsed.data.personalId)
    );
  } catch (e) {
    return jsonErrorInterno("[api][notificaciones][leida]", e, "No se pudo marcar la notificación");
  }
}
