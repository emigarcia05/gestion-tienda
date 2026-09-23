"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listarCatalogoCobroFacturaAction } from "@/actions/factura";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import {
  esFacturaTipoVenta,
  FACTURA_TIPO_LABELS,
  resumenTotalesFactura,
} from "@/lib/factura";
import {
  descargarPdfFacturaComprobante,
  imprimirPdfFacturaComprobante,
  imprimirYDescargarPdfFacturaComprobante,
} from "@/lib/facturaComprobantePdfClient";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import {
  iconoFormaPagoDesdeNombre,
  type FinAnaCosFinaPagoItem,
} from "@/lib/finAnaCosFinaPagos";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";
import {
  montoArCentsToDisplayWithCurrency,
  montoArNormalizedStringToCents,
  montoArNumberToNormalizedString,
} from "@/lib/montoArMask";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { CobroFacturaEmitirInput } from "@/lib/validations/factura";

export type FacturaGenerarComprobanteAccion =
  | "imprimir"
  | "descargar"
  | "ambos";

const VACIO = "none";

const SECCION_MODAL_CLASS =
  "flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4";
const SECCION_TITULO_CLASS =
  "text-center text-xs font-bold uppercase tracking-wide text-foreground";
const BOTON_GENERAR_CLASS =
  "h-14 min-h-14 w-full min-w-0 shrink flex-col gap-0.5 whitespace-normal px-1.5 py-1";
const BOTON_FORMA_PAGO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";

const ACCIONES_GENERAR: {
  id: FacturaGenerarComprobanteAccion;
  linea2: string;
  ariaLabel: string;
}[] = [
  { id: "imprimir", linea2: "IMPRIMIR", ariaLabel: "Generar imprimir" },
  { id: "descargar", linea2: "DESCARGAR", ariaLabel: "Generar descargar" },
  {
    id: "ambos",
    linea2: "IMPRIMIR & DESCARGAR",
    ariaLabel: "Generar imprimir y descargar",
  },
];

type CobroRegistrado = CobroFacturaEmitirInput & { id: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobante: FacturaComprobantePdfInput | null;
  /** Persiste el comprobante (ARCA si aplica) y devuelve el PDF con nro/CAE. */
  onEmitir: (
    cobros: CobroFacturaEmitirInput[]
  ) => Promise<FacturaComprobantePdfInput | null>;
  onFinalizado?: () => void;
}

function tituloComprobante(comprobante: FacturaComprobantePdfInput | null): string {
  if (comprobante == null) return "COMPROBANTE";
  const letra = comprobante.letra?.trim();
  const base = FACTURA_TIPO_LABELS[comprobante.tipo];
  return letra ? `${base} ${letra}` : base;
}

function totalCentsDeComprobante(comprobante: FacturaComprobantePdfInput | null): number {
  if (comprobante == null) return 0;
  const total = resumenTotalesFactura(comprobante.lineas, comprobante.descuento).totalConDesc;
  return Math.max(0, Math.round(total * 100));
}

/**
 * Modal **Generar Comprobante**: cobro (solo ventas) + PDF.
 * El comprobante se emite al Generar Imprimir / Descargar / Imprimir & Descargar.
 */
