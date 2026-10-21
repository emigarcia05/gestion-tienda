import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonErrorInterno } from "@/lib/apiRouteJson";
import { saldosTransfDepositosQuerySchema } from "@/lib/validations/transfDepositos";
import { listarSaldosTransfDepositosPorCodigos } from "@/services/transfDepositos.service";

/** Ficha + saldos de códigos puntuales (`?cod=…&cod=…`) para el modal de transferencia. */
export async function GET(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const url = new URL(req.url);
    const destinoRaw = url.searchParams.get("destino");
    const parsed = saldosTransfDepositosQuerySchema.safeParse({
      origen: url.searchParams.get("origen"),
      destino: destinoRaw && destinoRaw.length > 0 ? destinoRaw : undefined,
      cods: url.searchParams.getAll("cod"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Consulta de saldos inválida." },
        { status: 400 }
      );
    }
    const { origen, destino, cods } = parsed.data;
    const data = await listarSaldosTransfDepositosPorCodigos({
      origen,
      destino: destino && destino !== origen ? destino : null,
      codItems: cods,
    });
    return NextResponse.json({ ok: true as const, data });
  } catch (e) {
    return jsonErrorInterno(
      "[api][stock][transf-depositos][saldos]",
      e,
      "No se pudieron cargar los saldos"
    );
  }
}
