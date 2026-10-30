import {
  calcularValoresMargenContribucion,
  COLORES_SERIE_GRAFICO_MC,
  cxTotalPorTipoComprobanteMargenContribucion,
  mcMargenContribucionPorFormaPago,
  mcPonderadoMargenContribucionPorFormaPago,
  type ParametrosFormulaMargenContribucion,
  type TipoComprobanteVentaMargenContribucion,
} from "@/lib/finAnaMargenContribucion";

/** Fila de Cobros & Cx Financiero (`cobros_cx_fin`) usada para armar columnas de Margen Contribución. */
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
 * Formas a las que se aplica una selección de ENTIDAD / CUOTAS: las que tienen al menos
 * una de las opciones elegidas. Las demás no se acotan (p. ej. EFECTIVO sin entidad ni cuota).
 */
function formasAlcanzadas(
  filas: readonly FilaCxFinColumnaMargenContribucion[],
  seleccion: readonly string[],
  clave: (fila: FilaCxFinColumnaMargenContribucion) => string
): Set<string> {
  const formas = new Set<string>();
  if (seleccion.length === 0) return formas;
  for (const fila of filas) {
    if (seleccion.includes(clave(fila))) formas.add(fila.pagoId);
  }
  return formas;
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

/** `null` (sin cuota / sin entidad) va primero. */
function compararOpcional(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return compararTexto(a, b);
}

/** Orden de columnas: CUOTA (sin cuota primero) → FORMA DE PAGO → ENTIDAD (sin entidad primero). */
function compararColumnas(a: ColumnaMargenContribucion, b: ColumnaMargenContribucion): number {
  return (
    compararOpcional(a.cuotaEtiqueta, b.cuotaEtiqueta) ||
    compararTexto(a.formaNombre, b.formaNombre) ||
    compararOpcional(a.entidadNombre, b.entidadNombre)
  );
}

/**
 * Columnas = filas habilitadas de las FORMAS PAGO elegidas (obligatoria). ENTIDAD y CUOTAS
 * acotan solo las formas que tienen alguna de las opciones elegidas; una forma elegida nunca
 * desaparece por ellas. Ordenadas con `compararColumnas`.
 * El color sale de la posición en `filas` para no cambiar al filtrar.
 */
export function columnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[],
  filtros: FiltrosColumnasMargenContribucion
): ColumnaMargenContribucion[] {
  if (filtros.pagoIds.length === 0) return [];
  const filasDeLasFormas = filas.filter((fila) => filtros.pagoIds.includes(fila.pagoId));
  const formasConEntidad = formasAlcanzadas(
    filasDeLasFormas,
    filtros.entidadIds,
    claveEntidad
  );
  const pasaEntidad = (fila: FilaCxFinColumnaMargenContribucion) =>
    !formasConEntidad.has(fila.pagoId) ||
    filtros.entidadIds.includes(claveEntidad(fila));
  const formasConCuota = formasAlcanzadas(
    filasDeLasFormas.filter(pasaEntidad),
    filtros.cuotas,
    claveCuota
  );

  const columnas: ColumnaMargenContribucion[] = [];
  filas.forEach((fila, index) => {
    if (!filtros.pagoIds.includes(fila.pagoId)) return;
    if (!pasaEntidad(fila)) return;
    if (formasConCuota.has(fila.pagoId) && !filtros.cuotas.includes(claveCuota(fila))) {
      return;
    }
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
  return columnas.sort(compararColumnas);
}

/** Todas las filas habilitadas como columnas (sin filtros), en el mismo orden. */
export function todasLasColumnasMargenContribucion(
  filas: readonly FilaCxFinColumnaMargenContribucion[]
): ColumnaMargenContribucion[] {
  const pagoIds = [...new Set(filas.map((fila) => fila.pagoId))];
  return columnasMargenContribucion(filas, { pagoIds, entidadIds: [], cuotas: [] });
}

export type MargenesPorEscenarioMargenContribucion = {
  /** Ratio (0–1). */
  mc: Record<TipoComprobanteVentaMargenContribucion, number | null>;
  /** Escala base-100. */
  mcPonderado: Record<TipoComprobanteVentaMargenContribucion, number | null>;
};

/** M.C y M.C PONDERADO de una columna en los dos escenarios (CON IVA = FACTURA A, SIN IVA = FACTURA C). */
export function margenesPorEscenarioMargenContribucion(
  columna: ColumnaMargenContribucion,
  params: {
    pxLista: number;
    descuentoPct: number;
    porcUtilidadPct: number | null;
    formulas: ParametrosFormulaMargenContribucion;
  }
): MargenesPorEscenarioMargenContribucion {
  const deTipo = (tipo: TipoComprobanteVentaMargenContribucion) => {
    const calculados = calcularValoresMargenContribucion({ ...params, tipoComprobante: tipo });
    const cxFinPct = columna.cxFinPctPorTipo[tipo];
    return {
      mc: mcMargenContribucionPorFormaPago(calculados, cxFinPct),
      mcPonderado: mcPonderadoMargenContribucionPorFormaPago(calculados, cxFinPct),
    };
  };
  const conIva = deTipo("FACTURA_A");
  const sinIva = deTipo("FACTURA_C");
  return {
    mc: { FACTURA_A: conIva.mc, FACTURA_C: sinIva.mc },
    mcPonderado: { FACTURA_A: conIva.mcPonderado, FACTURA_C: sinIva.mcPonderado },
  };
}
