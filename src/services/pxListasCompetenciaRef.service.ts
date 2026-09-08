import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import {
  PX_LISTAS_COMP_REF_NINGUNO,
  etiquetaAbrevCompetenciaPxListas,
  type OpcionCompetenciaRefPxListas,
  type OpcionFiltroPxVinculado,
} from "@/lib/pxListasCompetenciaRef";
import { preciosPxListaEnterosIguales, roundPxListaEntero } from "@/lib/pxListasPreciosFormat";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types/service.types";
import {
  listarCompetenciasConPxSugeridoPorCodTiendas,
  obtenerPxVtaSugeridoPorCompetenciaId,
} from "@/services/competenciaPxSugerido.service";
import { guardarPrecioListaEdicionDesdePx } from "@/services/pxListasPrecioEdicion.service";

type CompetenciaEtiquetaRow = {
  id: string;
  nombre: string;
  etiqueta: string;
};

async function cargarMapCompetenciasConEtiqueta(
  ids?: string[]
): Promise<Map<string, CompetenciaEtiquetaRow>> {
  const rows = await prisma.prodCompetencia.findMany({
    where: ids && ids.length > 0 ? { id: { in: ids } } : undefined,
    select: {
      id: true,
      nombre: true,
      proveedor: { select: { prefijo: true } },
    },
    orderBy: { nombre: "asc" },
  });
  return new Map(
    rows.map((c) => [
      c.id,
      {
        id: c.id,
        nombre: c.nombre,
        etiqueta: etiquetaAbrevCompetenciaPxListas(
          c.proveedor?.prefijo,
          c.nombre
        ),
      },
    ])
  );
}

/** Catálogo para el filtro **PX VINCULADO** (prefijo / abrev. 3 letras). */
export async function listarOpcionesFiltroPxVinculado(): Promise<
  OpcionFiltroPxVinculado[]
