"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  TableroVentasDiaGrafico,
  TableroVentasMesGrafico,
  TableroVentasSerieDia,
  TableroVentasSerieMes,
} from "@/services/tableroVentas.service";

/** Deja lugar arriba de la barra más alta para el total en millones. */
const ALTO_BARRA_MAX = 82;

const COLORES_SUCURSAL = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
] as const;

type ModoGrafico = "dia" | "mes";

function pesos(n: number): string {
  return `$${fmtPrecio(n)}`;
}

/** $4.523.123 → 4,5 M. Un decimal, separador es-AR. */
function etiquetaMillones(monto: number): string {
  const texto = (monto / 1_000_000).toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${texto} M`;
}

function etiquetaEje(monto: number): string {
  if (Math.abs(monto) >= 1_000_000) return etiquetaMillones(monto);
  return pesos(monto);
}

function yDeMonto(monto: number, piso: number, techo: number): number {
  const rango = techo - piso;
  if (rango <= 0.009) return 98;
  return 2 + ((techo - monto) / rango) * 96;
}

function tituloDia(dia: TableroVentasDiaGrafico, series: TableroVentasSerieDia[]): string {
  const partes = series.map((serie) => {
    const punto = serie.dias.find((fila) => fila.dia === dia.dia);
    if (punto?.ventas == null) return `${serie.etiqueta} —`;
    return `${serie.etiqueta} ${pesos(punto.ventas)}`;
  });
  return `${dia.dia}: ${partes.join(" · ")}`;
}

function LineasDia({ series }: { series: TableroVentasSerieDia[] }) {
  const dias = series[0]?.dias ?? [];
  const montos = series.flatMap((serie) =>
    serie.dias.flatMap((dia) => (dia.ventas == null ? [] : [dia.ventas]))
  );
  const techo = montos.reduce((max, monto) => (monto > max ? monto : max), 0);
  const piso = montos.reduce((min, monto) => (monto < min ? monto : min), 0);
  const rango = techo - piso;
  const ticks =
    rango <= 0.009
      ? [etiquetaEje(0)]
      : [etiquetaEje(techo), etiquetaEje((techo + piso) / 2), etiquetaEje(piso)];
  const nDias = Math.max(dias.length, 1);
  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-[4.25rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-1">
      <div
        className={cn(
          "flex flex-col py-0.5 text-right text-[10px] font-semibold tabular-nums leading-none",
          ticks.length === 1 ? "justify-end" : "justify-between"
        )}
      >
        {ticks.map((tick, indice) => (
          <span key={`${tick}-${indice}`}>{tick}</span>
        ))}
      </div>
      <div className="relative min-h-0">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {[2, 50, 98].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {series.map((serie, indice) => {
            const puntos = serie.dias.flatMap((dia) => {
              if (dia.ventas == null) return [];
              const x = nDias === 1 ? 50 : ((dia.dia - 1) / (nDias - 1)) * 100;
              return [`${x},${yDeMonto(dia.ventas, piso, techo)}`];
            });
            if (puntos.length === 0) return null;
            return (
              <polyline
                key={serie.id}
                fill="none"
                stroke={COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={puntos.join(" ")}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex">
          {dias.map((dia) => (
            <div key={dia.dia} className="min-w-0 flex-1" title={tituloDia(dia, series)} />
          ))}
        </div>
      </div>
      <span />
      <div className="flex pt-1">
        {dias.map((dia) => (
          <span
            key={dia.dia}
            className="min-w-0 flex-1 text-center text-[9px] font-semibold tabular-nums leading-none"
          >
            {dia.dia}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarrasMes({ meses }: { meses: TableroVentasMesGrafico[] }) {
  const techo = meses.reduce((max, mes) => {
    const candidato = Math.max(mes.ventas, mes.proyectado ?? 0);
    return candidato > max ? candidato : max;
  }, 0);
  const altoDe = (monto: number) =>
    techo <= 0 || monto <= 0 ? 0 : (monto / techo) * ALTO_BARRA_MAX;
  return (
    <div className="flex h-full min-h-0 flex-1 items-end gap-2">
      {meses.map((mes) => {
        const altoVendido = altoDe(mes.ventas);
        const altoProyectado =
          mes.proyectado == null || mes.proyectado <= 0 ? null : altoDe(mes.proyectado);
        const montoEtiqueta =
          mes.proyectado != null && mes.proyectado > 0 ? mes.proyectado : mes.ventas;
        const etiqueta = montoEtiqueta > 0 ? etiquetaMillones(montoEtiqueta) : null;
        const altoEtiqueta = altoProyectado ?? altoVendido;
        const titulo =
          mes.proyectado != null && mes.proyectado > 0
            ? `${mes.etiqueta} vendido ${pesos(mes.ventas)}, proyectado ${pesos(mes.proyectado)}`
            : mes.ventas > 0
              ? `${mes.etiqueta} ${pesos(mes.ventas)}`
              : mes.etiqueta;
        return (
          <div key={mes.mes} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={titulo}>
            <div className="relative min-h-0 w-full flex-1">
              {etiqueta != null && altoEtiqueta > 0 ? (
                <span
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap pb-0.5 text-[10px] font-semibold leading-none tabular-nums"
                  style={{ bottom: `${altoEtiqueta}%` }}
                >
                  {etiqueta}
                </span>
              ) : null}
              {altoVendido > 0 ? (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-sm bg-primary"
                  style={{ height: `${altoVendido}%` }}
                />
              ) : null}
              {altoProyectado != null ? (
                <div
                  className="absolute inset-x-0 bottom-0 border-x-2 border-t-2 border-dotted border-foreground"
                  style={{ height: `${altoProyectado}%` }}
                />
              ) : null}
            </div>
            <span className="text-center text-[10px] font-semibold uppercase tracking-wide">
              {mes.etiqueta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GraficoMesesTablero({
  series,
  seriesDias = [],
}: {
  series: TableroVentasSerieMes[];
  seriesDias?: TableroVentasSerieDia[];
}) {
  const [modo, setModo] = useState<ModoGrafico>("dia");
  const [serieId, setSerieId] = useState("global");
  const serie = series.find((item) => item.id === serieId) ?? series[0];
  if (!serie && seriesDias.length === 0) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Select
            value={modo}
            onValueChange={(valor) => {
              if (valor === "dia" || valor === "mes") setModo(valor);
            }}
          >
            <SelectTrigger
              size="sm"
              className="tablero-grafico-filtro w-fit min-w-0"
              aria-label="Tipo de gráfico"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent searchable={false} className="select-content-filtro" position="popper" side="bottom" align="start">
              <SelectItem value="dia">Por día</SelectItem>
              <SelectItem value="mes">Por mes</SelectItem>
            </SelectContent>
          </Select>
          {modo === "mes" && serie ? (
            <Select value={serie.id} onValueChange={setSerieId}>
              <SelectTrigger
                size="sm"
                className="tablero-grafico-filtro w-fit min-w-0"
                aria-label="Filtrar gráfico por sucursal"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent searchable={false} className="select-content-filtro" position="popper" side="bottom" align="start">
                {series.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {modo === "dia" ? (
          <div className="flex items-center justify-end gap-3">
            {seriesDias.map((item, indice) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
              >
                <span
                  className="h-0.5 w-3 shrink-0"
                  style={{ backgroundColor: COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length] }}
                  aria-hidden
                />
                {item.etiqueta}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
              Vendido
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
              <span className="h-2.5 w-2.5 border-x-2 border-t-2 border-dotted border-foreground" aria-hidden />
              Proyectado
            </span>
          </div>
        )}
      </div>
      {modo === "dia" ? <LineasDia series={seriesDias} /> : serie ? <BarrasMes meses={serie.meses} /> : null}
    </div>
  );
}
