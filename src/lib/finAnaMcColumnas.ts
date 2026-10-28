import {
  COLORES_SERIE_GRAFICO_MC,
  cxTotalPorTipoComprobanteMargenContribucion,
  type TipoComprobanteVentaMargenContribucion,
} from "@/lib/finAnaMargenContribucion";

/** Fila de Cobros & Cx Fina (`cobros_cx_fin`) usada para armar columnas de Margen Contribución. */
export type FilaCxFinColumnaMargenContribucion = {
  id: string;
  habilitado: boolean;
  impCheque: boolean;
  pagoId: string;
  pagoNombre: string;
  terminalId: string | null;
  terminalNombre: string;
  cuotas: string | null;
  arancel: number;
  costoFinanciero: number;
};

export type OpcionFiltroColumnaMargenContribucion = { value: string; label: string };

/** Valor de opción para filas sin entidad / sin cuota. */
export const MC_COLUMNA_SIN_ENTIDAD = "__SIN_ENTIDAD__";
export const MC_COLUMNA_SIN_CUOTA = "__SIN_CUOTA__";

export type FiltrosColumnasMargenContribucion = {
  pagoIds: readonly string[];
  entidadIds: readonly string[];
  /** Etiquetas de cuota en MAYÚSCULAS (el mismo texto puede existir en varios pares forma × entidad). */
  cuotas: readonly string[];
};

/** Una columna de la tabla / línea del gráfico = una fila habilitada forma × entidad × cuota. */
export type ColumnaMargenContribucion = {
  id: string;
  pagoId: string;
  formaNombre: string;
  /** `null` si la fila no tiene entidad. */
  entidadNombre: string | null;
  /** `null` si la fila no tiene cuota. */
  cuotaEtiqueta: string | null;
  /** `FORMA · ENTIDAD · CUOTA` (omite lo que no tiene). */
  etiqueta: string;
  /** CX FIN (%) por escenario: FACTURA A (CON IVA) → CX TOTAL S/ IVA; FACTURA C (SIN IVA) → C/ IVA. */
  cxFinPctPorTipo: Record<TipoComprobanteVentaMargenContribucion, number>;
  color: string;
};

function claveEntidad(fila: FilaCxFinColumnaMargenContribucion): string {
  return fila.terminalId ?? MC_COLUMNA_SIN_ENTIDAD;
}

function etiquetaCuota(fila: FilaCxFinColumnaMargenContribucion): string | null {
  const texto = fila.cuotas?.trim();
  return texto ? texto.toLocaleUpperCase("es") : null;
}

function claveCuota(fila: FilaCxFinColumnaMargenContribucion): string {
  return etiquetaCuota(fila) ?? MC_COLUMNA_SIN_CUOTA;
}

function incluye(seleccion: readonly string[], valor: string): boolean {
  return seleccion.length === 0 || seleccion.includes(valor);
}

function ordenarOpciones(
  opciones: Map<string, string>,
  valorAlFinal: string
): OpcionFiltroColumnaMargenContribucion[] {
  return [...opciones.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => {
      if (a.value === valorAlFinal) return 1;
      if (b.value === valorAlFinal) return -1;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });
}

export function filasHabilitadasColumnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[]
): FilaCxFinColumnaMargenContribucion[] {
  return filas.filter((fila) => fila.habilitado);
}

export function opcionesFormaPagoColumnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[]
): OpcionFiltroColumnaMargenContribucion[] {
  const map = new Map<string, string>();
  for (const fila of filas) {
    map.set(fila.pagoId, fila.pagoNombre.toLocaleUpperCase("es"));
  }
  return ordenarOpciones(map, "");
}

/** Entidades de las formas elegidas (todas si no hay forma elegida). */
export function opcionesEntidadColumnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[],
  pagoIds: readonly string[]
): OpcionFiltroColumnaMargenContribucion[] {
  const map = new Map<string, string>();
  for (const fila of filas) {
    if (!incluye(pagoIds, fila.pagoId)) continue;
    map.set(
      claveEntidad(fila),
      fila.terminalId ? fila.terminalNombre : "SIN ENTIDAD"
    );
  }
  return ordenarOpciones(map, MC_COLUMNA_SIN_ENTIDAD);
}

/** Cuotas de las formas y entidades elegidas (todas si no hay selección). */
export function opcionesCuotaColumnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[],
  pagoIds: readonly string[],
  entidadIds: readonly string[]
): OpcionFiltroColumnaMargenContribucion[] {
  const map = new Map<string, string>();
  for (const fila of filas) {
    if (!incluye(pagoIds, fila.pagoId)) continue;
    if (!incluye(entidadIds, claveEntidad(fila))) continue;
    map.set(claveCuota(fila), etiquetaCuota(fila) ?? "SIN CUOTA");
  }
  return ordenarOpciones(map, MC_COLUMNA_SIN_CUOTA);
}

/**
 * Columnas = filas habilitadas que cumplen FORMA PAGO (obligatoria), ENTIDAD y CUOTAS
 * (vacías = todas las de esas formas). Orden de `filas` (forma → entidad → cuota).
 * El color sale de la posición en `filas` para no cambiar al filtrar.
 */
export function columnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[],
  filtros: FiltrosColumnasMargenContribucion
): ColumnaMargenContribucion[] {
  if (filtros.pagoIds.length === 0) return [];
  const columnas: ColumnaMargenContribucion[] = [];
  filas.forEach((fila, index) => {
    if (!filtros.pagoIds.includes(fila.pagoId)) return;
    if (!incluye(filtros.entidadIds, claveEntidad(fila))) return;
    if (!incluye(filtros.cuotas, claveCuota(fila))) return;
    const formaNombre = fila.pagoNombre.toLocaleUpperCase("es");
    const entidadNombre = fila.terminalId ? fila.terminalNombre : null;
    const cuotaEtiqueta = etiquetaCuota(fila);
    columnas.push({
      id: fila.id,
      pagoId: fila.pagoId,
      formaNombre,
      entidadNombre,
      cuotaEtiqueta,
      etiqueta: [formaNombre, entidadNombre, cuotaEtiqueta]
        .filter((parte): parte is string => Boolean(parte))
        .join(" · "),
      cxFinPctPorTipo: {
        FACTURA_A: cxTotalPorTipoComprobanteMargenContribucion(fila, "FACTURA_A"),
        FACTURA_C: cxTotalPorTipoComprobanteMargenContribucion(fila, "FACTURA_C"),
      },
      color: COLORES_SERIE_GRAFICO_MC[index % COLORES_SERIE_GRAFICO_MC.length]!,
    });
  });
  return columnas;
}
