import { ESTADO_RELEVAMIENTO_COMPETENCIA } from "@/lib/competenciaRelevamiento";
import type { OpcionPxCompetencia } from "@/lib/pxCompetencia";
import type { CompetenciaParaCliente } from "@/services/competencia.service";
import type { DatoVinculoCompetenciaCliente } from "@/services/competenciaVinculo.service";

export interface CompetidorPrecioFila {
  competenciaId: string;
  nombre: string;
  prefijo3: string;
  px: number;
  difPctVsTienda: number | null;
}

interface ResumenPreciosCompetenciaFila {
  pxPromedio: number | null;
  difPctTiendaVsPromedio: number | null;
  menor: CompetidorPrecioFila | null;
  mayor: CompetidorPrecioFila | null;
  competidoresOrdenados: CompetidorPrecioFila[];
}

/** Abreviatura en columnas MENOR/MAYOR PRECIO: `proveedores.prefijo` del proveedor del competidor. */
function abreviaturaCompetidorEnGrilla(c: CompetenciaParaCliente): string {
  const p = c.prefijoProveedor?.trim();
  if (!p) return "—";
  return p.toUpperCase();
}

function difPctVsBase(precio: number, base: number): number | null {
  if (base <= 0) return null;
  return ((precio - base) / base) * 100;
}

const VINCULO_VACIO: DatoVinculoCompetenciaCliente = {
  urlProducto: null,
  tipoPagina: null,
  pxCompetencia: null,
  estado: ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_URL,
  errorMensaje: null,
  relevadoAt: null,
  urlBloqueadaPorPxSugerido: false,
};

/** Alinea vínculos con `opcionesCompetencia` (DET PRECIO) para promedio y detalle. */
export function fusionarVinculosConOpcionesPxCompetencia(
  vinculosPorCompetencia: Record<string, DatoVinculoCompetenciaCliente>,
  opciones: OpcionPxCompetencia[]
): Record<string, DatoVinculoCompetenciaCliente> {
  const out = { ...vinculosPorCompetencia };
  for (const op of opciones) {
    if (op.px == null || !(op.px > 0)) continue;
    const prev = out[op.competenciaId] ?? VINCULO_VACIO;
    if (prev.pxCompetencia != null && prev.pxCompetencia > 0) continue;
    const sinUrl = !prev.urlProducto?.trim();
    out[op.competenciaId] = {
      ...prev,
      pxCompetencia: op.px,
      estado: ESTADO_RELEVAMIENTO_COMPETENCIA.OK,
      urlBloqueadaPorPxSugerido: prev.urlBloqueadaPorPxSugerido || sinUrl,
    };
  }
  return out;
}

/** Competidores con precio a mostrar (scraping OK o Px. Vta. Sugerido vía `aplicarPrioridadPrecioMostrar`). */
function listarCompetidoresConPrecioOk(
  vinculosPorCompetencia: Record<string, DatoVinculoCompetenciaCliente>,
  competencias: CompetenciaParaCliente[],
  pxListaTienda: number
): CompetidorPrecioFila[] {
  const items: CompetidorPrecioFila[] = [];
  for (const c of competencias) {
    const v = vinculosPorCompetencia[c.id];
    if (v?.pxCompetencia == null || !(v.pxCompetencia > 0)) continue;
    items.push({
      competenciaId: c.id,
      nombre: c.nombre,
      prefijo3: abreviaturaCompetidorEnGrilla(c),
      px: v.pxCompetencia,
      difPctVsTienda: difPctVsBase(v.pxCompetencia, pxListaTienda),
    });
  }
  return items.sort((a, b) => a.px - b.px);
}

/**
 * Px Listas: incluye precios de vínculos y de `opcionesCompetencia` (p. ej. sugerido sin fila PPC).
 */
