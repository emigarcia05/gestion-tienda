import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonDesdeServicio, jsonErrorInterno } from "@/lib/apiRouteJson";
import { notificacionesSucursalSchema } from "@/lib/validations/stockTransferencias";
import { listarNotificacionesSucursal } from "@/services/notificaciones.service";

/** Notificaciones de la sucursal del usuario de pestaña (`?sucursalCodigo=`). */
export async function GET(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const url = new URL(req.url);
    const parsed = notificacionesSucursalSchema.safeParse({
      sucursalCodigo: url.searchParams.get("sucursalCodigo"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Sucursal inválida." },
        { status: 400 }
      );
    }
    return jsonDesdeServicio(await listarNotificacionesSucursal(parsed.data.sucursalCodigo));
  } catch (e) {
    return jsonErrorInterno("[api][notificaciones]", e, "No se pudieron cargar las notificaciones");
  }
}
