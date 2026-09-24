"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { obtenerFacturaComprobantePdfAction } from "@/actions/factura";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  descargarPdfFacturaComprobante,
  imprimirPdfFacturaComprobante,
  imprimirYDescargarPdfFacturaComprobante,
} from "@/lib/facturaComprobantePdfClient";

type AccionPdf = "imprimir" | "descargar" | "ambos";

const BOTON_ACCION_CLASS =
  "h-14 min-h-14 w-full min-w-0 shrink flex-col gap-0.5 whitespace-normal px-1.5 py-1";

const ACCIONES: {
  id: AccionPdf;
  linea1: string;
  linea2: string | null;
  ariaLabel: string;
}[] = [
  { id: "imprimir", linea1: "IMPRIMIR", linea2: null, ariaLabel: "Imprimir PDF" },
  { id: "descargar", linea1: "DESCARGAR", linea2: null, ariaLabel: "Descargar PDF" },
  {
    id: "ambos",
    linea1: "IMPRIMIR",
    linea2: "& DESCARGAR",
    ariaLabel: "Imprimir y descargar PDF",
  },
];

import type { ActionResult } from "@/lib/types";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobanteId: string | null;
  nroComprobante: string;
  obtenerPdf?: (input: {
    id: string;
  }) => Promise<ActionResult<FacturaComprobantePdfDatos>>;
};

export default function FacturaComprobantePdfAccionModal({
  open,
  onOpenChange,
  comprobanteId,
  nroComprobante,
  obtenerPdf = obtenerFacturaComprobantePdfAction,
}: Props) {
  const [pending, setPending] = useState<AccionPdf | null>(null);
  const ocupado = pending != null;

  function cerrar() {
    if (ocupado) return;
    onOpenChange(false);
  }

  async function ejecutar(accion: AccionPdf) {
    if (!comprobanteId) {
      toast.error("No hay comprobante.");
      return;
    }
    setPending(accion);
    try {
      const res = await obtenerPdf({ id: comprobanteId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (accion === "imprimir") {
        await imprimirPdfFacturaComprobante(res.data);
      } else if (accion === "descargar") {
        await descargarPdfFacturaComprobante(res.data);
      } else {
        await imprimirYDescargarPdfFacturaComprobante(res.data);
      }
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo generar el PDF.";
      toast.error(msg);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else cerrar();
      }}
    >
      <AppModal
        size="md"
        padding="sm"
        title={`PDF ${nroComprobante}`.trim()}
        actions={
          <Button type="button" variant="outline" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {ACCIONES.map((accion) => (
            <Button
              key={accion.id}
              type="button"
              variant="default"
              className={BOTON_ACCION_CLASS}
              disabled={ocupado}
              aria-label={accion.ariaLabel}
              onClick={() => void ejecutar(accion.id)}
            >
              {pending === accion.id ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <span className="flex flex-col items-center justify-center gap-0.5 text-center text-[0.7rem] font-semibold uppercase leading-tight tracking-wide">
                  <span>{accion.linea1}</span>
                  {accion.linea2 ? <span>{accion.linea2}</span> : null}
                </span>
              )}
            </Button>
          ))}
        </div>
      </AppModal>
    </Dialog>
  );
}
