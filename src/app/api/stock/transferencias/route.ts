import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonDesdeServicio, jsonErrorInterno, parseJsonBody } from "@/lib/apiRouteJson";
import { sucursalPorDefectoSchema } from "@/lib/validations/globalPersonal";
import { crearStockTransferenciaSchema } from "@/lib/validations/stockTransferencias";
import {
  crearStockTransferencia,
  listarStockTransferenciasPorSucursal,
} from "@/services/stockTransferencias.service";

/** Historial de transferencias de la sucursal (origen o destino). */
export async function GET(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const parsed = sucursalPorDefectoSchema.safeParse(
      new URL(req.url).searchParams.get("sucursalCodigo")
    );
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Sucursal inválida." },
        { status: 400 }
      );
    }
    return jsonDesdeServicio(await listarStockTransferenciasPorSucursal(parsed.data));
  } catch (e) {
    return jsonErrorInterno(
      "[api][stock][transferencias]",
      e,
      "No se pudieron cargar las transferencias"
    );
  }
}

/** Crea una transferencia EMITIDO_PENDIENTE (sin ledger) y notifica a la otra sucursal. */
export async function POST(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const parsed = await parseJsonBody(req, crearStockTransferenciaSchema);
    if ("response" in parsed) return parsed.response;
    return jsonDesdeServicio(await crearStockTransferencia(parsed.data));
  } catch (e) {
    return jsonErrorInterno("[api][stock][transferencias]", e, "No se pudo crear la transferencia");
  }
}
