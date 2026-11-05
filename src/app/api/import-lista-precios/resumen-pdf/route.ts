import { NextResponse } from "next/server";
import { z } from "zod";
import { guardListaPreciosImportarEsEditor } from "@/lib/apiRouteAuth";
import { generarPdfResumenAumentosImport } from "@/lib/generarPdfResumenAumentosImport";
import { getResumenAumentosImportFromDb } from "@/lib/importProgressDb";

const resumenSchema = z.object({
  proveedor: z.string(),
  items: z.array(
    z.object({
      marca: z.string(),
      rubro: z.string(),
      descripcion: z.string(),
      aumentoPct: z.number(),
    })
  ),
});

/**
 * PDF de aumentos de la última importación de lista que terminó en esta base.
 */
export async function GET() {
  const denied = await guardListaPreciosImportarEsEditor();
  if (denied) return denied;

  const crudo = await getResumenAumentosImportFromDb();
  const parsed = resumenSchema.safeParse(crudo);
  if (!parsed.success || parsed.data.items.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const pdf = generarPdfResumenAumentosImport(parsed.data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resumen-aumentos-lista.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
