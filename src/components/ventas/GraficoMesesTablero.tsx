"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtPrecio } from "@/lib/format";
import { TIMEZONE_ARGENTINA } from "@/lib/fechaArgentina";
import type {
  TableroVentasSerieDia,
  TableroVentasSerieMes,
  TableroVentasSerieSemana,
} from "@/services/tableroVentas.service";

/** Deja lugar arriba de la barra más alta para el total en millones. */
const ALTO_BARRA_MAX = 82;

/** Azul y amarillo de la marca. La primera sucursal, por nombre, lleva el azul. */
const COLORES_SUCURSAL = ["var(--primary)", "var(--accent2)"] as const;

type ModoGrafico = "dia" | "semana" | "mes";

const ETIQUETAS_SEMANA = [
  "LUNES",
  "MARTES",
  "MIÉRCOLES",
  "JUEVES",
  "VIERNES",
  "SÁBADO",
  "DOMINGO",
] as const;

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

/** `LUNES 02/11`. Mediodía UTC para no correr el día en Argentina. */
function etiquetaDiaSemana(anio: number, mes: number, dia: number): string {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 15, 0, 0));
  const weekday = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_ARGENTINA,
    weekday: "long",
  }).format(fecha);
  return `${weekday} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`.toLocaleUpperCase(
    "es"
  );
}

/** % entero de la sucursal sobre la suma de las sucursales de ese día. */
function pctSobreTotal(monto: number, total: number): number {
  if (total <= 0.009 || monto <= 0) return 0;
  return Math.round((monto / total) * 100);
}

function ventasDelDia(serie: TableroVentasSerieDia, dia: number): number {
  const punto = serie.dias.find((fila) => fila.dia === dia);
  return punto?.ventas ?? 0;
}

function etiquetaCantidadDias(n: number): string {
  return n === 1 ? "(1 día)" : `(${n} días)`;
}

