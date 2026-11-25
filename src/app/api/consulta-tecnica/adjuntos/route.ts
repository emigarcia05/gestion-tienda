import { NextResponse } from "next/server";
import { guardConsultaTecnicaLectura } from "@/lib/apiRouteAuth";
import { CONSULTA_TECNICA_IMAGEN_MAX_BYTES } from "@/lib/consultaTecnica";
import { prismaCuidSchema } from "@/lib/validations/common";
import { adjuntarFotoConsultaTecnica } from "@/services/consultaTecnica.service";

export const maxDuration = 30;

/** Foto del hilo abierto. El archivo no entra por una Server Action. */
export async function POST(req: Request) {
  const denied = await guardConsultaTecnicaLectura();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false as const, error: "No se pudo leer la foto." }, { status: 400 });
  }

  const conversacionId = prismaCuidSchema.safeParse(form.get("conversacionId"));
  const archivo = form.get("archivo");
  if (!conversacionId.success || !(archivo instanceof File)) {
    return NextResponse.json({ ok: false as const, error: "Elegí una foto." }, { status: 400 });
  }
  if (archivo.size > CONSULTA_TECNICA_IMAGEN_MAX_BYTES) {
    return NextResponse.json(
      { ok: false as const, error: "La foto tiene que ser JPG, PNG o WEBP de hasta 4 MB." },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const out = await adjuntarFotoConsultaTecnica({
    conversacionId: conversacionId.data,
    mime: archivo.type,
    bytes,
  });
  if (!out.success) {
    return NextResponse.json({ ok: false as const, error: out.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true as const, data: out.data });
}
