"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import {
  descuentoPctDesdeTotalFac,
  FACTURA_DESCUENTO_MAX_CENTS,
  totalFacDesdeDescuentoPct,
  type FacturaDescuentoEstado,
} from "@/lib/factura";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

const INPUT_CONTROL_CLASS = "tabular-nums border-primary w-full min-w-0";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalLista: number;
  descuentoActual: FacturaDescuentoEstado | null;
  onAplicar: (descuento: FacturaDescuentoEstado | null) => void;
}

function pctToNorm(pct: number): string {
  if (pct <= 0) return "";
  return (Math.round(pct * 100) / 100).toFixed(2);
}

function pesosToNorm(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos < 0) return "";
  return Math.round(pesos).toFixed(2);
}

function parsePctNorm(norm: string): number {
  const t = norm.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function parsePesosNorm(norm: string): number | null {
  const t = norm.trim();
  if (t === "") return null;
  const cents = montoArNormalizedStringToCents(t);
  return Math.round(cents / 100);
}

function estadoInicial(
  totalLista: number,
  descuentoActual: FacturaDescuentoEstado | null
): {
  pctNorm: string;
  totalNorm: string;
  lastEdited: "pct" | "total" | null;
} {
  if (descuentoActual == null || descuentoActual.porcentaje <= 0) {
    return {
      pctNorm: "",
      totalNorm: totalLista > 0 ? pesosToNorm(totalLista) : "",
      lastEdited: null,
    };
  }
  const pct = descuentoActual.porcentaje;
  if (
    descuentoActual.fuente === "total_fac" &&
    descuentoActual.totalFacObjetivo != null
  ) {
    return {
      pctNorm: pctToNorm(pct),
      totalNorm: pesosToNorm(descuentoActual.totalFacObjetivo),
      lastEdited: "total",
    };
  }
  return {
    pctNorm: pctToNorm(pct),
    totalNorm: pesosToNorm(totalFacDesdeDescuentoPct(totalLista, pct)),
    lastEdited: "pct",
  };
}

/**
 * Modal de descuento de Factura · Crear: DESC. % y TOTAL FAC. (sincronizados).
 * El padre remonta con `key` al abrir para rehidratar el borrador.
 */
export default function FacturaDescuentoModal({
  open,
  onOpenChange,
  totalLista,
  descuentoActual,
  onAplicar,
}: Props) {
  const inicial = estadoInicial(totalLista, descuentoActual);
  const [pctNorm, setPctNorm] = useState(inicial.pctNorm);
  const [totalNorm, setTotalNorm] = useState(inicial.totalNorm);
  const [lastEdited, setLastEdited] = useState<"pct" | "total" | null>(
    inicial.lastEdited
  );

  function handlePctChange(next: string) {
    setPctNorm(next);
    setLastEdited("pct");
    const pct = parsePctNorm(next);
    if (next.trim() === "") {
      setTotalNorm(totalLista > 0 ? pesosToNorm(totalLista) : "");
      return;
    }
    setTotalNorm(pesosToNorm(totalFacDesdeDescuentoPct(totalLista, pct)));
  }

  function handleTotalChange(next: string) {
    setTotalNorm(next);
    setLastEdited("total");
    const pesos = parsePesosNorm(next);
    if (pesos == null) {
      setPctNorm("");
      return;
    }
    setPctNorm(pctToNorm(descuentoPctDesdeTotalFac(totalLista, pesos)));
  }

  function handleAplicar() {
    if (totalLista <= 0) {
      toast.error("Agregá ítems antes de aplicar un descuento.");
      return;
    }

    const pctVacio = pctNorm.trim() === "";
    const totalVacio = totalNorm.trim() === "";

    if (pctVacio && totalVacio) {
      onAplicar(null);
      onOpenChange(false);
      return;
    }

    const usarTotalFac =
      lastEdited === "total" ||
      (lastEdited !== "pct" && !totalVacio && pctVacio);

    if (usarTotalFac) {
      const pesos = parsePesosNorm(totalNorm);
      if (pesos == null) {
        toast.error("Ingresá un TOTAL FAC. válido.");
        return;
      }
      if (pesos > totalLista) {
        toast.error("El TOTAL FAC. no puede superar el total de lista.");
        return;
      }
      if (pesos === totalLista) {
        onAplicar(null);
        onOpenChange(false);
        return;
      }
      const pct = descuentoPctDesdeTotalFac(totalLista, pesos);
      onAplicar({
        fuente: "total_fac",
        porcentaje: pct,
        totalFacObjetivo: pesos,
      });
      onOpenChange(false);
      return;
    }

    const pct = parsePctNorm(pctNorm);
    if (pct <= 0) {
      onAplicar(null);
      onOpenChange(false);
      return;
    }
    if (pct > 100) {
      toast.error("El DESC. % no puede superar 100.");
      return;
    }
    onAplicar({
      fuente: "porcentaje",
      porcentaje: pct,
      totalFacObjetivo: null,
    });
    onOpenChange(false);
  }

  function handleQuitar() {
    onAplicar(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="sm"
        padding="sm"
        title="DESCUENTO"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="ghost" onClick={handleQuitar}>
              Quitar
            </Button>
            <Button type="button" onClick={handleAplicar}>
              Aplicar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="grid grid-cols-[7rem_1fr] items-center gap-3">
            <ModalMicroLabel>DESC. %</ModalMicroLabel>
            <PorcentajeCentInput
              id="factura-desc-pct"
              valueNormalized={pctNorm}
              onValueNormalizedChange={handlePctChange}
              maxCents={FACTURA_DESCUENTO_MAX_CENTS}
              treatEmptyNormalizedAsBlank
              pctSuffixAlwaysVisible
              className={cn(INPUT_CONTROL_CLASS, "h-9")}
              aria-label="Descuento porcentaje"
            />
          </label>
          <label className="grid grid-cols-[7rem_1fr] items-center gap-3">
            <ModalMicroLabel>TOTAL FAC.</ModalMicroLabel>
            <MontoArInput
              id="factura-desc-total-fac"
              valueNormalized={totalNorm}
              onValueNormalizedChange={handleTotalChange}
              treatEmptyNormalizedAsBlank
              className={cn(INPUT_CONTROL_CLASS, "h-9")}
              aria-label="Total factura con descuento"
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}
