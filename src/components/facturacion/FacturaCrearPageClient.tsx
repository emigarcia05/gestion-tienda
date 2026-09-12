"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FacturaCrearLineasBlock from "@/components/facturacion/FacturaCrearLineasBlock";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACTURA_TIPOS,
  FACTURA_TIPO_DEFAULT,
  FACTURA_TIPO_LABELS,
  esFacturaTipo,
  type FacturaTipo,
} from "@/lib/factura";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { cn } from "@/lib/utils";

function abrirSelectorFechaNativo(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    void el.showPicker?.();
  } catch {
    el.click();
  }
}

/**
 * Pantalla Crear (Facturación · Factura): cabecera + líneas de remito.
 * Persistencia pendiente; estado local únicamente.
 */
export default function FacturaCrearPageClient() {
  const hiddenFechaRef = useRef<HTMLInputElement>(null);
  const [fechaIso, setFechaIso] = useState(() => dateToIsoYmdArgentina(new Date()));
  const [tipo, setTipo] = useState<FacturaTipo>(FACTURA_TIPO_DEFAULT);
  const [cliente, setCliente] = useState("");

  return (
    <ClassicFilteredTableLayout title="FACTURA" subtitle="Crear" contentWidth="full">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-4">
        {/* Cabecera del comprobante */}
        <div className="shrink-0 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-3 gap-4">
            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>FECHA</ModalMicroLabel>
              <div className="relative w-full">
                <Input
                  type="text"
                  readOnly
                  value={formatIsoYmdDdMmYyyyArgentina(fechaIso)}
                  className={cn("tabular-nums", "pr-10", "cursor-pointer")}
                  onClick={() => abrirSelectorFechaNativo(hiddenFechaRef.current)}
                  title="Clic para abrir el calendario"
                  aria-label="Fecha del comprobante. Clic para abrir el calendario."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-0 top-0 h-9 w-9 shrink-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => abrirSelectorFechaNativo(hiddenFechaRef.current)}
                  aria-label="Abrir calendario"
                  title="Abrir calendario"
                >
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </div>
              <input
                ref={hiddenFechaRef}
                type="date"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                value={fechaIso}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setFechaIso(v);
                }}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>TIPO DE FACTURA</ModalMicroLabel>
              <Select
                value={tipo}
                onValueChange={(value) => {
                  if (esFacturaTipo(value)) setTipo(value);
                }}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACTURA_TIPOS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {FACTURA_TIPO_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>N° COMPROBANTE</ModalMicroLabel>
              <Input
                type="text"
                readOnly
                value=""
                placeholder="—"
                className="bg-muted/40 tabular-nums"
                aria-label="Número de comprobante (solo lectura)"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>CLIENTE</ModalMicroLabel>
              <Input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                autoComplete="off"
                aria-label="Cliente"
              />
            </label>
          </div>
        </div>

        {/* Segundo bloque: buscador + tabla remito */}
        <div className="min-h-0 flex-1 rounded-lg border border-border bg-card">
          <FacturaCrearLineasBlock />
        </div>
      </div>
    </ClassicFilteredTableLayout>
  );
}
