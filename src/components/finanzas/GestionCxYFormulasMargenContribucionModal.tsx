"use client";

import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import type { ParametrosFormulaMargenContribucion } from "@/lib/finAnaMcFormulas";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formulaParams: ParametrosFormulaMargenContribucion;
}

function FormulaLinea({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm leading-relaxed text-foreground", className)}>
      {children}
    </p>
  );
}

function fmtDecimal(valor: number, maxFrac = 4): string {
  return valor.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
}

function fmtPctDesdeAlicuota(alicuota: number): string {
  return (alicuota * 100).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function GestionCxYFormulasMargenContribucionModal({
  open,
  onOpenChange,
  formulaParams,
}: Props) {
  const iva = formulaParams.ivaAlicuota;
  const iibb = formulaParams.iibbAlicuota;
  const pxLista = formulaParams.pxListaCIva;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Info Cx. & Formulas"
        size="lg"
        className="max-w-xl"
        scrollBody
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <ModalMicroLabel>VARIABLES</ModalMicroLabel>
            <FormulaLinea>
              <strong>PX LISTA</strong> = {fmtDecimal(pxLista)}
            </FormulaLinea>
            <FormulaLinea>
              <strong>IVA</strong> = {fmtDecimal(iva)} ({fmtPctDesdeAlicuota(iva)}%)
            </FormulaLinea>
            <FormulaLinea>
              <strong>IIBB</strong> = {fmtDecimal(iibb)} ({fmtPctDesdeAlicuota(iibb)}%)
            </FormulaLinea>
            <FormulaLinea>
              <strong>UTILIDAD</strong> = Determinada por Usuario
            </FormulaLinea>
            <FormulaLinea>
              <strong>DESCUENTO</strong> = Determinada por Usuario
            </FormulaLinea>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <ModalMicroLabel>VARIABLES CALCULADAS</ModalMicroLabel>
            <FormulaLinea>
              <strong>PX LISTA S/ IVA</strong> = PX LISTA / (1 + IVA)
            </FormulaLinea>
            <FormulaLinea>
              <strong>PX VENTA C/ IVA</strong> = PX LISTA × (1 + DESCUENTO)
            </FormulaLinea>
            <FormulaLinea className="text-xs text-muted-foreground">
              DESCUENTO con signo: − = descuento (p. ej. −25% → 75); + = recargo (p. ej. +10% →
              110). Por defecto el input arranca en −.
            </FormulaLinea>
            <FormulaLinea>
              <strong>PX VENTA S/ IVA</strong> = PX VENTA C/ IVA / (1 + IVA)
            </FormulaLinea>
            <FormulaLinea>
              <strong>IVA EN %</strong> = (PX VENTA S/ IVA × IVA) / PX VENTA C/ IVA
            </FormulaLinea>
            <FormulaLinea>
              <strong>IIBB EN %</strong> = (PX VENTA S/ IVA × IIBB) / PX VENTA C/ IVA
            </FormulaLinea>
            <FormulaLinea>
              <strong>CX MERCADERÍA EN %</strong> = (PX LISTA S/ IVA / (1 + UTILIDAD)) /
              PX VENTA C/ IVA
            </FormulaLinea>
            <FormulaLinea>
              <strong>CX FINANCIERO EN %</strong> = FACTURA A → CX TOTAL S/ IVA;
              FACTURA C → CX TOTAL C/ IVA (BD)
            </FormulaLinea>
            <FormulaLinea>
              <strong>M.C.</strong> = 1 − (IVA EN % + IIBB EN % + CX MERCADERÍA EN % +
              CX FINANCIERO EN %)
            </FormulaLinea>
            <FormulaLinea>
              <strong>M.C. PONDERADO</strong> = M.C. × PX VENTA C/ IVA
            </FormulaLinea>
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
