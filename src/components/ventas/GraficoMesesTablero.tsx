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
import type { TableroVentasMesGrafico, TableroVentasSerieMes } from "@/services/tableroVentas.service";

/** Deja lugar arriba de la barra más alta para el total en millones. */
const ALTO_BARRA_MAX = 82;

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

export default function GraficoMesesTablero({ series }: { series: TableroVentasSerieMes[] }) {
  const [serieId, setSerieId] = useState("global");
  const serie = series.find((item) => item.id === serieId) ?? series[0];
  if (!serie) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Select value={serie.id} onValueChange={setSerieId}>
          <SelectTrigger
            size="sm"
            className="!h-6 w-fit min-w-0 gap-0.5 border-transparent bg-transparent px-0 py-0 text-[10px] font-normal uppercase tracking-wide text-muted-foreground shadow-none hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 [&_svg]:!size-3"
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
      </div>
      <BarrasMes meses={serie.meses} />
    </div>
  );
}
