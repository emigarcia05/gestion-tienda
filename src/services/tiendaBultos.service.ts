import type { ServiceResult } from "@/types";
import { prisma } from "@/lib/prisma";

/** `null` o menor a 1 = vacío en UI. */
export function bultoProdTiendaValido(
  bulto: number | null | undefined
): number | null {
  if (bulto == null || bulto < 1) return null;
  return bulto;
}

/**
 * Mapa `cod_tienda` → bulto (solo ítems con valor ≥ 1). Ausente = vacío en UI.
 */
export async function buildMapBultosProdTienda(
  codTiendas: string[]
): Promise<Map<string, number>> {
  if (codTiendas.length === 0) return new Map();
  const rows = await prisma.prodPropio.findMany({
    where: {
      codTienda: { in: codTiendas },
      bulto: { gte: 1 },
    },
    select: { codTienda: true, bulto: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const n = bultoProdTiendaValido(r.bulto);
    if (n != null) map.set(r.codTienda, n);
  }
  return map;
}

/**
 * Persiste `prod_propios.bulto`. Entero ≥ 1; `null` deja la columna vacía.
 */
export async function guardarBultoProdTienda(
  codTienda: string,
  bulto: number | null
): Promise<ServiceResult<{ bulto: number | null }>> {
  if (bulto != null && (!Number.isInteger(bulto) || bulto < 1)) {
    return { success: false, error: "Bulto inválido." };
  }

  try {
    const updated = await prisma.prodPropio.updateMany({
      where: { codTienda },
      data: { bulto },
    });
    if (updated.count === 0) {
      return { success: false, error: "Ítem de tienda no encontrado." };
    }
    return { success: true, data: { bulto } };
  } catch (e) {
    console.error("[tiendaBultos][guardarBultoProdTienda]", e);
    return { success: false, error: "No se pudo guardar el bulto." };
  }
}
