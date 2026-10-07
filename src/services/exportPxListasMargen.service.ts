import { calcMargenSinIvaPct } from "@/lib/calculos";
import { roundPorcUtilidadPxListaExport } from "@/lib/pxListasPreciosFormat";
import { sincronizarTodosPxGeneralDesdeCompetenciaRef } from "@/services/pxListasCompetenciaRef.service";
import { type ClavePrecioListaEdicion } from "@/services/pxListasPrecioEdicion.service";
import { prisma } from "@/lib/prisma";

export type FilaExportPxListaMargen = {
  codigo: string;
  /** Margen % numérico (4 decimales); formato visual en Excel vía `PORC_UTILIDAD_PX_LISTA_EXCEL_NUMFMT`. */
  porcUtilidad: number;
};

export type ExportPxListaMargenGrupo = {
  idLista: number;
  nombreLista: string;
  filas: FilaExportPxListaMargen[];
};

function toNum(n: unknown): number {
  if (n == null) return 0;
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Claves exportadas (para limpiar staging tras Act. Px). */
export function clavesDesdeGruposExportPxListas(
  grupos: ExportPxListaMargenGrupo[]
): ClavePrecioListaEdicion[] {
  const claves: ClavePrecioListaEdicion[] = [];
  for (const grupo of grupos) {
    for (const fila of grupo.filas) {
      claves.push({ codTienda: fila.codigo, idLista: grupo.idLista });
    }
  }
  return claves;
}

/**
 * Por cada `nombre_lista`: ítems con PX en `prod_propios_listas_precios_edicion` (pendientes de Act. Px).
 */
export async function listarExportPxListasMargenPorLista(): Promise<
  ExportPxListaMargenGrupo[]
> {
  /** Re-aplica PX de competencia en GENERAL (PORC. UTILIDAD = f(PX, costo)). */
  await sincronizarTodosPxGeneralDesdeCompetenciaRef();

  const listas = await prisma.prodPropioListaPrecioNombre.findMany({
    orderBy: [{ idLista: "asc" }],
    select: { idLista: true, nombreLista: true },
  });

  if (listas.length === 0) return [];

  const idListas = listas.map((l) => l.idLista);

  const [edicionRows, productos] = await Promise.all([
    prisma.prodPropioListaPrecioEdicion.findMany({
      where: { idLista: { in: idListas } },
      select: { codTienda: true, idLista: true, precio: true },
      orderBy: [{ codTienda: "asc" }],
    }),
    prisma.prodPropio.findMany({
      select: { codTienda: true, costoCompra: true },
    }),
  ]);

  const costoMap = new Map<string, number>();
  for (const p of productos) {
    costoMap.set(p.codTienda, toNum(p.costoCompra));
  }

  const filasPorLista = new Map<number, FilaExportPxListaMargen[]>();
  for (const lista of listas) {
    filasPorLista.set(lista.idLista, []);
  }

  for (const row of edicionRows) {
    const costoCompra = costoMap.get(row.codTienda) ?? 0;
    if (!(costoCompra > 0)) continue;

    const pxEdicion = toNum(row.precio);
    if (!(pxEdicion > 0)) continue;

    const margen = calcMargenSinIvaPct(pxEdicion, costoCompra);
    if (margen == null) continue;

    filasPorLista.get(row.idLista)?.push({
      codigo: row.codTienda,
      porcUtilidad: roundPorcUtilidadPxListaExport(margen),
    });
  }

  return listas.map((lista) => ({
    idLista: lista.idLista,
    nombreLista: lista.nombreLista,
    filas: filasPorLista.get(lista.idLista) ?? [],
  }));
}
