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
import type { TableroVentasParticipacion } from "@/services/tableroVentas.service";

const SUCURSAL_TODAS = "global";

type MedidaParticipacion = "porcentaje" | "monto";

function esMedida(valor: string): valor is MedidaParticipacion {
  return valor === "porcentaje" || valor === "monto";
}

function BarraParticipacion({
  pct,
  monto,
  tono,
  medida,
}: {
  pct: number;
  monto: number;
  tono: "mes" | "anio";
  medida: MedidaParticipacion;
}) {
  const ancho = Math.min(100, Math.max(0, pct));
  const texto = medida === "monto" ? `$${fmtPrecio(monto)}` : `${pct}%`;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-3 min-w-0 flex-1 rounded-sm bg-muted" aria-hidden>
        <div
          className={tono === "mes" ? "h-full rounded-sm bg-primary" : "h-full rounded-sm bg-accent2"}
          style={{ width: `${ancho}%` }}
        />
      </div>
      <span
        className={
          medida === "monto"
            ? "w-24 shrink-0 text-right text-xs font-semibold tabular-nums"
            : "w-10 shrink-0 text-right text-xs font-semibold tabular-nums"
        }
      >
        {texto}
      </span>
    </div>
  );
}

export default function ParticipacionTablero({ filas }: { filas: TableroVentasParticipacion[] }) {
  const [sucursalId, setSucursalId] = useState(SUCURSAL_TODAS);
  const [medida, setMedida] = useState<MedidaParticipacion>("porcentaje");
  const sucursalValida = sucursalId === SUCURSAL_TODAS || filas.some((fila) => fila.id === sucursalId);
  const sucursal = sucursalValida ? sucursalId : SUCURSAL_TODAS;
  const visibles = sucursal === SUCURSAL_TODAS ? filas : filas.filter((fila) => fila.id === sucursal);

  return (
    <div className="grid h-full min-h-0 grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
      <div className="flex flex-col gap-2">
        <Select value={sucursal} onValueChange={setSucursalId}>
          <SelectTrigger size="sm" className="w-full uppercase" aria-label="Filtrar por sucursal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent searchable={false} className="select-content-filtro" position="popper" side="bottom" align="start">
            <SelectItem value={SUCURSAL_TODAS}>GLOBAL</SelectItem>
            {filas.map((fila) => (
              <SelectItem key={fila.id} value={fila.id}>
                {fila.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={medida}
          onValueChange={(valor) => {
            if (esMedida(valor)) setMedida(valor);
          }}
        >
          <SelectTrigger size="sm" className="w-full uppercase" aria-label="Porcentaje o monto">
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
            <span className="h-2.5 w-2.5 rounded-sm bg-accent2" aria-hidden />
            Año
          </span>
        </div>
        {visibles.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Sin ventas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibles.map((fila) => (
              <li key={fila.id} className="flex min-w-0 items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs font-semibold" title={fila.nombre}>
                  {fila.nombre}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <BarraParticipacion pct={fila.pctMes} monto={fila.montoMes} tono="mes" medida={medida} />
                  <BarraParticipacion pct={fila.pctAnio} monto={fila.montoAnio} tono="anio" medida={medida} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
