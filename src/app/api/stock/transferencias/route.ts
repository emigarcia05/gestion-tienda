import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonDesdeServicio, jsonErrorInterno, parseJsonBody } from "@/lib/apiRouteJson";
import { crearStockTransferenciaSchema } from "@/lib/validations/stockTransferencias";
import { crearStockTransferencia } from "@/services/stockTransferencias.service";

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
