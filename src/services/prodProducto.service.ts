import { normalizarCodFliaItem, textoCodFliaItem } from "@/lib/prodProducto";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

/** Siguiente familia: el mayor `cod_familia` numérico + 1, con tres dígitos. */
export async function siguienteCodFliaItem(): Promise<ServiceResult<{ codigo: string }>> {
  try {
    const filas = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT COALESCE(MAX(CAST(cod_familia AS INTEGER)), 0) AS max
      FROM prod_lista
      WHERE cod_familia ~ '^[0-9]+$'
    `;
    const max = Number(filas[0]?.max ?? 0);
    const siguiente = Number.isFinite(max) && max >= 0 ? max + 1 : 1;
    return { success: true, data: { codigo: textoCodFliaItem(siguiente) } };
  } catch (error: unknown) {
    console.error("[prodProducto] siguiente flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo calcular el código de familia." };
  }
}

/** Descripciones de los ítems que ya tienen ese `cod_familia`. */
export async function listarDescripcionesFliaItem(
  codigo: string
): Promise<ServiceResult<{ descripciones: string[] }>> {
  const normal = normalizarCodFliaItem(codigo);
  if (!normal.ok || normal.codigo == null) return { success: true, data: { descripciones: [] } };
  try {
    const filas = await prisma.prodPropio.findMany({
      where: { codFamilia: normal.codigo },
      select: { descripcionTienda: true },
      orderBy: { descripcionTienda: "asc" },
      take: 50,
    });
    return {
      success: true,
      data: {
        descripciones: filas
          .map((fila) => (fila.descripcionTienda ?? "").trim())
          .filter((descripcion) => descripcion.length > 0),
      },
    };
  } catch (error: unknown) {
    console.error("[prodProducto] flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudieron leer los ítems de la familia." };
  }
}
