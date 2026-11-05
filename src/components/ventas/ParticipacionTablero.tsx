"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TableroVentasParticipacion } from "@/services/tableroVentas.service";

type VistaParticipacion = "global" | "anual" | "mensual";

const VISTAS: { id: VistaParticipacion; etiqueta: string }[] = [
  { id: "global", etiqueta: "GLOBAL" },
  { id: "anual", etiqueta: "ANUAL" },
  { id: "mensual", etiqueta: "MENSUAL" },
];

function esVistaParticipacion(valor: string): valor is VistaParticipacion {
  return valor === "global" || valor === "anual" || valor === "mensual";
}

function BarraParticipacion({ pct, tono }: { pct: number; tono: "mes" | "anio" }) {
  const ancho = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-3 min-w-0 flex-1 rounded-sm bg-muted" aria-hidden>
        <div
          className={tono === "mes" ? "h-full rounded-sm bg-primary" : "h-full rounded-sm bg-accent2"}
          style={{ width: `${ancho}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

export default function ParticipacionTablero({ filas }: { filas: TableroVentasParticipacion[] }) {
  const [vista, setVista] = useState<VistaParticipacion>("global");
  const muestraMes = vista === "global" || vista === "mensual";
  const muestraAnio = vista === "global" || vista === "anual";
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3">
      <h3 className="text-center text-xs font-bold uppercase tracking-wide">Participación</h3>
      <div className="flex justify-center">
        <Select
          value={vista}
          onValueChange={(valor) => {
            if (esVistaParticipacion(valor)) setVista(valor);
          }}
        >
          <SelectTrigger size="sm" className="w-fit min-w-40 uppercase" aria-label="Filtrar participación">
            <SelectValue />
          </SelectTrigger>
          <SelectContent searchable={false} className="select-content-filtro" position="popper" side="bottom" align="start">
            {VISTAS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-center gap-4">
        {muestraMes ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
            Mes
          </span>
        ) : null}
        {muestraAnio ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent2" aria-hidden />
            Año
          </span>
        ) : null}
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
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {muestraMes ? <BarraParticipacion pct={fila.pctMes} tono="mes" /> : null}
                {muestraAnio ? <BarraParticipacion pct={fila.pctAnio} tono="anio" /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
