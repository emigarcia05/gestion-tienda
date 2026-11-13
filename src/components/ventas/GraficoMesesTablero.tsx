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
import type {
  TableroVentasDiaGrafico,
  TableroVentasMesGrafico,
  TableroVentasSerieDia,
  TableroVentasSerieMes,
} from "@/services/tableroVentas.service";

/** Deja lugar arriba de la barra más alta para el total en millones. */
const ALTO_BARRA_MAX = 82;

/** Azul y amarillo de la marca. La primera sucursal, por nombre, lleva el azul. */
const COLORES_SUCURSAL = ["var(--primary)", "var(--accent2)"] as const;

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

/** Marcas del eje del gráfico por día: de a medio millón. */
const PASO_EJE_MILLON = 500_000;

/** 0 → `0 M`, 500.000 → `0,5 M`, 1.000.000 → `1 M`. */
function etiquetaPasoMillon(monto: number): string {
  const millones = monto / 1_000_000;
  const entero = Math.abs(millones - Math.round(millones)) < 0.001;
  const texto = millones.toLocaleString("es-AR", {
    minimumFractionDigits: entero ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return `${texto} M`;
}

function escalaEjeMillon(maximo: number, minimo: number): {
  piso: number;
  techo: number;
  ticks: number[];
} {
  const techo =
    maximo <= 0.009
      ? PASO_EJE_MILLON
      : Math.ceil((maximo - 0.009) / PASO_EJE_MILLON) * PASO_EJE_MILLON;
  const piso =
    minimo >= -0.009 ? 0 : Math.floor((minimo + 0.009) / PASO_EJE_MILLON) * PASO_EJE_MILLON;
  const pasos = Math.round((techo - piso) / PASO_EJE_MILLON);
  const ticks: number[] = [];
  for (let indice = pasos; indice >= 0; indice -= 1) {
    ticks.push(piso + indice * PASO_EJE_MILLON);
  }
  return { piso, techo, ticks };
}

function xDeDia(dia: number, nDias: number): number {
  if (nDias <= 1) return 50;
  return ((dia - 1) / (nDias - 1)) * 100;
}

function yDeMonto(monto: number, piso: number, techo: number): number {
  const rango = techo - piso;
  if (rango <= 0.009) return 98;
  return 2 + ((techo - monto) / rango) * 96;
}

function tituloDia(dia: TableroVentasDiaGrafico, series: TableroVentasSerieDia[]): string {
  const partes = series.flatMap((serie) => {
    const punto = serie.dias.find((fila) => fila.dia === dia.dia);
    if (punto?.ventas == null) return [];
    return [`${serie.etiqueta} ${pesos(punto.ventas)}, promedio ${pesos(serie.promedio)}`];
  });
  return `${dia.dia}: ${partes.join(" · ")}`;
}

function LineasDia({ series }: { series: TableroVentasSerieDia[] }) {
  const dias = series[0]?.dias ?? [];
  const montos = series.flatMap((serie) => [
    ...serie.dias.flatMap((dia) => (dia.ventas == null ? [] : [dia.ventas])),
    ...(serie.promedio > 0.009 ? [serie.promedio] : []),
  ]);
  const maximo = montos.reduce((max, monto) => (monto > max ? monto : max), 0);
  const minimo = montos.reduce((min, monto) => (monto < min ? monto : min), 0);
  const { piso, techo, ticks } = escalaEjeMillon(maximo, minimo);
  const nDias = Math.max(dias.length, 1);
  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-[4.25rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-1">
      <div className="relative min-h-0 text-right text-[10px] font-semibold tabular-nums leading-none">
        {ticks.map((monto) => (
          <span
            key={monto}
            className="absolute right-0 -translate-y-1/2"
            style={{ top: `${yDeMonto(monto, piso, techo)}%` }}
          >
            {etiquetaPasoMillon(monto)}
          </span>
        ))}
      </div>
      <div className="relative min-h-0">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {ticks.map((monto) => (
            <line
              key={monto}
              x1="0"
              x2="100"
              y1={yDeMonto(monto, piso, techo)}
              y2={yDeMonto(monto, piso, techo)}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {series.map((serie, indice) => {
            const puntos = serie.dias.flatMap((dia) => {
              if (dia.ventas == null) return [];
              const x = xDeDia(dia.dia, nDias);
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
        {series.map((serie, indice) => {
          if (serie.promedio <= 0.009) return null;
          const color = COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length];
          return (
            <div
              key={`${serie.id}-promedio`}
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dotted"
              style={{
                top: `${yDeMonto(serie.promedio, piso, techo)}%`,
                borderTopColor: color,
              }}
            />
          );
        })}
        {series.map((serie, indice) =>
          serie.dias.map((dia) => {
            if (dia.ventas == null) return null;
            const fila = dias.find((item) => item.dia === dia.dia);
            const color = COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length];
            return (
              <div
                key={`${serie.id}-${dia.dia}`}
                className="absolute z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{
                  left: `${xDeDia(dia.dia, nDias)}%`,
                  top: `${yDeMonto(dia.ventas, piso, techo)}%`,
                }}
                title={fila ? tituloDia(fila, series) : undefined}
              >
                <span
                  className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                  style={{ backgroundColor: color }}
                />
              </div>
            );
          })
        )}
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
              <SelectItem value="dia">DIA</SelectItem>
              <SelectItem value="mes">MES</SelectItem>
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
                <span className="inline-flex w-3 flex-col justify-center gap-0.5" aria-hidden>
                  <span
                    className="h-0.5 w-full"
                    style={{ backgroundColor: COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length] }}
                  />
                  <span
                    className="w-full border-t border-dotted"
                    style={{ borderTopColor: COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length] }}
                  />
                </span>
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
