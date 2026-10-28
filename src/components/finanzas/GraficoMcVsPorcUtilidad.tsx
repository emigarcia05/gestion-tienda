"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TABLE_ROW_ACTION_ICON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_CORTA_METRICA_GRAFICO_MC,
  ETIQUETA_METRICA_GRAFICO_MC,
  etiquetaEscenarioIvaMargenContribucion,
  FIN_ANA_MC_METRICAS_GRAFICO,
  FIN_ANA_MC_TIPOS_COMPROBANTE,
  MC_GRAFICO_PORC_UTILIDAD_MAX,
  MC_GRAFICO_PORC_UTILIDAD_MIN,
  metricaGraficoSoportaCategoriasMc,
  type MetricaGraficoMcMargenContribucion,
  type PuntoMcVsPorcUtilidad,
  type TipoComprobanteVentaMargenContribucion,
} from "@/lib/finAnaMargenContribucion";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";

export type SerieGraficoMcVsPorcUtilidad = {
  id: string;
  etiqueta: string;
  color: string;
  puntos: PuntoMcVsPorcUtilidad[];
  /** Valor Y en el PORC. UTILIDAD marcado (null si no hay marca). */
  valorMarca: number | null;
};

export type FilaFormaPagoGraficoMc = {
  id: string;
  nombre: string;
  color: string;
  /** DESCUENTO aplicado a la forma (entero −100…100; negativo = descuento). */
  descuentoPct: number;
  /** Valor de la métrica (%) en el PORC. UTILIDAD actual; null si no aplica. */
  valorPct: number | null;
};

interface Props {
  series: SerieGraficoMcVsPorcUtilidad[];
  /** Series en escala **M.C** (ratio×100) para umbrales si VARIABLE OBJETIVO = M.C. */
  seriesMc?: SerieGraficoMcVsPorcUtilidad[];
  /**
   * Series en escala **M.C. PONDERADO**.
   * Umbrales Cat. M.C. cuando VARIABLE OBJETIVO = M.C. PONDERADO.
   */
  seriesMcPonderado?: SerieGraficoMcVsPorcUtilidad[];
  /** PORC. UTILIDAD actual del filtro; si null, no se dibuja la marca vertical. */
  porcUtilidadMarca: number | null;
  /** Cambia con escenario / PORC. UTILIDAD / columnas / CX / descuentos. */
  revisionFiltros: string;
  metrica: MetricaGraficoMcMargenContribucion;
  onMetricaChange: (metrica: MetricaGraficoMcMargenContribucion) => void;
  /** Escenario graficado: FACTURA A = CON IVA, FACTURA C = SIN IVA. */
  escenario: TipoComprobanteVentaMargenContribucion;
  onEscenarioChange: (escenario: TipoComprobanteVentaMargenContribucion) => void;
  /** Columnas elegidas en los filtros (forma × entidad × cuota); todas se grafican. */
  filasFormaPago: FilaFormaPagoGraficoMc[];
  /** Texto cuando no hay series (sin formas elegidas). */
  mensajeSinSeries?: string;
  /** Rangos de catálogo; overlay en métricas MC / MC_PONDERADO. */
  categoriasMc?: FinAnaMcCategoriaItem[];
  /** Escala de umbrales guardada en `fin_ana_mc_cat_config`. */
  variableObjetivo?: "MC" | "MC_PONDERADO";
  className?: string;
}

const PAD = { top: 20, right: 16, bottom: 36, left: 48 };
const VIEW_W = 720;
const VIEW_H = 220;
/** Debajo de etiqueta + % de Cat. M.C. (evita que la punteada cruce el texto). */
const CAT_LINEA_Y_INICIO = PAD.top + 32;

/** Mismo lado que `tabla-row-btn-filled-brand` en fila compacta (`2rem − 0.75rem` → `size-5`). */
const CHECK_CAT_CLASS = cn(
  "tabla-check-toggle !size-5 shrink-0 rounded-[2px] border border-[#0072bb] bg-card p-0",
  "text-[#0072bb] hover:bg-card hover:text-[#0072bb]"
);

