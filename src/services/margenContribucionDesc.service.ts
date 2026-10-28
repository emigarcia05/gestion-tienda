import { prisma } from "@/lib/prisma";
import type { GuardarDescuentoMargenContribucionInput } from "@/lib/validations/margenContribucionDesc";
import type { ServiceResult } from "@/types";

/** `cobros_cx_fin.id` → DESC. % guardado; sin clave = 0. */
export type DescuentosMargenContribucionMap = Record<string, number>;

export async function listarDescuentosMargenContribucion(): Promise<DescuentosMargenContribucionMap> {
  const rows = await prisma.margenContribucionDesc.findMany({
    select: { cxFinId: true, descuentoPct: true },
  });
  const map: DescuentosMargenContribucionMap = {};
  for (const row of rows) {
    map[row.cxFinId] = row.descuentoPct;
  }
  return map;
}

export async function guardarDescuentoMargenContribucion(
  input: GuardarDescuentoMargenContribucionInput
): Promise<ServiceResult<GuardarDescuentoMargenContribucionInput>> {
  try {
    const existeCombinacion = await prisma.finAnaCosFina.findUnique({
      where: { id: input.cxFinId },
      select: { id: true },
    });
    if (!existeCombinacion) {
      return { success: false, error: "La combinación de cobro ya no existe." };
    }

    const row = await prisma.margenContribucionDesc.upsert({
      where: { cxFinId: input.cxFinId },
      create: { cxFinId: input.cxFinId, descuentoPct: input.descuentoPct },
      update: { descuentoPct: input.descuentoPct },
      select: { cxFinId: true, descuentoPct: true },
    });
    return { success: true, data: row };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar el descuento.";
    return { success: false, error: msg };
  }
}
