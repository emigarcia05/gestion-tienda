"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import {
  ajustarRangoHorarioEnvio,
  esHoraEnvioValida,
  horasDesdeDisponiblesParaFecha,
  horasHastaDisponibles,
  type EnviosHoraValue,
} from "@/lib/envios";

function abrirSelectorFechaNativo(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    void el.showPicker?.();
  } catch {
    el.click();
  }
}

interface Props {
  fechaIso: string;
  horaDesde: EnviosHoraValue | "";
  horaHasta: EnviosHoraValue | "";
  disabled?: boolean;
  onFechaChange: (iso: string) => void;
  onHoraDesdeChange: (hora: EnviosHoraValue | "") => void;
  onHoraHastaChange: (hora: EnviosHoraValue | "") => void;
}

export default function EnviosFechaHorarioCampos({
  fechaIso,
  horaDesde,
  horaHasta,
  disabled = false,
  onFechaChange,
  onHoraDesdeChange,
  onHoraHastaChange,
}: Props) {
  const hiddenFechaRef = useRef<HTMLInputElement>(null);
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const mananaIso = addDaysToIsoYmdArgentina(hoyIso, 1);
  const fechaOtra = fechaIso !== "" && fechaIso !== hoyIso && fechaIso !== mananaIso;
  const opcionesDesde = horasDesdeDisponiblesParaFecha(fechaIso);
  const opcionesHasta =
    horaDesde !== "" ? horasHastaDisponibles(horaDesde) : [];

  function aplicarFecha(iso: string) {
    onFechaChange(iso);
    const ajustado = ajustarRangoHorarioEnvio(iso, horaDesde, horaHasta);
    if (!ajustado) {
      onHoraDesdeChange("");
      onHoraHastaChange("");
      return;
    }
    onHoraDesdeChange(ajustado.horaDesde);
    onHoraHastaChange(ajustado.horaHasta);
  }

  function handleDesde(value: string) {
    if (!esHoraEnvioValida(value)) return;
    if (!opcionesDesde.includes(value)) return;
    onHoraDesdeChange(value);
    const ajustado = ajustarRangoHorarioEnvio(fechaIso, value, horaHasta);
    if (!ajustado) {
      onHoraHastaChange("");
      return;
    }
    onHoraHastaChange(ajustado.horaHasta);
  }

  function handleHasta(value: string) {
    if (!esHoraEnvioValida(value) || horaDesde === "" || value <= horaDesde) return;
    onHoraHastaChange(value);
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full flex-col items-center gap-2">
        <ModalMicroLabel align="center">FECHA</ModalMicroLabel>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant={fechaIso === hoyIso ? "default" : "outline"}
            disabled={disabled}
            onClick={() => aplicarFecha(hoyIso)}
          >
            HOY
          </Button>
          <Button
            type="button"
            variant={fechaIso === mananaIso ? "default" : "outline"}
            disabled={disabled}
            onClick={() => aplicarFecha(mananaIso)}
          >
            MAÑANA
          </Button>
          <Button
            type="button"
            variant={fechaOtra ? "default" : "outline"}
            size="icon"
            disabled={disabled}
            className="size-9 shrink-0"
            onClick={() => abrirSelectorFechaNativo(hiddenFechaRef.current)}
            aria-label="Abrir calendario"
            title="Abrir calendario"
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
          <input
            ref={hiddenFechaRef}
            type="date"
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            value={fechaIso}
            min={hoyIso}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              if (v) aplicarFecha(v);
            }}
          />
        </div>
        {fechaIso ? (
          <p className="text-sm tabular-nums text-foreground">
            {formatIsoYmdDdMmYyyyArgentina(fechaIso)}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        <ModalMicroLabel align="center">RANGO HORARIO</ModalMicroLabel>
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <ModalMicroLabel className="w-auto shrink-0">HORA DESDE</ModalMicroLabel>
            <Select
              value={horaDesde || undefined}
              disabled={disabled || opcionesDesde.length === 0}
              onValueChange={handleDesde}
            >
              <SelectTrigger className="min-w-28 tabular-nums" aria-label="Hora desde">
                <SelectValue placeholder="DESDE..." />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="center">
                {opcionesDesde.map((hora) => (
                  <SelectItem key={hora} value={hora} className="tabular-nums">
                    {hora}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-foreground" aria-hidden>
            -
          </span>
          <div className="flex items-center gap-2">
            <ModalMicroLabel className="w-auto shrink-0">HORA HASTA</ModalMicroLabel>
            <Select
              value={horaHasta || undefined}
              disabled={disabled || horaDesde === "" || opcionesHasta.length === 0}
              onValueChange={handleHasta}
            >
              <SelectTrigger className="min-w-28 tabular-nums" aria-label="Hora hasta">
                <SelectValue placeholder="HASTA..." />
              </SelectTrigger>
              <SelectContent className="select-content-filtro" position="popper" side="bottom" align="center">
                {opcionesHasta.map((hora) => (
                  <SelectItem key={hora} value={hora} className="tabular-nums">
                    {hora}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
