"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
import {
  aCandidataFactura,
  claveFormaPagoCuotaDescPromo,
  columnasFormaPagoDescPromo,
  etiquetaAlcanceCondicion,
  etiquetaFormaPagoCuotaDescPromo,
  etiquetaReglaDescPromoFactura,
  formasPagoUnicasDescPromo,
  snapshotCobroDescPromo,
  tituloPctDescPromoFactura,
  type DescPromoFila,
} from "@/lib/descPromo";
import {
  descuentoPctDesdeTotalFac,
  FACTURA_DESCUENTO_MAX_CENTS,
  totalFacDesdeDescuentoPct,
  type FacturaDescuentoEstado,
} from "@/lib/factura";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

const INPUT_CONTROL_CLASS = "tabular-nums border-primary w-full min-w-0";
const SELECCION_PERSONALIZADO = "personalizado";
type VistaDescPromo = "descuento" | "forma_pago";
const COLUMNA_PROMO_CLASS =
  "h-auto min-h-[5.5rem] min-w-0 flex-1 flex-col gap-1.5 whitespace-normal rounded-none border-0 px-2 py-2 shadow-none !h-auto";
const VISTA_BTN_CLASS =
  "h-10 min-w-0 flex-1 rounded-none border-0 shadow-none";

function clavePago(pagoId: string, cuotaId: string | null): string {
  return `pago:${claveFormaPagoCuotaDescPromo(pagoId, cuotaId)}`;
}

function clavePromo(promoId: string): string {
  return `promo:${promoId}`;
}

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
  vista: VistaDescPromo;
} {
  const vacioLista = {
    pctNorm: "",
    totalNorm: totalLista > 0 ? pesosToNorm(totalLista) : "",
    lastEdited: null as "pct" | "total" | null,
  };
  if (descuentoActual?.fuente === "promo_forma_pago") {
    const agrupacion = descuentoActual.promoAgrupacion ?? "forma_pago";
    const promoId = descuentoActual.promoCandidatas?.[0]?.id;
    const pagoId =
      descuentoActual.promoPagoIdSeleccionado ??
      descuentoActual.promoPagoIds?.[0];
    const cuotaId = descuentoActual.promoCuotaIdSeleccionado ?? null;
    if (agrupacion === "descuento" && promoId) {
      return {
        ...vacioLista,
        seleccion: clavePromo(promoId),
        vista: "descuento",
      };
    }
    if (pagoId) {
      return {
        ...vacioLista,
        seleccion: clavePago(pagoId, cuotaId),
        vista: "forma_pago",
      };
    }
  }
  if (descuentoActual == null || descuentoActual.porcentaje <= 0) {
    return {
      ...vacioLista,
      seleccion: SELECCION_PERSONALIZADO,
      vista: "descuento",
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
      vista: "descuento",
    };
  }
  return {
    pctNorm: pctToNorm(pct),
    totalNorm: pesosToNorm(totalFacDesdeDescuentoPct(totalLista, pct)),
    lastEdited: "pct",
    seleccion: SELECCION_PERSONALIZADO,
    vista: "descuento",
  };
}

