"use client";

import { useState } from "react";
import { Download, Loader2, Printer, PrinterCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import {
  descargarPdfFacturaComprobante,
  imprimirPdfFacturaComprobante,
  imprimirYDescargarPdfFacturaComprobante,
} from "@/lib/facturaComprobantePdfClient";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";

export type FacturaGenerarComprobanteAccion =
  | "imprimir"
  | "descargar"
  | "ambos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobante: FacturaComprobantePdfInput | null;
}

/**
 * Modal post **Generar Comprobante**: Imprimir / Descargar / Imprimir & Descargar.
 */
export default function FacturaGenerarComprobanteModal({
  open,
  onOpenChange,
  comprobante,
}: Props) {
  const [pending, setPending] = useState<FacturaGenerarComprobanteAccion | null>(
    null
  );

  async function ejecutar(accion: FacturaGenerarComprobanteAccion) {
    if (comprobante == null) {
      toast.error("No hay datos del comprobante.");
      return;
    }
    if (comprobante.lineas.length === 0) {
      toast.error("Agregá al menos un ítem antes de generar el comprobante.");
      return;
    }
    setPending(accion);
    try {
      if (accion === "imprimir") {
        await imprimirPdfFacturaComprobante(comprobante);
        toast.success("Comprobante enviado a imprimir.");
      } else if (accion === "descargar") {
        await descargarPdfFacturaComprobante(comprobante);
        toast.success("PDF descargado.");
      } else {
        await imprimirYDescargarPdfFacturaComprobante(comprobante);
        toast.success("PDF descargado y enviado a imprimir.");
      }
      onOpenChange(false);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "No se pudo generar el comprobante.";
      toast.error(msg);
    } finally {
      setPending(null);
    }
  }

  const ocupado = pending != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title="GENERAR COMPROBANTE"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={ocupado}
          >
            Cancelar
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="default"
            className="h-10 w-full justify-center gap-2"
            disabled={ocupado}
            onClick={() => void ejecutar("imprimir")}
          >
            {pending === "imprimir" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Printer className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Imprimir
          </Button>
          <Button
            type="button"
            variant="default"
            className="h-10 w-full justify-center gap-2"
            disabled={ocupado}
            onClick={() => void ejecutar("descargar")}
          >
            {pending === "descargar" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Descargar
          </Button>
          <Button
            type="button"
            variant="default"
            className="h-10 w-full justify-center gap-2"
            disabled={ocupado}
            onClick={() => void ejecutar("ambos")}
          >
            {pending === "ambos" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <PrinterCheck className="h-4 w-4 shrink-0" aria-hidden />
            )}
            Imprimir & Descargar
          </Button>
        </div>
      </AppModal>
    </Dialog>
  );
}
