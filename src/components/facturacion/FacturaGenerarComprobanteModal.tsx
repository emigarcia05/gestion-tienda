"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, Printer, PrinterCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  guardarDiasVencimientoFacturaAction,
  listarCatalogoCobroFacturaAction,
} from "@/actions/factura";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  esFormaPagoCuentaCorriente,
  FACTURA_FORMA_PAGO_CUENTA_CORRIENTE,
  FACTURA_FORMA_PAGO_CUENTA_CORRIENTE_LABEL,
  FACTURA_TIPO_LABELS,
  parseDiasVencimiento,
  resumenTotalesFactura,
} from "@/lib/factura";
import {
  descargarPdfFacturaComprobante,
  imprimirPdfFacturaComprobante,
  imprimirYDescargarPdfFacturaComprobante,
} from "@/lib/facturaComprobantePdfClient";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
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

export type FacturaGenerarComprobanteAccion =
  | "imprimir"
  | "descargar"
  | "ambos";

const VACIO = "none";

type CobroRegistrado = {
  id: string;
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  montoCents: number;
  esCuentaCorriente: boolean;
  plazoDias: number | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobante: FacturaComprobantePdfInput | null;
  comprobanteId: string | null;
  plazoCuentaCorrienteCliente?: number | null;
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

function plazoClienteTexto(plazo: number | null | undefined): string {
  return plazo != null ? String(plazo) : "";
}

/**
 * Modal post **Generar Comprobante**: cobro (solo ventas) + PDF.
 */
export default function FacturaGenerarComprobanteModal({
  open,
  onOpenChange,
  comprobante,
  comprobanteId,
  plazoCuentaCorrienteCliente = null,
}: Props) {
  const [pending, setPending] = useState<FacturaGenerarComprobanteAccion | null>(null);
  const [guardandoVto, setGuardandoVto] = useState(false);
  const [pagos, setPagos] = useState<FinAnaCosFinaPagoItem[]>([]);
  const [cuotas, setCuotas] = useState<CobrosCuotaItem[]>([]);
  const [pagoId, setPagoId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [cuotaId, setCuotaId] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [cobros, setCobros] = useState<CobroRegistrado[]>([]);
  const [plazoDias, setPlazoDias] = useState("");

  const esVenta = comprobante != null && esFacturaTipoVenta(comprobante.tipo);
  const totalCents = totalCentsDeComprobante(comprobante);
  const cobradoCents = cobros.reduce((acc, c) => acc + c.montoCents, 0);
  const pendienteCents = Math.max(0, totalCents - cobradoCents);
  const esCuentaCorriente = esFormaPagoCuentaCorriente(pagoId);

  const pagoSel = useMemo(
    () => pagos.find((p) => p.id === pagoId) ?? null,
    [pagos, pagoId]
  );
  const muestraCuotas = Boolean(!esCuentaCorriente && pagoSel?.aceptaCuotas);
  const yaHayCuentaCorriente = cobros.some((c) => c.esCuentaCorriente);

  const resetFormularioCobro = useCallback(
    (pendiente: number) => {
      setPagoId("");
      setEntidadId("");
      setCuotaId("");
      setPlazoDias(plazoClienteTexto(plazoCuentaCorrienteCliente));
      setMontoNorm(pendiente > 0 ? montoArNumberToNormalizedString(pendiente / 100) : "");
    },
    [plazoCuentaCorrienteCliente]
  );

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

  function handlePagoChange(value: string) {
    const nextId = value === VACIO ? "" : value;
    setPagoId(nextId);
    if (esFormaPagoCuentaCorriente(nextId)) {
      setEntidadId("");
      setCuotaId("");
      setPlazoDias(plazoClienteTexto(plazoCuentaCorrienteCliente));
      if (pendienteCents > 0) {
        setMontoNorm(montoArNumberToNormalizedString(pendienteCents / 100));
      }
      return;
    }
    const next = pagos.find((p) => p.id === nextId);
    const unicas = next?.entidadIds.length === 1 ? next.entidadIds[0] : "";
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
    if (!pagoId) {
      toast.error("Seleccioná una forma de pago.");
      return;
    }
    if (esCuentaCorriente) {
      if (yaHayCuentaCorriente) {
        toast.error("El saldo diferido ya está registrado en cuenta corriente.");
        return;
      }
      const dias = parseDiasVencimiento(plazoDias);
      if (dias == null) {
        toast.error("Ingresá el plazo de cuenta corriente (1 a 365 días).");
        return;
      }
      const montoCents = pendienteCents;
      if (montoCents <= 0) {
        toast.error("No hay saldo pendiente para cuenta corriente.");
        return;
      }
      setCobros((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          pagoNombre: FACTURA_FORMA_PAGO_CUENTA_CORRIENTE_LABEL,
          entidadNombre: "",
          cuotaEtiqueta: null,
          montoCents,
          esCuentaCorriente: true,
          plazoDias: dias,
        },
      ]);
      resetFormularioCobro(0);
      return;
    }
    if (!pagoSel) {
      toast.error("Seleccioná una forma de pago.");
      return;
    }
    if (!entidadId) {
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
        esCuentaCorriente: false,
        plazoDias: null,
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

  const ocupado = pending != null || guardandoVto;

  async function persistirDiasVencimiento(): Promise<boolean> {
    if (!esVenta) return true;
    if (pendienteCents > 0) {
      toast.error(
        "Registrá el saldo pendiente en CUENTA CORRIENTE (el plazo es obligatorio)."
      );
      return false;
    }
    const cuenta = cobros.find((c) => c.esCuentaCorriente);
    const dias = cuenta?.plazoDias ?? null;
    if (cuenta && dias == null) {
      toast.error("Ingresá el plazo de cuenta corriente (1 a 365 días).");
      return false;
    }
    if (!comprobanteId) {
      if (dias != null) {
        toast.error("No se pudieron guardar los días de vencimiento.");
        return false;
      }
      return true;
    }
    const res = await guardarDiasVencimientoFacturaAction({
      id: comprobanteId,
      diasVencimiento: dias,
    });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron guardar los días de vencimiento.");
      return false;
    }
    return true;
  }

  async function intentarCerrar() {
    if (ocupado) return;
    setGuardandoVto(true);
    try {
      const ok = await persistirDiasVencimiento();
      if (ok) onOpenChange(false);
    } finally {
      setGuardandoVto(false);
    }
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
      const okVto = await persistirDiasVencimiento();
      if (!okVto) return;
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
      if (!esVenta) onOpenChange(false);
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
        else void intentarCerrar();
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
            onClick={() => void intentarCerrar()}
            disabled={ocupado}
          >
            Cancelar
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          {esVenta ? (
            <section className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                COBRO
              </p>
              <p className="text-sm tabular-nums text-foreground">
                SALDO PENDIENTE: {montoArCentsToDisplayWithCurrency(pendienteCents, "$")}
              </p>

              {formCobroVisible ? (
                <div className="flex items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <ModalMicroLabel>FORMA DE PAGO</ModalMicroLabel>
                    <Select
                      value={pagoId || VACIO}
                      onValueChange={handlePagoChange}
                      disabled={ocupado}
                    >
                      <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                        <SelectValue placeholder="FORMA DE PAGO" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro"
                      >
                        <SelectItem value={VACIO}>FORMA DE PAGO</SelectItem>
                        {pagos.map((pago) => (
                          <SelectItem key={pago.id} value={pago.id}>
                            {pago.nombre}
                          </SelectItem>
                        ))}
                        <SelectItem value={FACTURA_FORMA_PAGO_CUENTA_CORRIENTE}>
                          {FACTURA_FORMA_PAGO_CUENTA_CORRIENTE_LABEL}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  {esCuentaCorriente ? (
                    <label className="flex w-[7.5rem] shrink-0 flex-col gap-1">
                      <ModalMicroLabel>PLAZO</ModalMicroLabel>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        value={plazoDias}
                        disabled={ocupado}
                        placeholder="DÍAS"
                        onChange={(e) => {
                          const next = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setPlazoDias(next);
                        }}
                        aria-label="Plazo cuenta corriente"
                      />
                    </label>
                  ) : (
                    <>
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
                    </>
                  )}

                  <label className="flex w-[8.5rem] shrink-0 flex-col gap-1">
                    <ModalMicroLabel>MONTO</ModalMicroLabel>
                    <MontoArInput
                      valueNormalized={montoNorm}
                      onValueNormalizedChange={setMontoNorm}
                      disabled={ocupado || esCuentaCorriente}
                      aria-label="Monto a pagar"
                    />
                  </label>
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
                        {cobro.esCuentaCorriente && cobro.plazoDias != null
                          ? ` · ${cobro.plazoDias} DÍAS`
                          : ""}
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

          <section className={cn("flex flex-col gap-2", esVenta && "border-t border-border pt-4")}>
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">
              COMPROBANTE
            </p>
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
            <div className="flex flex-nowrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                className="h-10 min-w-0 flex-1 justify-center gap-2"
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
                className="h-10 min-w-0 flex-1 justify-center gap-2"
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
                className="h-10 min-w-0 flex-1 justify-center gap-2"
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
          </section>
        </div>
      </AppModal>
    </Dialog>
  );
}
