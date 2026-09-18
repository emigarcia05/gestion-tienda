import {
  buscarPagoPorId,
  etiquetaPagoDesdeItem,
  filtrarPagosMargenContribucion,
  type FinAnaCosFinaPagoItem,
  type FormaPagoMargenContribucion,
} from "@/lib/finAnaCosFinaPagos";
import {
  cxTotalConIvaFinAnaCosFina,
  cxTotalSinIvaFinAnaCosFina,
} from "@/lib/finAnaCosFina";
import { roundPorcentaje0a100 } from "@/lib/format";
import {
  FIN_ANA_MC_FORMULA_DEFAULTS,
  type ParametrosFormulaMargenContribucion,
} from "@/lib/finAnaMcFormulas";

export type { ParametrosFormulaMargenContribucion } from "@/lib/finAnaMcFormulas";

export const FIN_ANA_MC_FORMULA_PARAMS_DEFAULT: ParametrosFormulaMargenContribucion =
  {
    pxListaCIva: FIN_ANA_MC_FORMULA_DEFAULTS.PX_LISTA_C_IVA.valor,
    ivaAlicuota: FIN_ANA_MC_FORMULA_DEFAULTS.IVA_ALICUOTA.valor,
    iibbAlicuota: FIN_ANA_MC_FORMULA_DEFAULTS.IIBB_ALICUOTA.valor,
    ivaFactor: 1 + FIN_ANA_MC_FORMULA_DEFAULTS.IVA_ALICUOTA.valor,
  };

export type { FormaPagoMargenContribucion } from "@/lib/finAnaCosFinaPagos";

export function idsFormasPagoMargenContribucion(
  pagos: FinAnaCosFinaPagoItem[]
): FormaPagoMargenContribucion[] {
  return filtrarPagosMargenContribucion(pagos).map((p) => p.id);
}

export function etiquetaFormaPagoMargenContribucion(
  formaPagoId: FormaPagoMargenContribucion,
  pagos: FinAnaCosFinaPagoItem[]
): string {
  const item = buscarPagoPorId(pagos, formaPagoId);
  return item ? etiquetaPagoDesdeItem(item) : formaPagoId;
}

/** Filas de datos de la grilla. */
export const FIN_ANA_MC_FILAS_DATO = [
  "PX_LISTA",
  "DESCUENTO",
  "PX_VENTA",
  "IVA",
  "IIBB",
  "CX_MERCADERIA",
  "CX_FINANCIERO",
  "MC",
  "MC_PONDERADO",
] as const;

export type FilaMargenContribucionDatoId = (typeof FIN_ANA_MC_FILAS_DATO)[number];

export type SeccionMargenContribucionId = "INGRESO" | "COSTOS" | "MARGEN";

export type SeccionMargenContribucion = {
  id: SeccionMargenContribucionId;
  etiqueta: string;
  filas: readonly FilaMargenContribucionDatoId[];
};

/**
 * Tres bloques visuales (columna izquierda con etiqueta vertical).
 * Separadores primary entre secciones en la UI.
 */
export const FIN_ANA_MC_SECCIONES: readonly SeccionMargenContribucion[] = [
  {
    id: "INGRESO",
    etiqueta: "INGRESO",
    /** PX LISTA / PX VENTA se calculan en memoria (base $100) pero no se muestran. */
    filas: ["DESCUENTO"],
  },
  {
    id: "COSTOS",
    etiqueta: "COSTOS",
    filas: ["IVA", "IIBB", "CX_MERCADERIA", "CX_FINANCIERO"],
  },
  {
    id: "MARGEN",
    etiqueta: "MARGEN",
    filas: ["MC", "MC_PONDERADO"],
  },
];

/** @deprecated Preferir `FIN_ANA_MC_SECCIONES`. Layout plano legacy. */
export type FilaMargenContribucionLayout =
  | { tipo: "dato"; id: FilaMargenContribucionDatoId }
  | { tipo: "subtotal"; id: "SUBTOTAL_COSTOS" }
  | { tipo: "espacio"; id: "SEPARACION" };

