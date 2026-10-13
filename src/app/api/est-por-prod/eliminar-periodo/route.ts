import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardEstPorProdImportarEsEditor } from "@/lib/apiRouteAuth";
import { eliminarEstPorProdPorPeriodoSchema } from "@/lib/validations/estPorProd";
import { eliminarEstPorProdPorPeriodo } from "@/services/estPorProd.service";

/**
 * POST: Borra todo el bloque periodo × sucursal en `est_por_prod`.
 * Body: `eliminarEstPorProdPorPeriodoSchema` (sucursalId, mes, anio).
 */
export async function POST(request: Request) {
  const denied = await guardEstPorProdImportarEsEditor();
  if (denied) return denied;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON inválido." }, { status: 400 });
  }

  const parsed = eliminarEstPorProdPorPeriodoSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Datos inválidos.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  try {
    const res = await eliminarEstPorProdPorPeriodo(
      parsed.data.sucursalId,
      parsed.data.mes,
      parsed.data.anio
    );
    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    revalidatePath("/administrador/estadisticas");
    revalidatePath("/administrador/estadisticas/carga-de-datos");
    revalidatePath("/administrador/estadisticas/configuracion");
    return NextResponse.json({ ok: true, data: res.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "No se pudo eliminar el periodo.";
    console.error("[api/est-por-prod/eliminar-periodo]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