/**
 * Modal de descuento de Factura · Crear: vistas POR DESCUENTO / POR FORMA PAGO + PERSONALIZADO.
 * El padre remonta con `key` al abrir.
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
  const [vista, setVista] = useState<VistaDescPromo>(inicial.vista);
  const columnasPago = useMemo(
    () => columnasFormaPagoDescPromo(promosFormaPago),
    [promosFormaPago]
  );
  const columnasDesc = useMemo(
    () =>
      promosFormaPago
        .slice()
        .sort((a, b) => b.prioridad - a.prioridad || a.nombre.localeCompare(b.nombre, "es")),
    [promosFormaPago]
  );
  const mostrarPersonalizado = seleccion === SELECCION_PERSONALIZADO;

  function cambiarVista(next: VistaDescPromo) {
    setVista(next);
    if (seleccion !== SELECCION_PERSONALIZADO) {
      setSeleccion(SELECCION_PERSONALIZADO);
    }
  }

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
      if (vista === "descuento") {
        const promo = columnasDesc.find((p) => clavePromo(p.id) === seleccion);
        if (!promo) {
          toast.error("Elegí un descuento.");
          return;
        }
        onAplicar({
          fuente: "promo_forma_pago",
          porcentaje: 0,
          totalFacObjetivo: null,
          promoAgrupacion: "descuento",
          promoCandidatas: [aCandidataFactura(promo)],
          ...snapshotCobroDescPromo(promo.formasPago),
        });
        onOpenChange(false);
        return;
      }
      const col = columnasPago.find(
        (c) => clavePago(c.pagoId, c.cuotaId) === seleccion
      );
      if (!col) {
        toast.error("Elegí una forma de pago.");
        return;
      }
      const formasCobro = formasPagoUnicasDescPromo(col.promos);
      onAplicar({
        fuente: "promo_forma_pago",
        porcentaje: 0,
        totalFacObjetivo: null,
        promoAgrupacion: "forma_pago",
        promoCandidatas: col.promos.map(aCandidataFactura),
        promoPagoIdSeleccionado: col.pagoId,
        promoCuotaIdSeleccionado: col.cuotaId,
        ...snapshotCobroDescPromo(formasCobro),
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
            aria-label="Vista del descuento"
          >
            <Button
              type="button"
              role="radio"
              aria-checked={vista === "descuento"}
              variant={vista === "descuento" ? "default" : "outline"}
              className={VISTA_BTN_CLASS}
              onClick={() => cambiarVista("descuento")}
            >
              Por Descuento
            </Button>
            <div className="w-px shrink-0 self-stretch bg-primary" aria-hidden />
            <Button
              type="button"
              role="radio"
              aria-checked={vista === "forma_pago"}
              variant={vista === "forma_pago" ? "default" : "outline"}
              className={VISTA_BTN_CLASS}
              onClick={() => cambiarVista("forma_pago")}
            >
              Por Forma Pago
            </Button>
          </div>

          <div
            className="flex w-full min-w-0 overflow-hidden rounded-md border border-primary"
            role="radiogroup"
            aria-label={
              vista === "descuento"
                ? "Descuento por regla"
                : "Descuento por forma de pago"
            }
          >
            {vista === "descuento"
              ? columnasDesc.map((promo, i) => {
                  const activo = seleccion === clavePromo(promo.id);
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
                        onClick={() => setSeleccion(clavePromo(promo.id))}
                      >
                        <span className="w-full text-center text-xs font-bold uppercase leading-tight tracking-wide">
                          {tituloPctDescPromoFactura(promo)}
                        </span>
                        <span className="w-full text-center text-[0.65rem] font-medium uppercase leading-tight">
                          {etiquetaAlcanceCondicion(promo)}
                        </span>
                        <span className="flex w-full flex-col gap-0.5">
                          {promo.formasPago.map((fp) => (
                            <span
                              key={claveFormaPagoCuotaDescPromo(fp.pagoId, fp.cuotaId)}
                              className="text-center text-[0.65rem] font-medium uppercase leading-tight"
                            >
                              {etiquetaFormaPagoCuotaDescPromo(fp)}
                            </span>
                          ))}
                        </span>
                      </Button>
                    </div>
                  );
                })
              : columnasPago.map((col, i) => {
                  const activo =
                    seleccion === clavePago(col.pagoId, col.cuotaId);
                  return (
                    <div
                      key={claveFormaPagoCuotaDescPromo(col.pagoId, col.cuotaId)}
                      className="flex min-w-0 flex-1"
                    >
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
                        onClick={() =>
                          setSeleccion(clavePago(col.pagoId, col.cuotaId))
                        }
                      >
                        <span className="w-full text-center text-xs font-bold uppercase leading-tight tracking-wide">
                          {col.etiqueta}
                        </span>
                        <span className="flex w-full flex-col gap-0.5">
                          {col.promos.map((promo) => (
                            <span
                              key={promo.id}
                              className="text-center text-[0.65rem] font-medium uppercase leading-tight tabular-nums"
                            >
                              {etiquetaReglaDescPromoFactura(promo)}
                            </span>
                          ))}
                        </span>
                      </Button>
                    </div>
                  );
                })}
            {(vista === "descuento" ? columnasDesc.length : columnasPago.length) >
            0 ? (
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