function LineasDia({
  series,
  anio,
  mes,
}: {
  series: TableroVentasSerieDia[];
  anio: number;
  mes: number;
}) {
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
            const color = COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length];
            const totalDia = series.reduce((suma, item) => suma + ventasDelDia(item, dia.dia), 0);
            const titulo = etiquetaDiaSemana(anio, mes, dia.dia);
            return (
              <Tooltip key={`${serie.id}-${dia.dia}`}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                    style={{
                      left: `${xDeDia(dia.dia, nDias)}%`,
                      top: `${yDeMonto(dia.ventas, piso, techo)}%`,
                    }}
                    aria-label={titulo}
                  >
                    <span
                      className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-left leading-snug">
                  <p className="text-center font-bold">{titulo}</p>
                  <div className="grid grid-cols-[auto_auto_auto] justify-items-start gap-x-3 tabular-nums">
                    {series.map((item) => {
                      const monto = ventasDelDia(item, dia.dia);
                      return (
                        <Fragment key={item.id}>
                          <span>{item.etiqueta}</span>
                          <span>{pesos(monto)}</span>
                          <span>{`(${pctSobreTotal(monto, totalDia)}%)`}</span>
                        </Fragment>
                      );
                    })}
                  </div>
                </TooltipContent>
              </Tooltip>
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

const COLOR_BARRA_GLOBAL = "var(--primary)";
const VISTA_GLOBAL = "global";
const VISTA_COMPARATIVO = "comparativo";

function colorSucursal(indice: number): string {
  return COLORES_SUCURSAL[indice % COLORES_SUCURSAL.length] ?? COLOR_BARRA_GLOBAL;
}

type BarraGrafico = {
  key: string;
  monto: number;
  proyectado: number | null;
  color: string;
  titulo: string;
  tooltip: ReactNode | null;
};

type GrupoBarrasGrafico = {
  key: string;
  etiqueta: string;
  barras: BarraGrafico[];
};

function sumaPromediosSemana(
  series: TableroVentasSerieSemana[],
  indiceDia: number
): number | null {
  let suma = 0;
  let alguno = false;
  for (const serie of series) {
    const promedio = serie.dias[indiceDia]?.promedio;
    if (promedio == null) continue;
    suma += promedio;
    alguno = true;
  }
  return alguno ? suma : null;
}

function TooltipMontos({
  titulo,
  filas,
}: {
  titulo: string;
  filas: { id: string; nombre: string; monto: string; extra: string }[];
}) {
  return (
    <>
      <p className="text-center font-bold">{titulo}</p>
      <div className="grid grid-cols-[auto_auto_auto] justify-items-start gap-x-3 tabular-nums">
        {filas.map((fila) => (
          <Fragment key={fila.id}>
            <span>{fila.nombre}</span>
            <span>{fila.monto}</span>
            <span>{fila.extra}</span>
          </Fragment>
        ))}
      </div>
    </>
  );
}

function gruposSemana(
  series: TableroVentasSerieSemana[],
  vista: string
): GrupoBarrasGrafico[] {
  const etiquetas = series[0]?.dias.map((dia) => dia.etiqueta) ?? [...ETIQUETAS_SEMANA];
  const activas =
    vista === VISTA_GLOBAL || vista === VISTA_COMPARATIVO
      ? series
      : series.filter((serie) => serie.id === vista);
  return etiquetas.map((etiqueta, indiceDia) => {
    if (vista === VISTA_GLOBAL) {
      const suma = sumaPromediosSemana(series, indiceDia);
      return {
        key: etiqueta,
        etiqueta,
        barras: [
          {
            key: VISTA_GLOBAL,
            monto: suma ?? 0,
            proyectado: null,
            color: COLOR_BARRA_GLOBAL,
            titulo: etiqueta,
            tooltip: (
              <TooltipMontos
                titulo={etiqueta}
                filas={[
                  {
                    id: VISTA_GLOBAL,
                    nombre: "GLOBAL",
                    monto: suma == null ? "" : pesos(suma),
                    extra: "",
                  },
                  ...series.map((serie) => {
                    const punto = serie.dias[indiceDia];
                    return {
                      id: serie.id,
                      nombre: serie.etiqueta,
                      monto: punto?.promedio == null ? "" : pesos(punto.promedio),
                      extra: etiquetaCantidadDias(punto?.dias ?? 0),
                    };
                  }),
                ]}
              />
            ),
          },
        ],
      };
    }
    return {
      key: etiqueta,
      etiqueta,
      barras: activas.map((serie) => {
        const punto = serie.dias[indiceDia];
        const indiceColor = series.findIndex((item) => item.id === serie.id);
        return {
          key: serie.id,
          monto: punto?.promedio ?? 0,
          proyectado: null,
          color: colorSucursal(indiceColor),
          titulo: `${etiqueta} ${serie.etiqueta}`,
          tooltip: (
            <TooltipMontos
              titulo={etiqueta}
              filas={[
                {
                  id: serie.id,
                  nombre: serie.etiqueta,
                  monto: punto?.promedio == null ? "" : pesos(punto.promedio),
                  extra: etiquetaCantidadDias(punto?.dias ?? 0),
                },
              ]}
            />
          ),
        };
      }),
    };
  });
}

function tituloMes(etiqueta: string, ventas: number, proyectado: number | null): string {
  if (proyectado != null && proyectado > 0) {
    return `${etiqueta} vendido ${pesos(ventas)}, proyectado ${pesos(proyectado)}`;
  }
  if (ventas > 0) return `${etiqueta} ${pesos(ventas)}`;
  return etiqueta;
}

function gruposMes(series: TableroVentasSerieMes[], vista: string): GrupoBarrasGrafico[] {
  const sucursales = series.filter((serie) => serie.id !== VISTA_GLOBAL);
  const activas =
    vista === VISTA_COMPARATIVO
      ? sucursales
      : series.filter((serie) => serie.id === (vista === VISTA_GLOBAL ? VISTA_GLOBAL : vista));
  const meses = (activas[0] ?? series[0])?.meses ?? [];
  return meses.map((mes, indiceMes) => ({
    key: String(mes.mes),
    etiqueta: mes.etiqueta,
    barras: activas.map((serie) => {
      const punto = serie.meses[indiceMes];
      const ventas = punto?.ventas ?? 0;
      const proyectado = punto?.proyectado ?? null;
      const indiceColor = sucursales.findIndex((item) => item.id === serie.id);
      return {
        key: serie.id,
        monto: ventas,
        proyectado,
        color: serie.id === VISTA_GLOBAL ? COLOR_BARRA_GLOBAL : colorSucursal(indiceColor),
        titulo: tituloMes(mes.etiqueta, ventas, proyectado),
        tooltip: null,
      };
    }),
  }));
}

function BarrasGrupos({ grupos }: { grupos: GrupoBarrasGrafico[] }) {
  const techo = grupos.reduce((max, grupo) => {
    for (const barra of grupo.barras) {
      const candidato = Math.max(barra.monto, barra.proyectado ?? 0);
      if (candidato > max) max = candidato;
    }
    return max;
  }, 0);
  const altoDe = (monto: number) =>
    techo <= 0 || monto <= 0 ? 0 : (monto / techo) * ALTO_BARRA_MAX;
  return (
    <div className="flex h-full min-h-0 flex-1 items-end gap-2">
      {grupos.map((grupo) => (
        <div key={grupo.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
          <div className="flex min-h-0 w-full flex-1 items-stretch gap-0.5">
            {grupo.barras.map((barra) => {
              const altoVendido = altoDe(barra.monto);
              const altoProyectado =
                barra.proyectado == null || barra.proyectado <= 0
                  ? null
                  : altoDe(barra.proyectado);
              const montoEtiqueta =
                barra.proyectado != null && barra.proyectado > 0 ? barra.proyectado : barra.monto;
              const etiqueta = montoEtiqueta > 0 ? etiquetaMillones(montoEtiqueta) : null;
              const altoEtiqueta = altoProyectado ?? altoVendido;
              const columna = (
                <div className="relative h-full min-w-0 flex-1" title={barra.titulo}>
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
                      className="absolute inset-x-0 bottom-0 rounded-sm"
                      style={{ height: `${altoVendido}%`, backgroundColor: barra.color }}
                    />
                  ) : null}
                  {altoProyectado != null ? (
                    <div
                      className="absolute inset-x-0 bottom-0 border-x-2 border-t-2 border-dotted border-foreground"
                      style={{ height: `${altoProyectado}%` }}
                    />
                  ) : null}
                </div>
              );
              if (barra.tooltip == null) return <Fragment key={barra.key}>{columna}</Fragment>;
              return (
                <Tooltip key={barra.key}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex h-full min-w-0 flex-1 cursor-pointer"
                      aria-label={barra.titulo}
                    >
                      {columna}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-left leading-snug">
                    {barra.tooltip}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <span className="text-center text-[9px] font-semibold uppercase leading-none tracking-tight">
            {grupo.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}

function LeyendaProyectado() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
      <span
        className="h-2.5 w-2.5 border-x-2 border-t-2 border-dotted border-foreground"
        aria-hidden
      />
      Proyectado
    </span>
  );
}

function LeyendaBarras({
  items,
}: {
  items: { id: string; etiqueta: string; color: string }[];
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.etiqueta}
        </span>
      ))}
    </div>
  );
}

export default function GraficoMesesTablero({
  series,
  seriesDias = [],
  seriesSemana = [],
  anio,
  mes,
}: {
  series: TableroVentasSerieMes[];
  seriesDias?: TableroVentasSerieDia[];
  seriesSemana?: TableroVentasSerieSemana[];
  anio: number;
  mes: number;
}) {
  const [modo, setModo] = useState<ModoGrafico>("dia");
  const [vistaId, setVistaId] = useState(VISTA_GLOBAL);
  const sucursales = series.filter((item) => item.id !== VISTA_GLOBAL);
  const vista =
    vistaId === VISTA_COMPARATIVO ||
    vistaId === VISTA_GLOBAL ||
    sucursales.some((item) => item.id === vistaId) ||
    seriesSemana.some((item) => item.id === vistaId)
      ? vistaId
      : VISTA_GLOBAL;
  if (series.length === 0 && seriesDias.length === 0 && seriesSemana.length === 0) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Select
            value={modo}
            onValueChange={(valor) => {
              if (valor === "dia" || valor === "semana" || valor === "mes") setModo(valor);
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
              <SelectItem value="semana">SEM</SelectItem>
              <SelectItem value="mes">MES</SelectItem>
            </SelectContent>
          </Select>
          {modo === "semana" || modo === "mes" ? (
            <Select value={vista} onValueChange={setVistaId}>
              <SelectTrigger
                size="sm"
                className="tablero-grafico-filtro w-fit min-w-0"
                aria-label="Filtrar gráfico por sucursal"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent searchable={false} className="select-content-filtro" position="popper" side="bottom" align="start">
                <SelectItem value={VISTA_GLOBAL}>GLOBAL</SelectItem>
                <SelectItem value={VISTA_COMPARATIVO}>COMPARATIVO</SelectItem>
                {(modo === "semana" ? seriesSemana : sucursales).map((item) => (
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
                    style={{ backgroundColor: colorSucursal(indice) }}
                  />
                  <span
                    className="w-full border-t border-dotted"
                    style={{ borderTopColor: colorSucursal(indice) }}
                  />
                </span>
                {item.etiqueta}
              </span>
            ))}
          </div>
        ) : modo === "semana" ? (
          <LeyendaBarras
            items={
              vista === VISTA_GLOBAL
                ? [{ id: VISTA_GLOBAL, etiqueta: "GLOBAL", color: COLOR_BARRA_GLOBAL }]
                : vista === VISTA_COMPARATIVO
                  ? seriesSemana.map((item, indice) => ({
                      id: item.id,
                      etiqueta: item.etiqueta,
                      color: colorSucursal(indice),
                    }))
                  : seriesSemana
                      .filter((item) => item.id === vista)
                      .map((item) => ({
                        id: item.id,
                        etiqueta: item.etiqueta,
                        color: colorSucursal(seriesSemana.findIndex((serie) => serie.id === item.id)),
                      }))
            }
          />
        ) : vista === VISTA_COMPARATIVO ? (
          <div className="flex items-center justify-end gap-3">
            <LeyendaBarras
              items={sucursales.map((item, indice) => ({
                id: item.id,
                etiqueta: item.etiqueta,
                color: colorSucursal(indice),
              }))}
            />
            <LeyendaProyectado />
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{
                  backgroundColor:
                    vista === VISTA_GLOBAL
                      ? COLOR_BARRA_GLOBAL
                      : colorSucursal(sucursales.findIndex((item) => item.id === vista)),
                }}
                aria-hidden
              />
              Vendido
            </span>
            <LeyendaProyectado />
          </div>
        )}
      </div>
      {modo === "dia" ? (
        <LineasDia series={seriesDias} anio={anio} mes={mes} />
      ) : modo === "semana" ? (
        <BarrasGrupos grupos={gruposSemana(seriesSemana, vista)} />
      ) : (
        <BarrasGrupos grupos={gruposMes(series, vista)} />
      )}
    </div>
  );
}
