import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { sucursalPorDefectoSchema } from "@/lib/validations/globalPersonal";
import { listarStockMovimientosPorSucursalCodigo } from "@/services/stockMovimientos.service";

/**
 * Listado del ledger por sucursal como JSON HTTP.
 * Evita el mensaje opaco de Flight/Server Actions en previews de producción
 * ("An error occurred in the Server Components render… digest…").
 */
export async function GET(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;

    const url = new URL(req.url);
    const parsed = sucursalPorDefectoSchema.safeParse(
      url.searchParams.get("sucursalCodigo")
    );
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Sucursal inválida." },
        { status: 400 }
      );
    }

    const data = await listarStockMovimientosPorSucursalCodigo(parsed.data);
    return NextResponse.json({ ok: true as const, data });
  } catch (e) {
    const supportId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api][stock][movimientos]", supportId, msg);
    return NextResponse.json(
      {
        ok: false as const,
        error: `No se pudieron cargar los movimientos (ref. ${supportId}).`,
        supportId,
      },
      { status: 500, headers: { "x-support-id": supportId } }
    );
  }
}
