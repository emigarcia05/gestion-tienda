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
import type { TableroVentasParticipacion } from "@/services/tableroVentas.service";

type MedidaParticipacion = "porcentaje" | "monto";

function esMedida(valor: string): valor is MedidaParticipacion {
  return valor === "porcentaje" || valor === "monto";
}

function BarraParticipacion({
  pct,
  monto,
  pctPromedio,
  montoPromedio,
  medida,
}: {
  pct: number;
  monto: number;
  pctPromedio: number;
  montoPromedio: number;
  medida: MedidaParticipacion;
}) {
  const ancho = Math.min(100, Math.max(0, pct));
  const marca = Math.min(100, Math.max(0, pctPromedio));
  const texto = medida === "monto" ? `$${fmtPrecio(monto)}` : `${pct}%`;
  const diferencia =
    medida === "monto"
      ? diferenciaConSigno(Math.round(monto - montoPromedio), `$${fmtPrecio(Math.abs(monto - montoPromedio))}`)
      : diferenciaConSigno(
          Math.round((pct - pctPromedio) * 10) / 10,
          Math.abs(pct - pctPromedio).toLocaleString("es-AR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })
        );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative h-3 min-w-0 flex-1 rounded-sm bg-muted" aria-hidden>
        <div className="h-full rounded-sm bg-primary" style={{ width: `${ancho}%` }} />
        {marca > ancho ? (
          <div
            className="absolute inset-y-0 bg-accent2/40"
            style={{ left: `${ancho}%`, width: `${marca - ancho}%` }}
          />
        ) : null}
        {marca > 0 ? (
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent2"
            style={{ left: `${marca}%` }}
            title={`Promedio $${fmtPrecio(montoPromedio)}`}
          />
        ) : null}
      </div>
      <span
        className={
          medida === "monto"
            ? "w-24 shrink-0 text-right text-xs font-semibold tabular-nums"
            : "w-12 shrink-0 text-right text-xs font-semibold tabular-nums"
        }
      >
        <span className="block">{texto}</span>
        <span
          className={cn(
            "block text-[10px] font-semibold leading-none",
            diferencia.tono === "mas" && "text-primary",
            diferencia.tono === "menos" && "text-destructive",
            diferencia.tono === "igual" && "text-muted-foreground"
          )}
          title="Mes menos el promedio"
        >
          {diferencia.texto}
        </span>
      </span>
    </div>
  );
}

function diferenciaConSigno(
  valor: number,
  cuerpo: string
): { texto: string; tono: "mas" | "menos" | "igual" } {
  if (valor === 0) return { texto: "IGUAL", tono: "igual" };
  return { texto: `${valor > 0 ? "+" : "−"}${cuerpo}`, tono: valor > 0 ? "mas" : "menos" };
}

export default function ParticipacionTablero({ filas }: { filas: TableroVentasParticipacion[] }) {
  const [medida, setMedida] = useState<MedidaParticipacion>("monto");

  return (
    <div className="grid h-full min-h-0 grid-cols-[7rem_minmax(0,1fr)] items-start gap-4">
      <div className="flex flex-col gap-2">
        <Select
          value={medida}
          onValueChange={(valor) => {
            if (esMedida(valor)) setMedida(valor);
          }}
        >
          <SelectTrigger size="sm" className="tablero-grafico-filtro w-full" aria-label="Porcentaje o monto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent searchable={false} className="select-content-filtro" position="popper" side="bottom" align="start">
            <SelectItem value="porcentaje">PORCENTAJE</SelectItem>
            <SelectItem value="monto">MONTO</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-center gap-4">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
            Mes
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <span className="h-2.5 w-0.5 bg-accent2" aria-hidden />
            Promedio
          </span>
        </div>
        {filas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Sin ventas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {filas.map((fila) => (
              <li key={fila.id} className="flex min-w-0 items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs font-semibold" title={fila.nombre}>
                  {fila.nombre}
                </span>
                <BarraParticipacion
                  pct={fila.pctMes}
                  monto={fila.montoMes}
                  pctPromedio={fila.pctPromedio}
                  montoPromedio={fila.montoPromedio}
                  medida={medida}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