function fmtPct(n: number): string {
  return `${Math.round(n).toLocaleString("es-AR")}%`;
}

/**
 * Dominio y ticks en múltiplos de 5, con preferencia de 9–10 etiquetas.
 * Amplía el rango a extremos “redondos” que cubran [minVal, maxVal].
 */
function ejeTicksMultiplo5(
  minVal: number,
  maxVal: number,
  ticksMin = 9,
  ticksMax = 10
): { lo: number; hi: number; ticks: number[] } {
  let min = Number.isFinite(minVal) ? minVal : 0;
  let max = Number.isFinite(maxVal) ? maxVal : 100;
  if (max <= min) {
    min -= 5;
    max += 5;
  }

  const steps = [
    5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 500, 1000,
  ];

  type Cand = { lo: number; hi: number; ticks: number[]; pad: number; dist: number };
  const perfectos: Cand[] = [];
  const otros: Cand[] = [];

  for (const step of steps) {
    const lo = Math.floor(min / step) * step;
    let hi = Math.ceil(max / step) * step;
    if (hi <= lo) hi = lo + step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step * 1e-6; v += step) {
      ticks.push(v);
    }
    const pad = hi - max + (min - lo);
    const dist = Math.min(
      Math.abs(ticks.length - ticksMin),
      Math.abs(ticks.length - ticksMax)
    );
    const cand: Cand = { lo, hi, ticks, pad, dist };
    if (ticks.length >= ticksMin && ticks.length <= ticksMax) {
      perfectos.push(cand);
    } else {
      otros.push(cand);
    }
  }

  const elegir = (lista: Cand[]) => {
    lista.sort((a, b) => a.dist - b.dist || a.pad - b.pad || a.ticks.length - b.ticks.length);
    return lista[0]!;
  };

  const best = perfectos.length > 0 ? elegir(perfectos) : elegir(otros);
  return { lo: best.lo, hi: best.hi, ticks: best.ticks };
}

/** Eje X fijo 0…300 (rango de PORC. UTILIDAD): 11 etiquetas, paso 30. */
const TICKS_X_PORC_UTILIDAD = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300,
] as const;

/**
 * Primer PORC. UTILIDAD (eje X) donde la serie Y alcanza el umbral.
 * Para Cat. M.C. el umbral y la serie de búsqueda están en escala **M.C. PONDERADO**.
 */
function porcUtilidadDondeValorAlcanza(
  puntos: PuntoMcVsPorcUtilidad[],
  umbralY: number
): number | null {
  const validos = puntos
    .filter(
      (p): p is PuntoMcVsPorcUtilidad & { mcPct: number } =>
        p.mcPct != null && Number.isFinite(p.mcPct)
    )
    .slice()
    .sort((a, b) => a.porcUtilidadPct - b.porcUtilidadPct);

  if (validos.length === 0 || !Number.isFinite(umbralY)) return null;

  const primero = validos[0]!;
  if (primero.mcPct >= umbralY) return primero.porcUtilidadPct;

  for (let i = 1; i < validos.length; i++) {
    const prev = validos[i - 1]!;
    const curr = validos[i]!;
    const cruzaSubiendo =
      prev.mcPct < umbralY && curr.mcPct >= umbralY;
    const cruzaBajando =
      prev.mcPct > umbralY && curr.mcPct <= umbralY;
    if (!cruzaSubiendo && !cruzaBajando) continue;
    const span = curr.mcPct - prev.mcPct;
    if (span === 0) return curr.porcUtilidadPct;
    const t = (umbralY - prev.mcPct) / span;
    return (
      prev.porcUtilidadPct + t * (curr.porcUtilidadPct - prev.porcUtilidadPct)
    );
  }
  return null;
}

