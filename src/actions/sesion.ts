"use server";

import { getSesion } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const activarModoEditorSchema = z.object({
  clave: z.string().min(1).max(500),
});

export async function activarModoEditor(clave: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = activarModoEditorSchema.safeParse({ clave });
  if (!parsed.success) {
    return { ok: false, error: "Clave inválida." };
  }
  const claveNorm = parsed.data.clave;
  const claveCorrecta = process.env.ADMINISTRADOR_PASSWORD;

  if (!claveCorrecta) {
    return { ok: false, error: "No hay clave de editor configurada en el servidor." };
  }

  if (claveNorm !== claveCorrecta) {
    return { ok: false, error: "Clave incorrecta." };
  }

  const sesion = await getSesion();
  sesion.rol = "editor";
  await sesion.save();

  revalidatePath("/", "layout");
  return { ok: true };
}
