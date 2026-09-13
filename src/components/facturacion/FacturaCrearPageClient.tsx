"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarDays, FileText } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FacturaCrearLineasBlock, {
  type FacturaRemitoSnapshot,
} from "@/components/facturacion/FacturaCrearLineasBlock";
import FacturaGenerarComprobanteModal from "@/components/facturacion/FacturaGenerarComprobanteModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
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
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";
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
  const remitoRef = useRef<FacturaRemitoSnapshot>({
    lineas: [],
    descuento: null,
  });
  const [fechaIso, setFechaIso] = useState(() => dateToIsoYmdArgentina(new Date()));
  const [tipo, setTipo] = useState<FacturaTipo>(FACTURA_TIPO_DEFAULT);
  const [cliente, setCliente] = useState("");
  const [nroComprobante] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [comprobanteModalOpen, setComprobanteModalOpen] = useState(false);
  const [comprobantePdf, setComprobantePdf] =
    useState<FacturaComprobantePdfInput | null>(null);

  const handleRemitoChange = useCallback((snapshot: FacturaRemitoSnapshot) => {
    remitoRef.current = snapshot;
  }, []);

  function abrirGenerarComprobante() {
    const { lineas, descuento } = remitoRef.current;
    if (lineas.length === 0) {
      toast.error("Agregá al menos un ítem antes de generar el comprobante.");
      return;
    }
    setComprobantePdf({
      tipo,
      fechaIso,
      cliente,
      nroComprobante,
      comentarios,
      lineas,
      descuento,
    });
    setComprobanteModalOpen(true);
  }

  return (
    <ClassicFilteredTableLayout
      title="FACTURA"
      subtitle="Crear"
      contentWidth="full"
      actions={
        <ToolbarActionButton
          type="button"
          variant="default"
          label="Generar Comprobante"
          icon={<FileText className="h-4 w-4 shrink-0" aria-hidden />}
          onClick={abrirGenerarComprobante}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-4">
        {/* Cabecera del comprobante */}
        <div className="shrink-0 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-5 gap-4">
            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>TIPO COMPROBANTE</ModalMicroLabel>
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

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>N° COMPROBANTE</ModalMicroLabel>
              <Input
                type="text"
                readOnly
                value={nroComprobante}
                placeholder="—"
                className="bg-muted/40 tabular-nums"
                aria-label="Número de comprobante (solo lectura)"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>COMENTARIOS</ModalMicroLabel>
              <Input
                type="text"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Comentarios"
                autoComplete="off"
                aria-label="Comentarios"
              />
            </label>
          </div>
        </div>

        {/* Segundo bloque: buscador + tabla remito (scroll interno, thead sticky) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <FacturaCrearLineasBlock onRemitoChange={handleRemitoChange} />
        </div>
      </div>

      <FacturaGenerarComprobanteModal
        open={comprobanteModalOpen}
        onOpenChange={(open) => {
          setComprobanteModalOpen(open);
          if (!open) setComprobantePdf(null);
        }}
        comprobante={comprobantePdf}
      />
    </ClassicFilteredTableLayout>
  );
}