function pathFromPuntos(
  puntos: PuntoMcVsPorcUtilidad[],
  xPx: (x: number) => number,
  yPx: (y: number) => number
): string {
  const validos = puntos.filter(
    (p): p is PuntoMcVsPorcUtilidad & { mcPct: number } =>
      p.mcPct != null && Number.isFinite(p.mcPct)
  );
  let d = "";
  for (let i = 0; i < validos.length; i++) {
    const p = validos[i];
    const cmd = i === 0 ? "M" : "L";
    d += `${cmd}${xPx(p.porcUtilidadPct).toFixed(2)},${yPx(p.mcPct).toFixed(2)} `;
  }
  return d.trim();
}

export default function GraficoMcVsPorcUtilidad({
  series,
  seriesMc = [],
  seriesMcPonderado = [],
  porcUtilidadMarca,
  revisionFiltros,
  metrica,
  onMetricaChange,
  escenario,
  onEscenarioChange,
  filasFormaPago,
  mensajeSinSeries = "Seleccioná al menos una forma de pago",
  categoriasMc = [],
  variableObjetivo = "MC_PONDERADO",
  className,
}: Props) {
  const gradId = useId().replace(/:/g, "");
  const [mostrarCategoriasMc, setMostrarCategoriasMc] = useState(false);
  const categoriasDisponibles = metricaGraficoSoportaCategoriasMc(metrica);
  const etiquetaEjeY = ETIQUETA_METRICA_GRAFICO_MC[metrica];
  const etiquetaColumna = ETIQUETA_CORTA_METRICA_GRAFICO_MC[metrica];
  const categoriasOrdenadas = useMemo(
    () => [...categoriasMc].sort((a, b) => a.desdePct - b.desdePct),
    [categoriasMc]
  );

  useEffect(() => {
    if (!categoriasDisponibles) {
      queueMicrotask(() => setMostrarCategoriasMc(false));
    }
  }, [categoriasDisponibles]);

  const tituloGrafico = `RELACIÓN "PORC. UTILIDAD / ${etiquetaEjeY}"`;

  const {
    paths,
    xToPx,
    yToPx,
    ticksX,
    ticksY,
    marcas,
    yBottom,
    marcaVerticalY,
    lineasCategorias,
  } = useMemo(() => {
      const plotW = VIEW_W - PAD.left - PAD.right;
      const plotH = VIEW_H - PAD.top - PAD.bottom;
      const xMin = MC_GRAFICO_PORC_UTILIDAD_MIN;
      const xMax = MC_GRAFICO_PORC_UTILIDAD_MAX;

      const yValues: number[] = [];
      for (const serie of series) {
        for (const p of serie.puntos) {
          if (p.mcPct != null && Number.isFinite(p.mcPct)) yValues.push(p.mcPct);
        }
        if (serie.valorMarca != null && Number.isFinite(serie.valorMarca)) {
          yValues.push(serie.valorMarca);
        }
      }

      let yLo = yValues.length > 0 ? Math.min(...yValues) : 0;
      let yHi = yValues.length > 0 ? Math.max(...yValues) : 100;
      if (yLo === yHi) {
        yLo -= 5;
        yHi += 5;
      }
      const padY = Math.max(2, (yHi - yLo) * 0.08);
      yLo -= padY;
      yHi += padY;

      const ejeY = ejeTicksMultiplo5(yLo, yHi);
      yLo = ejeY.lo;
      yHi = ejeY.hi;

      const xPx = (x: number) =>
        PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
      const yPx = (y: number) =>
        PAD.top + ((yHi - y) / (yHi - yLo)) * plotH;

      const pathsLocal = series.map((serie) => ({
        id: serie.id,
        color: serie.color,
        d: pathFromPuntos(serie.puntos, xPx, yPx),
      }));

      const ticksXLocal = [...TICKS_X_PORC_UTILIDAD];
      const ticksYLocal = ejeY.ticks;

      const marcasLocal: {
        id: string;
        color: string;
        x: number;
        y: number;
      }[] = [];

      if (
        porcUtilidadMarca != null &&
        porcUtilidadMarca >= xMin &&
        porcUtilidadMarca <= xMax
      ) {
        const x = xPx(porcUtilidadMarca);
        for (const serie of series) {
          if (serie.valorMarca == null || !Number.isFinite(serie.valorMarca)) {
            continue;
          }
          marcasLocal.push({
            id: serie.id,
            color: serie.color,
            x,
            y: yPx(serie.valorMarca),
          });
        }
      }

      const yBottomLocal = PAD.top + plotH;
      const marcaVerticalYLocal =
        marcasLocal.length > 0
          ? Math.min(...marcasLocal.map((m) => m.y))
          : null;

      /** Umbrales Cat. M.C. → línea+% en límite superior; nombre centrado en el tramo. */
      const lineasLocal: {
        id: string;
        etiqueta: string;
        color: string;
        xLinea: number;
        xLabel: number;
        xLimiteSuperior: number;
        porcLimiteSuperior: number;
        visible: boolean;
      }[] = [];

      const seriesUmbral =
        variableObjetivo === "MC"
          ? seriesMc.length > 0
            ? seriesMc
            : metrica === "MC"
              ? series
              : []
          : seriesMcPonderado.length > 0
            ? seriesMcPonderado
            : metrica === "MC_PONDERADO"
              ? series
              : [];

      if (
        mostrarCategoriasMc &&
        categoriasDisponibles &&
        categoriasOrdenadas.length > 0 &&
        seriesUmbral.length > 0
      ) {
        for (const cat of categoriasOrdenadas) {
          for (const serie of seriesUmbral) {
            const porcDesde =
              cat.desdePct <= 0
                ? xMin
                : porcUtilidadDondeValorAlcanza(serie.puntos, cat.desdePct);
            if (porcDesde == null || !Number.isFinite(porcDesde)) continue;

            let porcHasta = porcUtilidadDondeValorAlcanza(
              serie.puntos,
              cat.hastaPct
            );
            if (porcHasta == null || !Number.isFinite(porcHasta)) {
              const validos = serie.puntos.filter(
                (p) => p.mcPct != null && Number.isFinite(p.mcPct)
              );
              const ultimo = validos[validos.length - 1];
              if (
                ultimo?.mcPct != null &&
                ultimo.mcPct >= cat.desdePct &&
                (cat.hastaPct >= 100 || ultimo.mcPct < cat.hastaPct)
              ) {
                porcHasta = xMax;
              } else {
                continue;
              }
            }

            const desdeClamped = Math.min(xMax, Math.max(xMin, porcDesde));
            const hastaClamped = Math.min(xMax, Math.max(xMin, porcHasta));
            if (hastaClamped <= desdeClamped + 1e-6) continue;

            lineasLocal.push({
              id: `${serie.id}-${cat.id}`,
              etiqueta: cat.categoria,
              color: serie.color,
              /** Línea + % en el límite superior (hasta). */
              xLinea: xPx(hastaClamped),
              xLabel: (xPx(desdeClamped) + xPx(hastaClamped)) / 2,
              xLimiteSuperior: xPx(hastaClamped),
              porcLimiteSuperior: hastaClamped,
              visible: true,
            });
          }
        }
      }

      return {
        paths: pathsLocal,
        xToPx: xPx,
        yToPx: yPx,
        ticksX: ticksXLocal,
        ticksY: ticksYLocal,
        marcas: marcasLocal,
        yBottom: yBottomLocal,
        marcaVerticalY: marcaVerticalYLocal,
        lineasCategorias: lineasLocal,
      };
    }, [
      series,
      seriesMc,
      seriesMcPonderado,
      porcUtilidadMarca,
      mostrarCategoriasMc,
      categoriasOrdenadas,
      categoriasDisponibles,
      variableObjetivo,
      metrica,
    ]);

  return (
    <div
      className={cn(
        "flex min-h-[14rem] w-full flex-col overflow-visible rounded-md border border-border bg-card",
        className
      )}
    >
      <div className="flex min-h-[14rem] flex-1">
        <div className="flex w-64 shrink-0 flex-col gap-2 border-r border-border p-2">
          <Select
            value={metrica}
            onValueChange={(value) =>
              onMetricaChange(value as MetricaGraficoMcMargenContribucion)
            }
          >
            <SelectTrigger
              className="input-filtro-unificado h-10 w-full shrink-0 text-xs font-semibold"
              aria-label="Métrica del gráfico"
            >
              <SelectValue placeholder="MÉTRICA" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              className="select-content-filtro"
            >
              {FIN_ANA_MC_METRICAS_GRAFICO.map((opcion) => (
                <SelectItem key={opcion} value={opcion}>
                  {ETIQUETA_METRICA_GRAFICO_MC[opcion]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={escenario}
            onValueChange={(value) =>
              onEscenarioChange(value as TipoComprobanteVentaMargenContribucion)
            }
          >
            <SelectTrigger
              className="input-filtro-unificado h-10 w-full shrink-0 text-xs font-semibold"
              aria-label="Escenario del gráfico"
            >
              <SelectValue placeholder="ESCENARIO" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              className="select-content-filtro"
            >
              {FIN_ANA_MC_TIPOS_COMPROBANTE.map((opcion) => (
                <SelectItem key={opcion} value={opcion}>
                  {etiquetaEscenarioIvaMargenContribucion(opcion)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-1.5 py-1.5 text-left font-bold text-foreground">
                    FORMA
                  </th>
                  <th className="w-12 px-1.5 py-1.5 text-right font-bold text-foreground">
                    DESC.
                  </th>
                  <th className="w-14 px-1.5 py-1.5 text-right font-bold text-foreground">
                    {etiquetaColumna}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filasFormaPago.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-3 text-center text-muted-foreground"
                    >
                      Sin formas de pago
                    </td>
                  </tr>
                ) : (
                  filasFormaPago.map((fila) => (
                    <tr
                      key={fila.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="min-w-0 px-1.5 py-1 align-middle">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: fila.color }}
                            aria-hidden
                          />
                          <span className="truncate font-medium text-foreground">
                            {fila.nombre}
                          </span>
                        </span>
                      </td>
                      <td className="px-1.5 py-1 text-right align-middle tabular-nums text-foreground">
                        {fmtPct(fila.descuentoPct)}
                      </td>
                      <td className="px-1.5 py-1 text-right align-middle tabular-nums text-foreground">
                        {fila.valorPct == null ? "—" : fmtPct(fila.valorPct)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="relative min-w-0 flex-1 px-2 py-1" key={revisionFiltros}>
          {categoriasDisponibles && categoriasOrdenadas.length > 0 ? (
            <div className="absolute right-3 top-2 z-10">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMostrarCategoriasMc((prev) => !prev)}
                className={cn(
                  CHECK_CAT_CLASS,
                  mostrarCategoriasMc &&
                    "!bg-[#0072bb] hover:!bg-[#0072bb] border-[#0072bb] [&_svg]:!text-white"
                )}
                aria-pressed={mostrarCategoriasMc}
                aria-label={
                  mostrarCategoriasMc
                    ? "Ocultar categorías de M.C. Ponderado en el gráfico"
                    : "Mostrar categorías de M.C. Ponderado en el gráfico"
                }
                title={
                  mostrarCategoriasMc
                    ? "Ocultar Cat. M.C."
                    : "Mostrar Cat. M.C."
                }
              >
                {mostrarCategoriasMc ? (
                  <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                ) : null}
              </Button>
            </div>
          ) : null}
          {series.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {mensajeSinSeries}
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="h-full w-full"
              role="img"
              aria-label={tituloGrafico}
            >
              <defs>
                <linearGradient
                  id={`mc-fill-${gradId}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--primary)"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--primary)"
                    stopOpacity="0.02"
                  />
                </linearGradient>
              </defs>

              <line
                x1={PAD.left}
                y1={PAD.top}
                x2={PAD.left}
                y2={VIEW_H - PAD.bottom}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <line
                x1={PAD.left}
                y1={VIEW_H - PAD.bottom}
                x2={VIEW_W - PAD.right}
                y2={VIEW_H - PAD.bottom}
                stroke="var(--border)"
                strokeWidth={1}
              />

              {ticksY.map((y) => (
                <g key={`y-${y}`}>
                  <line
                    x1={PAD.left}
                    y1={yToPx(y)}
                    x2={VIEW_W - PAD.right}
                    y2={yToPx(y)}
                    stroke="var(--border)"
                    strokeOpacity={0.45}
                    strokeDasharray="3 4"
                  />
                  <text
                    x={PAD.left - 8}
                    y={yToPx(y)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-foreground"
                    fontSize={10}
                  >
                    {fmtPct(y)}
                  </text>
                </g>
              ))}

              {ticksX.map((x) => (
                <text
                  key={`x-${x}`}
                  x={xToPx(x)}
                  y={VIEW_H - PAD.bottom + 16}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize={10}
                >
                  {fmtPct(x)}
                </text>
              ))}

              <text
                x={(PAD.left + VIEW_W - PAD.right) / 2}
                y={VIEW_H - 4}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={10}
              >
                PORC. UTILIDAD
              </text>
              <text
                x={12}
                y={(PAD.top + VIEW_H - PAD.bottom) / 2}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={10}
                transform={`rotate(-90 12 ${(PAD.top + VIEW_H - PAD.bottom) / 2})`}
              >
                {etiquetaEjeY}
              </text>

              {lineasCategorias.map((linea) =>
                linea.visible ? (
                  <g key={linea.id}>
                    <line
                      x1={linea.xLinea}
                      y1={CAT_LINEA_Y_INICIO}
                      x2={linea.xLinea}
                      y2={yBottom}
                      stroke={linea.color}
                      strokeWidth={1.25}
                      strokeOpacity={0.65}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={linea.xLabel}
                      y={PAD.top + 9}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      className="fill-foreground"
                      fontSize={8}
                      fontWeight={600}
                      opacity={0.9}
                    >
                      {linea.etiqueta}
                    </text>
                    <text
                      x={linea.xLimiteSuperior}
                      y={PAD.top + 20}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      className="fill-foreground"
                      fontSize={8}
                      opacity={0.75}
                    >
                      {fmtPct(linea.porcLimiteSuperior)}
                    </text>
                  </g>
                ) : null
              )}

              {series.length === 1 && paths[0]?.d ? (
                <path
                  d={`${paths[0].d} L${xToPx(MC_GRAFICO_PORC_UTILIDAD_MAX).toFixed(2)},${yBottom.toFixed(2)} L${xToPx(MC_GRAFICO_PORC_UTILIDAD_MIN).toFixed(2)},${yBottom.toFixed(2)} Z`}
                  fill={`url(#mc-fill-${gradId})`}
                />
              ) : null}

              {paths.map((path) =>
                path.d ? (
                  <path
                    key={path.id}
                    d={path.d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={2.25}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null
              )}

              {marcas.length > 0 && marcaVerticalY != null ? (
                <g>
                  <line
                    x1={marcas[0]!.x}
                    y1={yBottom}
                    x2={marcas[0]!.x}
                    y2={marcaVerticalY}
                    stroke="var(--primary)"
                    strokeWidth={1.75}
                    strokeDasharray="5 4"
                  />
                  {marcas.map((marca) => (
                    <circle
                      key={marca.id}
                      cx={marca.x}
                      cy={marca.y}
                      r={4.5}
                      fill={marca.color}
                      stroke="var(--card)"
                      strokeWidth={1.5}
                    />
                  ))}
                </g>
              ) : null}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