/** @deprecated Preferir `FIN_ANA_MC_SECCIONES`. */
export const FIN_ANA_MC_LAYOUT: FilaMargenContribucionLayout[] = [
  { tipo: "dato", id: "PX_LISTA" },
  { tipo: "dato", id: "DESCUENTO" },
  { tipo: "dato", id: "PX_VENTA" },
  { tipo: "espacio", id: "SEPARACION" },
  { tipo: "dato", id: "IVA" },
  { tipo: "dato", id: "IIBB" },
  { tipo: "dato", id: "CX_MERCADERIA" },
  { tipo: "dato", id: "CX_FINANCIERO" },
  { tipo: "dato", id: "MC" },
  { tipo: "dato", id: "MC_PONDERADO" },
];

const ETIQUETAS_FILA: Record<FilaMargenContribucionDatoId, string> = {
  PX_LISTA: "PX LISTA",
  DESCUENTO: "DESCUENTO",
  PX_VENTA: "PX VENTA",
  IVA: "IVA",
  IIBB: "IIBB",
  CX_MERCADERIA: "CX MERCADERÍA",
  CX_FINANCIERO: "CX FINANCIERO",
  MC: "M.C",
  MC_PONDERADO: "M.C PONDERADO",
};

export function etiquetaFilaMargenContribucion(id: FilaMargenContribucionDatoId): string {
  return ETIQUETAS_FILA[id];
}

