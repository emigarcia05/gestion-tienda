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
  etiquetaReglaDescPromoFactura,
  tituloFormasPagoDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import {
  descuentoPctDesdeTotalFac,
  FACTURA_DESCUENTO_MAX_CENTS,
  totalFacDesdeDescuentoPct,
  type FacturaDescuentoEstado,
  type FacturaDescuentoPromoRegla,
} from "@/lib/factura";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

const INPUT_CONTROL_CLASS = "tabular-nums border-primary w-full min-w-0";
const SELECCION_PERSONALIZADO = "personalizado";
const COLUMNA_PROMO_CLASS =
  "h-auto min-h-[5.5rem] min-w-0 flex-1 flex-col gap-1.5 whitespace-normal rounded-none border-0 px-2 py-2 shadow-none !h-auto";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalLista: number;
  descuentoActual: FacturaDescuentoEstado | null;
  promosFormaPago: DescPromoFila[];
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
  return Math.round(montoArNormalizedStringToCents(t) / 100);
}

function estadoInicial(
  totalLista: number,
  descuentoActual: FacturaDescuentoEstado | null
): {
  pctNorm: string;
  totalNorm: string;
  lastEdited: "pct" | "total" | null;
  seleccion: string;
} {
  if (descuentoActual?.fuente === "promo_forma_pago" && descuentoActual.promoId) {
    return {
      pctNorm: "",
      totalNorm: totalLista > 0 ? pesosToNorm(totalLista) : "",
      lastEdited: null,
      seleccion: descuentoActual.promoId,
    };
  }
  if (descuentoActual == null || descuentoActual.porcentaje <= 0) {
    return {
      pctNorm: "",
      totalNorm: totalLista > 0 ? pesosToNorm(totalLista) : "",
      lastEdited: null,
      seleccion: SELECCION_PERSONALIZADO,
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
      seleccion: SELECCION_PERSONALIZADO,
    };
  }
  return {
    pctNorm: pctToNorm(pct),
    totalNorm: pesosToNorm(totalFacDesdeDescuentoPct(totalLista, pct)),
    lastEdited: "pct",
    seleccion: SELECCION_PERSONALIZADO,
  };
}

function reglasPromoParaEstado(promo: DescPromoFila): FacturaDescuentoPromoRegla[] {
  return promo.reglas.map((regla) => ({
    idRubro: regla.idRubro,
    idSubRubro: regla.idSubRubro,
    descuento: regla.descuento,
  }));
}

/**
 * Modal de descuento de Factura · Crear: columnas POR FORMA DE PAGO + PERSONALIZADO
 * (DESC. % y DESC. TOTAL sincronizados). El padre remonta con `key` al abrir.
 */
export default function FacturaDescuentoModal({
  open,
  onOpenChange,
  totalLista,
  descuentoActual,
  promosFormaPago,
  onAplicar,
}: Props) {
  const inicial = estadoInicial(totalLista, descuentoActual);
  const [pctNorm, setPctNorm] = useState(inicial.pctNorm);
  const [totalNorm, setTotalNorm] = useState(inicial.totalNorm);
  const [lastEdited, setLastEdited] = useState<"pct" | "total" | null>(
    inicial.lastEdited
  );
  const [seleccion, setSeleccion] = useState(inicial.seleccion);
  const mostrarPersonalizado = seleccion === SELECCION_PERSONALIZADO;

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

    if (!mostrarPersonalizado) {
      const promo = promosFormaPago.find((p) => p.id === seleccion);
      if (!promo) {
        toast.error("Elegí un descuento por forma de pago.");
        return;
      }
      onAplicar({
        fuente: "promo_forma_pago",
        porcentaje: 0,
        totalFacObjetivo: null,
        promoId: promo.id,
        promoReglas: reglasPromoParaEstado(promo),
        promoPagoIds: promo.formasPago.map((fp) => fp.pagoId),
        promoPagoNombres: promo.formasPago.map((fp) => fp.nombre),
      });
      onOpenChange(false);
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
        toast.error("Ingresá un DESC. TOTAL válido.");
        return;
      }
      if (pesos > totalLista) {
        toast.error("El DESC. TOTAL no puede superar el TOTAL $.");
        return;
      }
      if (pesos >= totalLista) {
        onAplicar(null);
        onOpenChange(false);
        return;
      }
      onAplicar({
        fuente: "total_fac",
        porcentaje: descuentoPctDesdeTotalFac(totalLista, pesos),
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
        size="xl"
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
          <div
            className="flex w-full min-w-0 overflow-hidden rounded-md border border-primary"
            role="radiogroup"
            aria-label="Descuento por forma de pago"
          >
            {promosFormaPago.map((promo, i) => {
              const activo = seleccion === promo.id;
              return (
                <div key={promo.id} className="flex min-w-0 flex-1">
                  {i > 0 ? (
                    <div
                      className="w-px shrink-0 self-stretch bg-primary"
                      aria-hidden
                    />
                  ) : null}
                  <Button
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    variant={activo ? "default" : "outline"}
                    className={COLUMNA_PROMO_CLASS}
                    onClick={() => setSeleccion(promo.id)}
                  >
                    <span className="w-full text-center text-xs font-bold uppercase leading-tight tracking-wide">
                      {tituloFormasPagoDescPromo(promo)}
                    </span>
                    <span className="flex w-full flex-col gap-0.5">
                      {promo.reglas.map((regla) => (
                        <span
                          key={regla.id}
                          className="text-center text-[0.65rem] font-medium uppercase leading-tight tabular-nums"
                        >
                          {etiquetaReglaDescPromoFactura(regla)}
                        </span>
                      ))}
                    </span>
                  </Button>
                </div>
              );
            })}
            {promosFormaPago.length > 0 ? (
              <div
                className="w-px shrink-0 self-stretch bg-primary"
                aria-hidden
              />
            ) : null}
            <Button
              type="button"
              role="radio"
              aria-checked={mostrarPersonalizado}
              variant={mostrarPersonalizado ? "default" : "outline"}
              className={COLUMNA_PROMO_CLASS}
              onClick={() => setSeleccion(SELECCION_PERSONALIZADO)}
            >
              <span className="w-full text-center text-xs font-bold uppercase leading-tight tracking-wide">
                PERSONALIZADO
              </span>
            </Button>
          </div>

          {mostrarPersonalizado ? (
            <>
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
                <ModalMicroLabel>DESC. TOTAL</ModalMicroLabel>
                <MontoArInput
                  id="factura-desc-total"
                  valueNormalized={totalNorm}
                  onValueNormalizedChange={handleTotalChange}
                  treatEmptyNormalizedAsBlank
                  className={cn(INPUT_CONTROL_CLASS, "h-9")}
                  aria-label="Descuento total factura"
                />
              </label>
            </>
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
