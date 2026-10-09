import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardEstPorProdImportarEsEditor } from "@/lib/apiRouteAuth";
import { importarEstPorProdSchema } from "@/lib/validations/estPorProd";
import { importarEstPorProd } from "@/services/estPorProd.service";

export const maxDuration = 300;

/**
 * POST: Importa estadísticas por producto (`est_por_prod`).
 * Body: `importarEstPorProdSchema` (mes, anio, sucursalId, lineas, reemplazarPeriodo?).
 * No usa el progreso de Lista de Precios (`/api/import-lista-precios/status`).
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

  const parsed = importarEstPorProdSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      [...Object.values(flat.fieldErrors).flat(), ...flat.formErrors][0] ??
      "Datos de importación inválidos.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  try {
    const res = await importarEstPorProd(parsed.data);
    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    revalidatePath("/administrador/estadisticas");
    revalidatePath("/administrador/estadisticas/carga-de-datos");
    revalidatePath("/administrador/estadisticas/configuracion");
    return NextResponse.json({ ok: true, data: res.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "No se pudo importar la planilla.";
    console.error("[api/import-est-por-prod]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
