import { NextResponse } from "next/server";
import { guardStockAcceso } from "@/lib/apiRouteAuth";
import { jsonErrorInterno } from "@/lib/apiRouteJson";
import { catalogoTransfDepositosQuerySchema } from "@/lib/validations/transfDepositos";
import { listarCatalogoTransfDepositos } from "@/services/transfDepositos.service";

/** Catálogo + saldos para el modal **Crear Transferencia**. */
export async function GET(req: Request) {
  try {
    const denied = await guardStockAcceso();
    if (denied) return denied;
    const url = new URL(req.url);
    const destinoRaw = url.searchParams.get("destino");
    const parsed = catalogoTransfDepositosQuerySchema.safeParse({
      origen: url.searchParams.get("origen"),
      destino: destinoRaw && destinoRaw.length > 0 ? destinoRaw : undefined,
      q: url.searchParams.get("q") ?? "",
      marca: url.searchParams.get("marca") ?? "",
      rubro: url.searchParams.get("rubro") ?? "",
      pagina: url.searchParams.get("pagina") ?? "1",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Filtros de catálogo inválidos." },
        { status: 400 }
      );
    }
    const { origen, destino, q, marca, rubro, pagina } = parsed.data;
    const data = await listarCatalogoTransfDepositos({
      origen,
      destino: destino && destino !== origen ? destino : null,
      q,
      marca,
      rubro,
      pagina,
    });
    return NextResponse.json({ ok: true as const, data });
  } catch (e) {
    return jsonErrorInterno(
      "[api][stock][transf-depositos]",
      e,
      "No se pudo cargar el catálogo"
    );
  }
}
