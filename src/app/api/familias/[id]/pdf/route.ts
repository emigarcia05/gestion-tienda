import { NextResponse } from "next/server";
import { guardTiendaLectura } from "@/lib/apiRouteAuth";
import { prismaCuidSchema } from "@/lib/validations/common";
import { obtenerPdfFamilia } from "@/services/prodProducto.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await guardTiendaLectura();
    if (denied) return denied;

    const { id } = await ctx.params;
    const parsedId = prismaCuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ ok: false as const, error: "ID de familia inválido." }, { status: 400 });
    }

    const res = await obtenerPdfFamilia(parsedId.data);
    if (!res.success) {
      return NextResponse.json({ ok: false as const, error: res.error }, { status: 404 });
    }

    const filename = res.data.nombre.replace(/[\r\n"]/g, "_");
    return new NextResponse(new Uint8Array(res.data.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    console.error("[api][familias][pdf]", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { ok: false as const, error: "No se pudo obtener el PDF." },
      { status: 500 }
    );
  }
}
