import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { guardEnviosLectura } from "@/lib/apiRouteAuth";
import { SESION_CONDUCTOR_VISOR_COOKIE } from "@/lib/enviosConductorPublico";
import { prismaCuidSchema } from "@/lib/validations/common";
import { tokenEnviosConductorValido } from "@/services/enviosConductorPublico.service";
import { getEnviosFinalPdfComprobante } from "@/services/enviosFinal.service";

/** Visor público del Conductor: la cookie del link reemplaza la sesión. */
async function esVisorConductor(): Promise<boolean> {
  const token = (await cookies()).get(SESION_CONDUCTOR_VISOR_COOKIE)?.value;
  return !!token && tokenEnviosConductorValido(token);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await esVisorConductor())) {
      const denied = await guardEnviosLectura();
      if (denied) return denied;
    }

    const { id } = await ctx.params;
    const parsedId = prismaCuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ ok: false as const, error: "ID de envío inválido." }, { status: 400 });
    }

    const res = await getEnviosFinalPdfComprobante(parsedId.data);
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
  } catch (e) {
    console.error("[api][envios][comprobante]", e);
    return NextResponse.json(
      { ok: false as const, error: "No se pudo obtener el comprobante." },
      { status: 500 }
    );
  }
}
