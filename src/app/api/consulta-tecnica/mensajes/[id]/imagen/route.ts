import { NextResponse } from "next/server";
import { guardConsultaTecnicaLectura } from "@/lib/apiRouteAuth";
import { prismaCuidSchema } from "@/lib/validations/common";
import { leerImagenConsultaTecnica } from "@/services/consultaTecnica.service";

/** Foto de un mensaje del hilo. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardConsultaTecnicaLectura();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = prismaCuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "La foto no existe." }, { status: 400 });
  }

  const out = await leerImagenConsultaTecnica(parsed.data);
  if (!out.success) {
    return NextResponse.json({ ok: false as const, error: out.error }, { status: 404 });
  }

  return new NextResponse(Buffer.from(out.data.bytes), {
    headers: {
      "Content-Type": out.data.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