function listarCompetidoresConPrecioPxListas(
  opciones: OpcionPxCompetencia[],
  vinculosPorCompetencia: Record<string, DatoVinculoCompetenciaCliente>,
  competencias: CompetenciaParaCliente[],
  pxListaTienda: number
): CompetidorPrecioFila[] {
  const vinculos = fusionarVinculosConOpcionesPxCompetencia(vinculosPorCompetencia, opciones);
  const desdeVinculos = listarCompetidoresConPrecioOk(
    vinculos,
    competencias,
    pxListaTienda
  );
  const idsYa = new Set(desdeVinculos.map((x) => x.competenciaId));
  const competenciasPorId = new Map(competencias.map((c) => [c.id, c]));

  for (const op of opciones) {
    if (idsYa.has(op.competenciaId)) continue;
    if (op.px == null || !(op.px > 0)) continue;
    const c = competenciasPorId.get(op.competenciaId);
    desdeVinculos.push({
      competenciaId: op.competenciaId,
      nombre: op.nombre,
      prefijo3: c ? abreviaturaCompetidorEnGrilla(c) : op.nombre.slice(0, 3).toUpperCase(),
      px: op.px,
      difPctVsTienda: difPctVsBase(op.px, pxListaTienda),
    });
    idsYa.add(op.competenciaId);
  }

  return desdeVinculos.sort((a, b) => a.px - b.px);
}

export interface CompetidorFalloRelevamientoFila {
  competenciaId: string;
  nombre: string;
  estado: string;
  errorMensaje: string | null;
  relevadoAt: string | null;
}

/** Competidores con URL y último relevamiento en ERROR o SIN_PRECIO (para detalle expandido). */
function listarCompetidoresConFalloRelevamiento(
  vinculosPorCompetencia: Record<string, DatoVinculoCompetenciaCliente>,
  competencias: CompetenciaParaCliente[]
): CompetidorFalloRelevamientoFila[] {
  const items: CompetidorFalloRelevamientoFila[] = [];
  for (const c of competencias) {
    const v = vinculosPorCompetencia[c.id];
    if (v?.urlBloqueadaPorPxSugerido) continue;
    if (!v?.urlProducto?.trim()) continue;
    if (
      v.estado !== ESTADO_RELEVAMIENTO_COMPETENCIA.ERROR &&
      v.estado !== ESTADO_RELEVAMIENTO_COMPETENCIA.SIN_PRECIO
    ) {
      continue;
    }
    items.push({
      competenciaId: c.id,
      nombre: c.nombre,
      estado: v.estado,
      errorMensaje: v.errorMensaje,
      relevadoAt: v.relevadoAt,
    });
  }
  return items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export type ResumenPreciosPxListas = ResumenPreciosCompetenciaFila & {
  competidoresFalloDetalle: CompetidorFalloRelevamientoFila[];
};

/** Promedio / DIF TIENDA / detalle expandido para Px Listas (incluye precios sugeridos). */
export function calcularResumenPreciosPxCompetencia(
  opciones: OpcionPxCompetencia[],
  vinculosPorCompetencia: Record<string, DatoVinculoCompetenciaCliente>,
  competencias: CompetenciaParaCliente[],
  pxListaTienda: number
): ResumenPreciosPxListas {
  const vinculos = fusionarVinculosConOpcionesPxCompetencia(vinculosPorCompetencia, opciones);
  const competidoresOrdenados = listarCompetidoresConPrecioPxListas(
    opciones,
    vinculos,
    competencias,
    pxListaTienda
  );
  const competidoresFalloDetalle = listarCompetidoresConFalloRelevamiento(
    vinculos,
    competencias
  );
  return {
    ...resumenDesdeCompetidoresOrdenados(competidoresOrdenados, pxListaTienda),
    competidoresFalloDetalle,
  };
}

function resumenDesdeCompetidoresOrdenados(
  competidoresOrdenados: CompetidorPrecioFila[],
  pxListaTienda: number
): ResumenPreciosCompetenciaFila {
  if (competidoresOrdenados.length === 0) {
    return {
      pxPromedio: null,
      difPctTiendaVsPromedio: null,
      menor: null,
      mayor: null,
      competidoresOrdenados: [],
    };
  }
  const suma = competidoresOrdenados.reduce((acc, x) => acc + x.px, 0);
  const pxPromedio = Math.round(suma / competidoresOrdenados.length);
  return {
    pxPromedio,
    difPctTiendaVsPromedio: difPctVsBase(pxListaTienda, pxPromedio),
    menor: competidoresOrdenados[0] ?? null,
    mayor: competidoresOrdenados[competidoresOrdenados.length - 1] ?? null,
    competidoresOrdenados,
  };
}