function fmtAlicuotaAyuda(valor: number): string {
  return valor.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

/** Fórmulas de ayuda (UI) para filas de COSTOS y MARGEN. */
export function ayudaFormulaFilaMargenContribucion(
  id: FilaMargenContribucionDatoId,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): string | null {
  const iva = fmtAlicuotaAyuda(params.ivaAlicuota);
  const iibb = fmtAlicuotaAyuda(params.iibbAlicuota);
  const mapa: Partial<Record<FilaMargenContribucionDatoId, string>> = {
    IVA: `(Px. Vta. sin IVA × ${iva}) / Px. Vta. C/ IVA`,
    IIBB: `(Px. Vta. sin IVA × ${iibb}) / Px. Vta. C/ IVA`,
    CX_MERCADERIA:
      "((Px. Lista sin IVA) / (1 + porc. utilidad % / 100)) / Px. Vta. C/ IVA",
    CX_FINANCIERO:
      "FACTURA A → CX TOTAL S/ IVA; FACTURA C → CX TOTAL C/ IVA (catálogo terminal × pago).",
    MC: "1 − (IVA + IIBB + CX MERCADERÍA + CX FINANCIERO)",
    MC_PONDERADO: "M.C × Px. Venta C/ IVA",
  };
  return mapa[id] ?? null;
}

/** Descuento editable por columna (forma de pago). */
export function esFilaDescuentoPorFormaPagoMargenContribucion(
  id: FilaMargenContribucionDatoId
): boolean {
  return id === "DESCUENTO";
}

export function crearDescuentoPctPorFormaPagoVacios(
  formasPago: readonly FormaPagoMargenContribucion[] = []
): Record<FormaPagoMargenContribucion, number> {
  const map = {} as Record<FormaPagoMargenContribucion, number>;
  for (const forma of formasPago) {
    map[forma] = 0;
  }
  return map;
}

export function esFilaPorFormaPagoMargenContribucion(id: FilaMargenContribucionDatoId): boolean {
  return id === "CX_FINANCIERO" || id === "MC" || id === "MC_PONDERADO";
}

/**
 * PX LISTA de referencia del simulador (fallback si aún no hay fila en BD).
 * Preferir `ParametrosFormulaMargenContribucion.pxListaCIva` desde `fin_ana_mc_formulas`.
 */
export const FIN_ANA_MC_PX_LISTA_ESTIMADO_PORC_UTILIDAD =
  FIN_ANA_MC_FORMULA_DEFAULTS.PX_LISTA_C_IVA.valor;

/** Rango del descuento % por forma de pago (entero, puede ser negativo). */
export const FIN_ANA_MC_DESCUENTO_MIN = -100;
export const FIN_ANA_MC_DESCUENTO_MAX = 100;

/** Tipo de comprobante de venta (afecta IVA e IIBB en el simulador). */
export type TipoComprobanteVentaMargenContribucion =
  | "FACTURA_A"
  | "FACTURA_C";

export const FIN_ANA_MC_TIPOS_COMPROBANTE: TipoComprobanteVentaMargenContribucion[] = [
  "FACTURA_A",
  "FACTURA_C",
];

const ETIQUETAS_TIPO_COMPROBANTE: Record<
  TipoComprobanteVentaMargenContribucion,
  string
> = {
  FACTURA_A: "FACTURA A",
  FACTURA_C: "FACTURA C",
};

export function etiquetaTipoComprobanteVentaMargenContribucion(
  tipo: TipoComprobanteVentaMargenContribucion
): string {
  return ETIQUETAS_TIPO_COMPROBANTE[tipo];
}

export function aplicaImpuestosComprobanteMargenContribucion(
  tipo: TipoComprobanteVentaMargenContribucion
): { aplicaIva: boolean; aplicaIibb: boolean } {
  switch (tipo) {
    case "FACTURA_C":
      return { aplicaIva: false, aplicaIibb: false };
    case "FACTURA_A":
    default:
      return { aplicaIva: true, aplicaIibb: true };
  }
}

/** @deprecated Usar `FilaMargenContribucionDatoId`. */
export type FilaMargenContribucionId = FilaMargenContribucionDatoId;

/** @deprecated Usar `FIN_ANA_MC_LAYOUT`. */
export const FIN_ANA_MC_FILAS = FIN_ANA_MC_FILAS_DATO;

/** Precio neto sin IVA desde precio con IVA incluido. */
export function netoSinIvaMargenContribucion(
  precioConIva: number,
  ivaFactor: number = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT.ivaFactor
): number {
  if (!(ivaFactor > 0)) return 0;
  return precioConIva / ivaFactor;
}

/**
 * PX VENTA C/ IVA = PX LISTA C/ IVA × (1 + descuento % / 100).
 * Signo: negativo = descuento (p. ej. −25 → 75); positivo = recargo (p. ej. +10 → 110).
 * El input usa `defaultNegative` (siempre arranca en −).
 */
export function pxVentaMargenContribucion(
  pxLista: number,
  descuentoPct: number
): number {
  if (!(pxLista > 0)) return 0;
  const factor = 1 + descuentoPct / 100;
  return Math.round(pxLista * Math.max(0, factor));
}

/** @deprecated Usar `pxVentaMargenContribucion`. */
export const precioVentaMargenContribucion = pxVentaMargenContribucion;

/**
 * Ratio IVA sobre PX VENTA C/ IVA: `(PX VTA S/ IVA × alícuota) / PX VTA C/ IVA`.
 */
export function ivaRatioMargenContribucion(
  pxVenta: number,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): number {
  if (!(pxVenta > 0)) return 0;
  return (
    (netoSinIvaMargenContribucion(pxVenta, params.ivaFactor) *
      params.ivaAlicuota) /
    pxVenta
  );
}

/**
 * Ratio IIBB sobre PX VENTA C/ IVA: `(PX VTA S/ IVA × alícuota) / PX VTA C/ IVA`.
 */
export function iibbRatioMargenContribucion(
  pxVenta: number,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): number {
  if (!(pxVenta > 0)) return 0;
  return (
    (netoSinIvaMargenContribucion(pxVenta, params.ivaFactor) *
      params.iibbAlicuota) /
    pxVenta
  );
}

/**
 * CX MERCADERÍA (pesos): `(PX LISTA S/ IVA) / (1 + porc. utilidad % / 100)`.
 */
export function cxMercaderiaPesosDesdePorcUtilidadMargenContribucion(
  pxLista: number,
  porcUtilidadPct: number,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): number | null {
  if (!(pxLista > 0) || !(porcUtilidadPct > 0)) return null;
  const netoLista = netoSinIvaMargenContribucion(pxLista, params.ivaFactor);
  const factorUtilidad = 1 + porcUtilidadPct / 100;
  if (!(factorUtilidad > 0)) return null;
  return netoLista / factorUtilidad;
}

/**
 * Ratio CX MERCADERÍA sobre PX VENTA C/ IVA:
 * `((PX LISTA S/ IVA) / (1 + porc. utilidad % / 100)) / PX VTA C/ IVA`.
 */
export function cxMercaderiaRatioMargenContribucion(
  pxLista: number,
  porcUtilidadPct: number,
  pxVenta: number,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): number | null {
  if (!(pxVenta > 0)) return null;
  const cxPesos = cxMercaderiaPesosDesdePorcUtilidadMargenContribucion(
    pxLista,
    porcUtilidadPct,
    params
  );
  if (cxPesos == null) return null;
  return cxPesos / pxVenta;
}

/** @deprecated Usar `cxMercaderiaPesosDesdePorcUtilidadMargenContribucion`. */
export function cxMercaderiaDesdePorcUtilidadMargenContribucion(
  pxLista: number,
  porcUtilidadPct: number,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): number | null {
  const pesos = cxMercaderiaPesosDesdePorcUtilidadMargenContribucion(
    pxLista,
    porcUtilidadPct,
    params
  );
  return pesos == null ? null : Math.round(pesos);
}

/**
 * @deprecated Usar `cxMercaderiaRatioMargenContribucion`.
 */
export function cxMercaderiaMargenContribucion(
  precioVenta: number,
  porcUtilidadPct: number,
  params: ParametrosFormulaMargenContribucion = FIN_ANA_MC_FORMULA_PARAMS_DEFAULT
): number | null {
  return cxMercaderiaDesdePorcUtilidadMargenContribucion(
    precioVenta,
    porcUtilidadPct,
    params
  );
}

export type InputsMargenContribucion = {
  pxLista: number;
  descuentoPct: number;
  porcUtilidadPct: number;
  tipoComprobante?: TipoComprobanteVentaMargenContribucion;
  formulas?: ParametrosFormulaMargenContribucion;
};

/** Valores calculados: `iva` / `iibb` / `cxMercaderia` son **ratios** sobre PX VENTA (0–1). */
export type ValoresCalculadosMargenContribucion = {
  precioVenta: number;
  iva: number;
  iibb: number;
  cxMercaderia: number | null;
};

export function calcularValoresMargenContribucion(
  inputs: InputsMargenContribucion
): ValoresCalculadosMargenContribucion {
  const formulas = inputs.formulas ?? FIN_ANA_MC_FORMULA_PARAMS_DEFAULT;
  const precioVenta = pxVentaMargenContribucion(
    inputs.pxLista,
    inputs.descuentoPct
  );
  const tipoComprobante = inputs.tipoComprobante ?? "FACTURA_A";
  const { aplicaIva, aplicaIibb } =
    aplicaImpuestosComprobanteMargenContribucion(tipoComprobante);

  return {
    precioVenta,
    iva: aplicaIva ? ivaRatioMargenContribucion(precioVenta, formulas) : 0,
    iibb: aplicaIibb ? iibbRatioMargenContribucion(precioVenta, formulas) : 0,
    cxMercaderia: cxMercaderiaRatioMargenContribucion(
      inputs.pxLista,
      inputs.porcUtilidadPct,
      precioVenta,
      formulas
    ),
  };
}

/** CX FINANCIERO (ratio): % de Costos Financieros / 100. */
export function cxFinancieroRatioMargenContribucion(cxFinPct: number): number {
  if (!(cxFinPct > 0)) return 0;
  return cxFinPct / 100;
}

/** @deprecated Usar `cxFinancieroRatioMargenContribucion` (ya no se expresa en pesos). */
export function cxFinancieroPesosMargenContribucion(
  pxVenta: number,
  cxFinPct: number
): number {
  if (!(pxVenta > 0) || !(cxFinPct > 0)) return 0;
  return Math.round(pxVenta * (cxFinPct / 100));
}

/**
 * Formato de ratios (0–1 → `N%`). Acepta también montos base-100 (M.C PONDERADO).
 * `escala`: `"ratio"` (default) multiplica ×100; `"base100"` redondea el valor tal cual.
 */
export function fmtCeldaMontoMargenContribucion(
  valor: number | null | undefined,
  escala: "ratio" | "base100" = "ratio"
): string {
  if (valor == null || Number.isNaN(valor)) return "—";
  const pct = escala === "ratio" ? valor * 100 : valor;
  return `${Math.round(pct).toLocaleString("es-AR")}%`;
}

/** Suma de costos (ratios): IVA + IIBB + CX MERCADERÍA + CX FINANCIERO. */
export function sumaCostosRatioMargenContribucionPorFormaPago(
  calculados: ValoresCalculadosMargenContribucion,
  cxFinPct: number
): number | null {
  if (!(calculados.precioVenta > 0)) return null;
  if (calculados.cxMercaderia == null) return null;
  const cxFin = cxFinancieroRatioMargenContribucion(cxFinPct);
  return calculados.iva + calculados.iibb + calculados.cxMercaderia + cxFin;
}

/** @deprecated Usar `sumaCostosRatioMargenContribucionPorFormaPago`. */
export function subtotalCostosMargenContribucionPorFormaPago(
  calculados: ValoresCalculadosMargenContribucion,
  cxFinPct: number
): number | null {
  return sumaCostosRatioMargenContribucionPorFormaPago(calculados, cxFinPct);
}

/** M.C (ratio) = 1 − suma de costos. */
export function mcMargenContribucionPorFormaPago(
  calculados: ValoresCalculadosMargenContribucion,
  cxFinPct: number
): number | null {
  const suma = sumaCostosRatioMargenContribucionPorFormaPago(
    calculados,
    cxFinPct
  );
  if (suma == null) return null;
  return 1 - suma;
}

/** M.C PONDERADO = M.C × PX VENTA (escala base-100 del simulador). */
export function mcPonderadoMargenContribucionPorFormaPago(
  calculados: ValoresCalculadosMargenContribucion,
  cxFinPct: number
): number | null {
  const mc = mcMargenContribucionPorFormaPago(calculados, cxFinPct);
  if (mc == null || !(calculados.precioVenta > 0)) return null;
  return mc * calculados.precioVenta;
}

export type CxFinancieroPorFormaPago = Record<FormaPagoMargenContribucion, number>;

/** Subconjunto de `FinAnaCosFinaItem` para cálculo en cliente (sin Prisma). */
export type FilaCostosFinancierosMargenContribucion = {
  habilitado: boolean;
  impCheque: boolean;
  terminalId: string;
  pagoId: string;
  arancel: number;
  costoFinanciero: number;
};

function promedioCxTotalMargenContribucion(
  filas: FilaCostosFinancierosMargenContribucion[],
  tipoComprobante: TipoComprobanteVentaMargenContribucion
): number {
  if (filas.length === 0) return 0;
  const usarSinIva = tipoComprobante === "FACTURA_A";
  const suma = filas.reduce((acc, fila) => {
    const cx = usarSinIva
      ? cxTotalSinIvaFinAnaCosFina(
          fila.impCheque,
          fila.arancel,
          fila.costoFinanciero
        )
      : cxTotalConIvaFinAnaCosFina(
          fila.impCheque,
          fila.arancel,
          fila.costoFinanciero
        );
    return acc + cx;
  }, 0);
  return roundPorcentaje0a100(suma / filas.length);
}

/**
 * CX FINANCIERO por forma de pago desde Costos Financieros:
 * - **FACTURA A** → **CX TOTAL S/ IVA**
 * - **FACTURA C** → **CX TOTAL C/ IVA**
 * Si `terminalId` está definido, solo filas de esa terminal habilitadas; si no, promedio entre terminales habilitadas.
 */
export function mapCxFinancieroPorFormaPago(
  filas: FilaCostosFinancierosMargenContribucion[],
  pagosCatalogo: FinAnaCosFinaPagoItem[],
  terminalId?: string,
  tipoComprobante: TipoComprobanteVentaMargenContribucion = "FACTURA_A"
): CxFinancieroPorFormaPago {
  const habilitadas = filas.filter(
    (fila) =>
      fila.habilitado && (terminalId == null || fila.terminalId === terminalId)
  );

  const map = {} as CxFinancieroPorFormaPago;

  for (const pago of filtrarPagosMargenContribucion(pagosCatalogo)) {
    if (pago.enCostosFinancieros) {
      const delPago = habilitadas.filter((fila) => fila.pagoId === pago.id);
      map[pago.id] = promedioCxTotalMargenContribucion(delPago, tipoComprobante);
    } else {
      map[pago.id] = 0;
    }
  }

  return map;
}

/** Rango del gráfico M.C vs PORC. UTILIDAD (eje X). */
export const MC_GRAFICO_PORC_UTILIDAD_MIN = 20;
export const MC_GRAFICO_PORC_UTILIDAD_MAX = 200;
export const MC_GRAFICO_PORC_UTILIDAD_STEP = 5;

/**
 * Resuelve la forma de pago **3 Cuotas** por nombre/código del catálogo
 * (`cobros_opciones_pago`), sin hardcodear id.
 */
export function idFormaPagoTresCuotasMargenContribucion(
  pagos: readonly FinAnaCosFinaPagoItem[]
): FormaPagoMargenContribucion | null {
  const candidatos = filtrarPagosMargenContribucion([...pagos]);
  const exacto = candidatos.find((p) => {
    const nombre = p.nombre.trim().toLocaleUpperCase("es");
    const codigo = p.codigo.trim().toLocaleUpperCase("es");
    return (
      nombre === "3 CUOTAS" ||
      nombre === "3 CUOTA" ||
      codigo === "3_CUOTAS" ||
      codigo === "CUOTAS_3" ||
      codigo === "CUOTA_3" ||
      codigo === "3_CUOTA"
    );
  });
  if (exacto) return exacto.id;
  const aproximado = candidatos.find((p) => {
    const nombre = p.nombre.toLocaleUpperCase("es");
    return /\b3\b/.test(nombre) && /CUOTA/.test(nombre);
  });
  return aproximado?.id ?? null;
}

export type PuntoMcVsPorcUtilidad = {
  porcUtilidadPct: number;
  /** Valor del eje Y en % de visualización (M.C ratio×100 o M.C PONDERADO base-100). */
  mcPct: number | null;
};

export type MetricaGraficoMcMargenContribucion =
  | "CX_MERCADERIA"
  | "CX_FINANCIERO"
  | "MC"
  | "MC_PONDERADO";

export const FIN_ANA_MC_METRICAS_GRAFICO = [
  "CX_MERCADERIA",
  "CX_FINANCIERO",
  "MC",
  "MC_PONDERADO",
] as const satisfies readonly MetricaGraficoMcMargenContribucion[];

export const ETIQUETA_METRICA_GRAFICO_MC: Record<
  MetricaGraficoMcMargenContribucion,
  string
> = {
  CX_MERCADERIA: "CX MERCADERÍA",
  CX_FINANCIERO: "CX FINANCIERO",
  MC: "M.C",
  MC_PONDERADO: "M.C PONDERADO",
};

/** Etiqueta corta para cabecera de columna en checklist del gráfico. */
export const ETIQUETA_CORTA_METRICA_GRAFICO_MC: Record<
  MetricaGraficoMcMargenContribucion,
  string
> = {
  CX_MERCADERIA: "CX MERC.",
  CX_FINANCIERO: "CX FIN.",
  MC: "M.C",
  MC_PONDERADO: "M.C POND.",
};

/** Métricas del gráfico que admiten overlay de Cat. M.C. (umbrales en M.C. PONDERADO). */
export function metricaGraficoSoportaCategoriasMc(
  metrica: MetricaGraficoMcMargenContribucion
): boolean {
  return metrica === "MC" || metrica === "MC_PONDERADO";
}

function valorYGraficoMcMargenContribucion(
  calculados: ValoresCalculadosMargenContribucion,
  cxFinPct: number,
  metrica: MetricaGraficoMcMargenContribucion
): number | null {
  switch (metrica) {
    case "CX_MERCADERIA":
      if (calculados.cxMercaderia == null) return null;
      return calculados.cxMercaderia * 100;
    case "CX_FINANCIERO":
      return cxFinancieroRatioMargenContribucion(cxFinPct) * 100;
    case "MC_PONDERADO":
      return mcPonderadoMargenContribucionPorFormaPago(calculados, cxFinPct);
    case "MC":
    default: {
      const mc = mcMargenContribucionPorFormaPago(calculados, cxFinPct);
      return mc == null ? null : mc * 100;
    }
  }
}

/**
 * Serie de la métrica elegida variando PORC. UTILIDAD en [min, max].
 * Usa descuento / CX / tipo / fórmulas actuales.
 */
export function serieMcVsPorcUtilidadMargenContribucion(params: {
  pxLista: number;
  descuentoPct: number;
  cxFinPct: number;
  tipoComprobante: TipoComprobanteVentaMargenContribucion;
  formulas: ParametrosFormulaMargenContribucion;
  metrica?: MetricaGraficoMcMargenContribucion;
  porcMin?: number;
  porcMax?: number;
  step?: number;
}): PuntoMcVsPorcUtilidad[] {
  const porcMin = params.porcMin ?? MC_GRAFICO_PORC_UTILIDAD_MIN;
  const porcMax = params.porcMax ?? MC_GRAFICO_PORC_UTILIDAD_MAX;
  const step = params.step ?? MC_GRAFICO_PORC_UTILIDAD_STEP;
  const metrica = params.metrica ?? "MC";
  const puntos: PuntoMcVsPorcUtilidad[] = [];

  for (let porc = porcMin; porc <= porcMax + 1e-9; porc += step) {
    const porcUtilidadPct = Math.round(porc * 100) / 100;
    const calculados = calcularValoresMargenContribucion({
      pxLista: params.pxLista,
      descuentoPct: params.descuentoPct,
      porcUtilidadPct,
      tipoComprobante: params.tipoComprobante,
      formulas: params.formulas,
    });
    puntos.push({
      porcUtilidadPct,
      mcPct: valorYGraficoMcMargenContribucion(
        calculados,
        params.cxFinPct,
        metrica
      ),
    });
  }

  return puntos;
}

/** Valor Y (%) en un PORC. UTILIDAD puntual (misma lógica que la serie). */
export function mcPctEnPorcUtilidadMargenContribucion(params: {
  pxLista: number;
  descuentoPct: number;
  cxFinPct: number;
  tipoComprobante: TipoComprobanteVentaMargenContribucion;
  formulas: ParametrosFormulaMargenContribucion;
  porcUtilidadPct: number;
  metrica?: MetricaGraficoMcMargenContribucion;
}): number | null {
  const calculados = calcularValoresMargenContribucion({
    pxLista: params.pxLista,
    descuentoPct: params.descuentoPct,
    porcUtilidadPct: params.porcUtilidadPct,
    tipoComprobante: params.tipoComprobante,
    formulas: params.formulas,
  });
  return valorYGraficoMcMargenContribucion(
    calculados,
    params.cxFinPct,
    params.metrica ?? "MC"
  );
}

/** Colores de series del gráfico (tokens de marca / mezclas). */
export const COLORES_SERIE_GRAFICO_MC = [
  "var(--primary)",
  "var(--accent2)",
  "color-mix(in oklab, var(--primary) 65%, black)",
  "color-mix(in oklab, var(--accent2) 55%, black)",
  "color-mix(in oklab, var(--primary) 45%, var(--accent2))",
  "color-mix(in oklab, var(--foreground) 55%, var(--primary))",
  "var(--accent)",
  "color-mix(in oklab, var(--destructive) 80%, var(--primary))",
] as const;
