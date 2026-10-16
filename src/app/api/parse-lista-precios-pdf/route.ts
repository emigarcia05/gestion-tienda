import { NextResponse } from "next/server";
import { guardListaPreciosImportarEsEditor } from "@/lib/apiRouteAuth";
import {
  MAX_PDF_LISTA_PRECIOS_BYTES,
  parseListaPreciosPdfMatrizQuerySchema,
} from "@/lib/validations/parseListaPreciosPdfMatriz";
import { parseListaPreciosPdfMatriz } from "@/services/parseListaPreciosPdfMatriz.service";

export const maxDuration = 120;

/**
 * POST multipart: file (PDF) + paginaInicio (opcional, default 9) + filasIgnorar (opcional, default 0).
 * Normaliza matriz a filas { descripcionExport, presentacion, precio } (sin escrituras). Después,
 * `previsualizarImportListaPdfAction` empareja con la lista del proveedor y
 * `aplicarImportListaPdfAction` actualiza `px_lista_proveedor`.
 */
export async function POST(request: Request) {
  const denied = await guardListaPreciosImportarEsEditor();
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulario inválido." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Falta el archivo PDF." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ ok: false, error: "El archivo debe ser PDF." }, { status: 400 });
  }

  if (file.size > MAX_PDF_LISTA_PRECIOS_BYTES) {
    return NextResponse.json(
      { ok: false, error: "El PDF supera el tamaño máximo permitido (15 MB)." },
      { status: 400 }
    );
  }

  const parsedQuery = parseListaPreciosPdfMatrizQuerySchema.safeParse({
    paginaInicio: formData.get("paginaInicio") ?? undefined,
    filasIgnorar: formData.get("filasIgnorar") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: "Parámetros inválidos (página ≥ 1, filas a ignorar ≥ 0)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await parseListaPreciosPdfMatriz(buffer, {
      paginaInicio: parsedQuery.data.paginaInicio,
      filasIgnorar: parsedQuery.data.filasIgnorar,
    });

    return NextResponse.json({
      ok: true,
      filas: result.filas,
      meta: result.meta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al procesar el PDF.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