export default function FacturaGenerarComprobanteModal({
  open,
  onOpenChange,
  comprobante,
  onEmitir,
  onFinalizado,
}: Props) {
  const [pending, setPending] = useState<FacturaGenerarComprobanteAccion | null>(null);
  const [pagos, setPagos] = useState<FinAnaCosFinaPagoItem[]>([]);
  const [cuotas, setCuotas] = useState<CobrosCuotaItem[]>([]);
  const [pagoId, setPagoId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [cuotaId, setCuotaId] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [cobros, setCobros] = useState<CobroRegistrado[]>([]);

  const esVenta = comprobante != null && esFacturaTipoVenta(comprobante.tipo);
  const totalCents = totalCentsDeComprobante(comprobante);
  const cobradoCents = cobros.reduce((acc, c) => acc + c.montoCents, 0);
  const pendienteCents = Math.max(0, totalCents - cobradoCents);

  const pagoSel = useMemo(
    () => pagos.find((p) => p.id === pagoId) ?? null,
    [pagos, pagoId]
  );
  const muestraCuotas = Boolean(pagoSel?.aceptaCuotas);
  const muestraEntidad = Boolean(pagoSel?.entidadObligatoria);

  const resetFormularioCobro = useCallback((pendiente: number) => {
    setPagoId("");
    setEntidadId("");
    setCuotaId("");
    setMontoNorm(pendiente > 0 ? montoArNumberToNormalizedString(pendiente / 100) : "");
  }, []);

  useEffect(() => {
    if (!open) return;
    setCobros([]);
    resetFormularioCobro(totalCentsDeComprobante(comprobante));
  }, [open, comprobante, resetFormularioCobro]);

  useEffect(() => {
    if (!open || !esVenta) return;
    let cancelled = false;
    void listarCatalogoCobroFacturaAction().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar las formas de pago.");
        setPagos([]);
        setCuotas([]);
        return;
      }
      setPagos(res.data.pagos);
      setCuotas(res.data.cuotas);
    });
    return () => {
      cancelled = true;
    };
  }, [open, esVenta]);

  function handlePagoChange(nextId: string) {
    if (nextId === pagoId) return;
    setPagoId(nextId);
    const next = pagos.find((p) => p.id === nextId);
    const unicas =
      next?.entidadObligatoria && next.entidadIds.length === 1 ? next.entidadIds[0] : "";
    setEntidadId(unicas);
    setCuotaId("");
  }

  function handleEntidadChange(value: string) {
    setEntidadId(value === VACIO ? "" : value);
  }

  function handleCuotaChange(value: string) {
    setCuotaId(value === VACIO ? "" : value);
  }

  function agregarCobro() {
    if (!pagoSel) {
      toast.error("Seleccioná una forma de pago.");
      return;
    }
    if (pagoSel.entidadObligatoria && !entidadId) {
      toast.error("Seleccioná una entidad.");
      return;
    }
    if (muestraCuotas && !cuotaId) {
      toast.error("Seleccioná las cuotas.");
      return;
    }
    const montoCents = montoArNormalizedStringToCents(montoNorm);
    if (montoCents <= 0) {
      toast.error("Ingresá un monto a pagar.");
      return;
    }
    if (montoCents > pendienteCents) {
      toast.error("El monto no puede ser mayor al saldo pendiente.");
      return;
    }
    const entidadIdx = pagoSel.entidadIds.indexOf(entidadId);
    const entidadNombre = pagoSel.entidadNombres[entidadIdx] ?? "";
    const cuota = cuotas.find((c) => c.id === cuotaId);
    const siguientePendiente = pendienteCents - montoCents;
    setCobros((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        pagoNombre: pagoSel.nombre,
        entidadNombre,
        cuotaEtiqueta: cuota?.cuotas ?? null,
        montoCents,
      },
    ]);
    resetFormularioCobro(siguientePendiente);
  }

  function quitarCobro(id: string) {
    const fila = cobros.find((c) => c.id === id);
    const siguientePendiente = pendienteCents + (fila?.montoCents ?? 0);
    setCobros((prev) => prev.filter((c) => c.id !== id));
    resetFormularioCobro(siguientePendiente);
  }

  const ocupado = pending != null;

  function cerrarSinEmitir() {
    if (ocupado) return;
    onOpenChange(false);
  }

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
      const emitido = await onEmitir(
        cobros.map(({ pagoNombre, entidadNombre, cuotaEtiqueta, montoCents }) => ({
          pagoNombre,
          entidadNombre,
          cuotaEtiqueta,
          montoCents,
        }))
      );
      if (emitido == null) return;
      try {
        if (accion === "imprimir") {
          await imprimirPdfFacturaComprobante(emitido);
        } else if (accion === "descargar") {
          await descargarPdfFacturaComprobante(emitido);
        } else {
          await imprimirYDescargarPdfFacturaComprobante(emitido);
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "No se pudo generar el PDF.";
        toast.error(msg);
      }
      onFinalizado?.();
      onOpenChange(false);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "No se pudo generar el comprobante.";
      toast.error(msg);
    } finally {
      setPending(null);
    }
  }

  const formCobroVisible = esVenta && pendienteCents > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else cerrarSinEmitir();
      }}
    >
      <AppModal
        size={esVenta ? "xl" : "sm"}
        padding="sm"
        title={tituloComprobante(comprobante)}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={cerrarSinEmitir}
            disabled={ocupado}
          >
            Cancelar
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          {esVenta ? (
            <section className={SECCION_MODAL_CLASS}>
              <p className={SECCION_TITULO_CLASS}>COBRO</p>
              <p className="text-center text-xl font-bold uppercase tracking-wide tabular-nums text-foreground">
                SALDO PENDIENTE: {montoArCentsToDisplayWithCurrency(pendienteCents, "$")}
              </p>

              {formCobroVisible ? (
                <div className="flex flex-col gap-3">
                  {pagos.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      No hay formas de pago cargadas.
                    </p>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Forma de pago"
                      className="flex flex-wrap justify-center gap-2"
                    >
                        {pagos.map((pago) => {
                          const Icono = iconoFormaPagoDesdeNombre(pago.nombre);
                          const seleccionado = pago.id === pagoId;
                          return (
                            <Button
                              key={pago.id}
                              type="button"
                              role="radio"
                              aria-checked={seleccionado}
                              variant={seleccionado ? "default" : "outline"}
                              disabled={ocupado}
                              className={BOTON_FORMA_PAGO_CLASS}
                              onClick={() => handlePagoChange(pago.id)}
                            >
                              <Icono className="size-5 shrink-0" aria-hidden />
                              <span className="line-clamp-2 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
                                {pago.nombre}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    )}

                  <div className="flex items-end justify-center gap-2">
                    {muestraEntidad ? (
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
                      <Select
                        value={entidadId || VACIO}
                        onValueChange={handleEntidadChange}
                        disabled={ocupado || !pagoSel}
                      >
                        <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                          <SelectValue placeholder="ENTIDAD" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          side="bottom"
                          align="start"
                          className="select-content-filtro"
                        >
                          <SelectItem value={VACIO}>ENTIDAD</SelectItem>
                          {pagoSel
                            ? pagoSel.entidadIds.map((id, idx) => (
                                <SelectItem key={id} value={id}>
                                  {pagoSel.entidadNombres[idx] ?? ""}
                                </SelectItem>
                              ))
                            : null}
                        </SelectContent>
                      </Select>
                    </label>
                  ) : null}
                  {muestraCuotas ? (
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <ModalMicroLabel>CUOTAS</ModalMicroLabel>
                      <Select
                        value={cuotaId || VACIO}
                        onValueChange={handleCuotaChange}
                        disabled={ocupado}
                      >
                        <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                          <SelectValue placeholder="CUOTAS" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          side="bottom"
                          align="start"
                          className="select-content-filtro"
                        >
                          <SelectItem value={VACIO}>CUOTAS</SelectItem>
                          {cuotas.map((cuota) => (
                            <SelectItem key={cuota.id} value={cuota.id}>
                              {cuota.cuotas}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  ) : null}

                  <div className="w-[8.5rem] shrink-0">
                    <MontoArInput
                      valueNormalized={montoNorm}
                      onValueNormalizedChange={setMontoNorm}
                      disabled={ocupado}
                      aria-label="Monto a pagar"
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 shrink-0 gap-2"
                    disabled={ocupado}
                    onClick={agregarCobro}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    Agregar
                  </Button>
                </div>
                </div>
              ) : null}

              {cobros.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {cobros.map((cobro) => (
                    <li
                      key={cobro.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {cobro.pagoNombre}
                        {cobro.entidadNombre ? ` · ${cobro.entidadNombre}` : ""}
                        {cobro.cuotaEtiqueta ? ` · ${cobro.cuotaEtiqueta}` : ""}
                        {` · ${montoArCentsToDisplayWithCurrency(cobro.montoCents, "$")}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        aria-label="Quitar cobro"
                        disabled={ocupado}
                        onClick={() => quitarCobro(cobro.id)}
                      >
                        <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className={SECCION_MODAL_CLASS}>
            <p className={SECCION_TITULO_CLASS}>GENERAR COMPROBANTE</p>
            {comprobante?.cae ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold tabular-nums">CAE: {comprobante.cae}</p>
                <p className="tabular-nums">
                  N°: {comprobante.nroComprobante.trim() || ""}
                </p>
                <p>
                  Vto. CAE:{" "}
                  {comprobante.caeVtoIso
                    ? formatIsoYmdDdMmYyyyArgentina(comprobante.caeVtoIso)
                    : ""}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              {ACCIONES_GENERAR.map((accion) => (
                <Button
                  key={accion.id}
                  type="button"
                  variant="default"
                  className={BOTON_GENERAR_CLASS}
                  disabled={ocupado}
                  aria-label={accion.ariaLabel}
                  onClick={() => void ejecutar(accion.id)}
                >
                  {pending === accion.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <span className="flex flex-col items-center justify-center gap-0.5 text-center text-[0.7rem] font-semibold uppercase leading-tight tracking-wide">
                      <span>GENERAR</span>
                      <span>{accion.linea2}</span>
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
