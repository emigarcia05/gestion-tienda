import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonDesdeServicio, jsonErrorInterno, parseJsonBody } from "@/lib/apiRouteJson";
import { prismaCuidSchema } from "@/lib/validations/common";
import {
  aceptarStockTransferenciaSchema,
  resolverStockTransferenciaSchema,
} from "@/lib/validations/stockTransferencias";
import {
  aceptarStockTransferencia,
  cancelarStockTransferencia,
  rechazarStockTransferencia,
} from "@/services/stockTransferencias.service";

/**
 * `aceptar` (ACEPTADA + ledger, o RECTIFICADO_PENDIENTE sin ledger) · `rechazar` · `cancelar`.
 * Quién puede cada acción lo valida el servicio con la sucursal del `personalId`.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; accion: string }> }
) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const { id, accion } = await ctx.params;
    const parsedId = prismaCuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { ok: false as const, error: "ID de transferencia inválido." },
        { status: 400 }
      );
    }

    if (accion === "aceptar") {
      const parsed = await parseJsonBody(req, aceptarStockTransferenciaSchema);
      if ("response" in parsed) return parsed.response;
      return jsonDesdeServicio(await aceptarStockTransferencia(parsedId.data, parsed.data));
    }
    if (accion === "rechazar" || accion === "cancelar") {
      const parsed = await parseJsonBody(req, resolverStockTransferenciaSchema);
      if ("response" in parsed) return parsed.response;
      const res =
        accion === "rechazar"
          ? await rechazarStockTransferencia(parsedId.data, parsed.data)
          : await cancelarStockTransferencia(parsedId.data, parsed.data);
      return jsonDesdeServicio(res);
    }
    return NextResponse.json(
      { ok: false as const, error: "Acción inválida." },
      { status: 404 }
    );
  } catch (e) {
    return jsonErrorInterno(
      "[api][stock][transferencias][accion]",
      e,
      "No se pudo actualizar la transferencia"
    );
  }
}