> {
  const map = await cargarMapCompetenciasConEtiqueta();
  return [...map.values()]
    .map((c) => ({
      competenciaId: c.id,
      etiqueta: c.etiqueta,
      nombre: c.nombre,
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export type ResultadoGuardarCompRefPxListas = {
  competenciaIdPxListaGeneral: string | null;
  /** `true` si se actualizó el PX de GENERAL (solo al elegir competidor). */
  pxActualizado: boolean;
  pxEdicion: number | null;
  pxEfectivo: number | null;
  margenManual: number | null;
};

async function resolverIdListaGeneral(): Promise<number | null> {
  const listas = await prisma.prodTiendaListaPrecio.findMany({
    select: { idLista: true, nombreLista: true },
    orderBy: [{ idLista: "asc" }],
  });
  return encontrarIdListaGeneralPxListas(listas);
}

/**
 * Precio de referencia para un producto × competidor (prioridad sugerido → scraping).
 */
export async function resolverPxReferenciaCompetenciaPxListas(
  codTienda: string,
  competenciaId: string
): Promise<number | null> {
  const sugerido = await obtenerPxVtaSugeridoPorCompetenciaId(codTienda, competenciaId);
  if (sugerido != null && sugerido > 0) return roundPxListaEntero(sugerido);

  const row = await prisma.prodPrecioCompetencia.findUnique({
    where: {
      codTienda_competenciaId: { codTienda, competenciaId },
    },
    select: { pxCompetencia: true },
  });
  if (row?.pxCompetencia == null) return null;
  const n = Number(row.pxCompetencia);
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundPxListaEntero(n);
}

/**
 * Opciones de competidor con precio de referencia por `cod_tienda`
 * (sugerido del proveedor vinculado o scraping).
 */
export async function listarOpcionesCompetenciaRefPorCodTiendas(
  codTiendas: string[],
  extraCompetenciaIds: string[] = []
): Promise<Map<string, OpcionCompetenciaRefPxListas[]>> {
  const map = new Map<string, OpcionCompetenciaRefPxListas[]>();
  if (codTiendas.length === 0) return map;

  for (const cod of codTiendas) map.set(cod, []);

  const [sugeridos, scrapRows] = await Promise.all([
    listarCompetenciasConPxSugeridoPorCodTiendas(codTiendas),
    prisma.prodPrecioCompetencia.findMany({
      where: {
        codTienda: { in: codTiendas },
        pxCompetencia: { not: null, gt: 0 },
      },
      select: {
        codTienda: true,
        competenciaId: true,
        pxCompetencia: true,
      },
    }),
  ]);

  const idsCompetencia = [
    ...new Set([
      ...sugeridos.map((s) => s.competenciaId),
      ...scrapRows.map((r) => r.competenciaId),
      ...extraCompetenciaIds,
    ]),
  ];
  const competenciasMap =
    idsCompetencia.length > 0
      ? await cargarMapCompetenciasConEtiqueta(idsCompetencia)
      : new Map<string, CompetenciaEtiquetaRow>();

  const seen = new Set<string>();

  for (const s of sugeridos) {
    const key = `${s.codTienda}:${s.competenciaId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = map.get(s.codTienda);
    if (!list) continue;
    const meta = competenciasMap.get(s.competenciaId);
    list.push({
      competenciaId: s.competenciaId,
      nombre: meta?.nombre ?? s.competenciaNombre,
      etiqueta:
        meta?.etiqueta ??
        etiquetaAbrevCompetenciaPxListas(null, s.competenciaNombre),
      px: s.px,
    });
  }

  for (const row of scrapRows) {
    const key = `${row.codTienda}:${row.competenciaId}`;
    if (seen.has(key)) continue;
    const px = Number(row.pxCompetencia);
    if (!Number.isFinite(px) || px <= 0) continue;
    const meta = competenciasMap.get(row.competenciaId);
    if (!meta) continue;
    seen.add(key);
    const list = map.get(row.codTienda);
    if (!list) continue;
    list.push({
      competenciaId: row.competenciaId,
      nombre: meta.nombre,
      etiqueta: meta.etiqueta,
      px: roundPxListaEntero(px),
    });
  }

  for (const [cod, list] of map) {
    list.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
    map.set(cod, list);
  }

  return map;
}

/**
 * Asegura que el competidor ya persistido aparezca en opciones
 * (aunque ya no tenga precio de referencia).
 */
export async function asegurarOpcionCompetenciaRefSeleccionada(
  opcionesPorCod: Map<string, OpcionCompetenciaRefPxListas[]>,
  rows: Array<{
    codTienda: string;
    competenciaIdPxListaGeneral: string | null;
  }>
): Promise<void> {
  const faltantes: Array<{ codTienda: string; competenciaId: string }> = [];
  for (const row of rows) {
    const id = row.competenciaIdPxListaGeneral;
    if (!id) continue;
    const list = opcionesPorCod.get(row.codTienda) ?? [];
    if (list.some((o) => o.competenciaId === id)) continue;
    faltantes.push({ codTienda: row.codTienda, competenciaId: id });
  }
  if (faltantes.length === 0) return;

  const ids = [...new Set(faltantes.map((f) => f.competenciaId))];
  const [comps, pxPairs] = await Promise.all([
    cargarMapCompetenciasConEtiqueta(ids),
    Promise.all(
      faltantes.map(async (f) => {
        const px =
          (await resolverPxReferenciaCompetenciaPxListas(
            f.codTienda,
            f.competenciaId
          )) ?? 0;
        return { ...f, px };
      })
    ),
  ]);

  for (const f of pxPairs) {
    const meta = comps.get(f.competenciaId);
    if (!meta) continue;
    const list = opcionesPorCod.get(f.codTienda) ?? [];
    list.push({
      competenciaId: f.competenciaId,
      nombre: meta.nombre,
      etiqueta: meta.etiqueta,
      px: f.px,
    });
    list.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
    opcionesPorCod.set(f.codTienda, list);
  }
}

export async function limpiarCompetenciaRefPxListaGeneral(
  codTienda: string
): Promise<void> {
  await prisma.prodTienda.update({
    where: { codTienda },
    data: { competenciaIdPxListaGeneral: null },
  });
}

/**
 * Si la lista es **1 - GENERAL**, limpia la FK de competidor (edición manual de PX/PORC.).
 * No modifica el valor numérico de staging.
 */
export async function limpiarCompetenciaRefSiListaGeneral(
  codTienda: string,
  idLista: number
): Promise<boolean> {
  const idGeneral = await resolverIdListaGeneral();
  if (idGeneral == null || idLista !== idGeneral) return false;
  await limpiarCompetenciaRefPxListaGeneral(codTienda);
  return true;
}

/**
 * Persiste la config de competidor de referencia para **1 - GENERAL**.
 * - `competenciaId` null / "-" → solo limpia FK (no toca PX).
 * - competidor válido → guarda FK + copia PX de referencia a staging (PORC. se deriva del costo).
 */
export async function guardarCompetenciaRefPxListaGeneral(
  codTienda: string,
  competenciaIdRaw: string | null
): Promise<ServiceResult<ResultadoGuardarCompRefPxListas>> {
  const producto = await prisma.prodTienda.findUnique({
    where: { codTienda },
    select: { codTienda: true },
  });
  if (!producto) {
    return { success: false, error: "Producto tienda no encontrado." };
  }

  const idGeneral = await resolverIdListaGeneral();
  if (idGeneral == null) {
    return { success: false, error: "No existe la lista 1 - GENERAL." };
  }

  const competenciaId =
    competenciaIdRaw == null ||
    competenciaIdRaw === "" ||
    competenciaIdRaw === PX_LISTAS_COMP_REF_NINGUNO
      ? null
      : competenciaIdRaw;

  if (competenciaId == null) {
    await limpiarCompetenciaRefPxListaGeneral(codTienda);
    return {
      success: true,
      data: {
        competenciaIdPxListaGeneral: null,
        pxActualizado: false,
        pxEdicion: null,
        pxEfectivo: null,
        margenManual: null,
      },
    };
  }

  const competencia = await prisma.prodCompetencia.findUnique({
    where: { id: competenciaId },
    select: { id: true },
  });
  if (!competencia) {
    return { success: false, error: "Competidor no encontrado." };
  }

  const pxRef = await resolverPxReferenciaCompetenciaPxListas(
    codTienda,
    competenciaId
  );
  if (pxRef == null || !(pxRef > 0)) {
    return {
      success: false,
      error: "No hay precio de referencia para este competidor.",
    };
  }

  await prisma.prodTienda.update({
    where: { codTienda },
    data: { competenciaIdPxListaGeneral: competenciaId },
  });

  const resPx = await guardarPrecioListaEdicionDesdePx(
    codTienda,
    idGeneral,
    pxRef
  );
  if (!resPx.success) {
    return { success: false, error: resPx.error };
  }

  return {
    success: true,
    data: {
      competenciaIdPxListaGeneral: competenciaId,
      pxActualizado: true,
      pxEdicion: resPx.data.pxEdicion,
      pxEfectivo: resPx.data.pxEfectivo,
      margenManual: resPx.data.margenManual,
    },
  };
}

/**
 * Si hay FK de competidor, re-aplica el PX de referencia a staging de GENERAL
 * (p. ej. cuando cambió scraping/sugerido) para que PORC. UTILIDAD se derive del costo actual.
 */
export async function sincronizarPxGeneralDesdeCompetenciaRef(
  codTiendas: string[]
): Promise<void> {
  if (codTiendas.length === 0) return;

  const idGeneral = await resolverIdListaGeneral();
  if (idGeneral == null) return;

  const rows = await prisma.prodTienda.findMany({
    where: {
      codTienda: { in: codTiendas },
      competenciaIdPxListaGeneral: { not: null },
    },
    select: {
      codTienda: true,
      competenciaIdPxListaGeneral: true,
      costoCompra: true,
    },
  });
  if (rows.length === 0) return;

  const edicionRows = await prisma.prodTiendaPrecioEdicion.findMany({
    where: {
      codTienda: { in: rows.map((r) => r.codTienda) },
      idLista: idGeneral,
    },
    select: { codTienda: true, precio: true },
  });
  const edicionMap = new Map(
    edicionRows.map((r) => [r.codTienda, Number(r.precio)])
  );

  for (const row of rows) {
    const competenciaId = row.competenciaIdPxListaGeneral;
    if (!competenciaId) continue;
    const pxRef = await resolverPxReferenciaCompetenciaPxListas(
      row.codTienda,
      competenciaId
    );
    if (pxRef == null || !(pxRef > 0)) continue;
    const actual = edicionMap.get(row.codTienda) ?? null;
    if (preciosPxListaEnterosIguales(pxRef, actual)) continue;
    await guardarPrecioListaEdicionDesdePx(row.codTienda, idGeneral, pxRef);
  }
}

/** Antes de Act. Px: re-sincroniza todos los productos con FK de competidor. */
export async function sincronizarTodosPxGeneralDesdeCompetenciaRef(): Promise<void> {
  const rows = await prisma.prodTienda.findMany({
    where: { competenciaIdPxListaGeneral: { not: null } },
    select: { codTienda: true },
  });
  await sincronizarPxGeneralDesdeCompetenciaRef(rows.map((r) => r.codTienda));
}
