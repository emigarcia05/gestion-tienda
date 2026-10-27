"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listarCatalogoCobroFacturaAction } from "@/actions/factura";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import MontoArInput from "@/components/shared/MontoArInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cuotasParaFormaYEntidad, type CobrosCuotaItem } from "@/lib/cobrosCuotas";
import {
  esFacturaTipoVenta,
  FACTURA_TIPO_LABELS,
  filtrarCuotasCatalogoPorDescPromo,
  filtrarPagosCatalogoPorDescPromo,
  nombresPagoPromoFormaPago,
  resumenTotalesFactura,
} from "@/lib/factura";
import {
  descargarPdfFacturaComprobante,
  imprimirPdfFacturaComprobante,
  imprimirYDescargarPdfFacturaComprobante,
} from "@/lib/facturaComprobantePdfClient";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
  maskDigitsToDdMmYyyyDisplay,
  parseDdMmYyyyToIsoYmdArgentina,
} from "@/lib/fechaArgentina";
import {
  iconoFormaPagoDesdeNombre,
  type FinAnaCosFinaPagoItem,
} from "@/lib/finAnaCosFinaPagos";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";
import {
  montoArCentsToDisplayPesoEntero,
  montoArCentsToNormalizedString,
  montoArCentsTopePesoEntero,
  montoArNormalizedStringToCents,
} from "@/lib/montoArMask";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { CobroFacturaEmitirInput } from "@/lib/validations/factura";

export type FacturaGenerarComprobanteAccion =
  | "emitir"
  | "imprimir"
  | "descargar"
  | "ambos";

const VACIO = "none";
type PasoGenerarComprobante = "cobro" | "generar";

const SECCION_MODAL_CLASS =
  "flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4";
const BOTON_GENERAR_CLASS =
  "h-14 min-h-14 w-full min-w-0 shrink flex-col gap-0.5 whitespace-normal border border-primary px-1.5 py-1 hover:bg-primary hover:text-primary-foreground hover:brightness-90 hover:[&_svg]:text-primary-foreground";
const BOTON_FORMA_PAGO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";
const COBRO_RESUMEN_FILA_CLASS =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-2 py-2";
const COBRO_RESUMEN_LINEA_SUAVE_CLASS = "border-b border-primary/40";
const COBRO_RESUMEN_LINEA_GRUESA_CLASS = "border-b-2 border-primary";

function etiquetaFormaPagoCobroRegistrado(cobro: {
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  fechaAcreditacionIso?: string;
}): string {
  return [
    cobro.pagoNombre,
    cobro.entidadNombre,
    cobro.cuotaEtiqueta,
    cobro.fechaAcreditacionIso
      ? `ACR. ${formatIsoYmdDdMmYyyyArgentina(cobro.fechaAcreditacionIso)}`
      : null,
  ]
    .filter((parte): parte is string => Boolean(parte?.trim()))
    .join(" · ");
}

function abrirSelectorFechaNativo(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    void el.showPicker?.();
  } catch {
    el.click();
  }
}

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

type CobroRegistrado = {
  id: string;
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  fechaAcreditacionIso?: string;
  montoCents: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobante: FacturaComprobantePdfInput | null;
  /** Persiste el comprobante (ARCA si aplica) y devuelve el PDF con nro/CAE. */
  onEmitir: (cobros: CobroFacturaEmitirInput[]) => Promise<FacturaComprobantePdfInput | null>;
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
 * Modal **Generar Comprobante**: paso **COBRO** (solo ventas) y luego **GENERAR COMPROBANTE**.
 * Pago completo (Agregar deja saldo 0) avanza solo; si no, **Continuar Con Saldo Impago**.
 * **Generar** emite sin imprimir ni PDF. Imprimir / Descargar / Imprimir & Descargar también emiten.
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
  const [fechaAcreditacionDdMmYyyy, setFechaAcreditacionDdMmYyyy] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [cobros, setCobros] = useState<CobroRegistrado[]>([]);
  const [paso, setPaso] = useState<PasoGenerarComprobante>("cobro");
  const hiddenFechaAcreditacionRef = useRef<HTMLInputElement>(null);

  const esVenta = comprobante != null && esFacturaTipoVenta(comprobante.tipo);
  const totalCents = totalCentsDeComprobante(comprobante);
  const cobradoCents = cobros.reduce((acc, c) => acc + c.montoCents, 0);
  const pendienteCents = Math.max(0, totalCents - cobradoCents);
  const pagosDisponibles = useMemo(
    () => filtrarPagosCatalogoPorDescPromo(pagos, comprobante?.descuento ?? null),
    [pagos, comprobante?.descuento]
  );
  const nombresPagoPromo = useMemo(
    () => nombresPagoPromoFormaPago(comprobante?.descuento ?? null),
    [comprobante?.descuento]
  );

  const pagoSel = useMemo(
    () => pagosDisponibles.find((p) => p.id === pagoId) ?? null,
    [pagosDisponibles, pagoId]
  );
  const cuotasOpciones = useMemo(
    () =>
      filtrarCuotasCatalogoPorDescPromo(
        cuotasParaFormaYEntidad(cuotas, pagoId, entidadId),
        pagoId,
        comprobante?.descuento ?? null
      ),
    [cuotas, pagoId, entidadId, comprobante?.descuento]
  );
  const muestraCuotas = cuotasOpciones.length > 0;
  const muestraEntidad = (pagoSel?.entidadIds.length ?? 0) > 0;
  const fechaAcreditacionIso = useMemo(
    () => parseDdMmYyyyToIsoYmdArgentina(fechaAcreditacionDdMmYyyy),
    [fechaAcreditacionDdMmYyyy]
  );
  const fechaAcreditacionIsoParaPicker = useMemo(
    () => (fechaAcreditacionIso !== "" ? fechaAcreditacionIso : dateToIsoYmdArgentina(new Date())),
    [fechaAcreditacionIso]
  );

  const resetFormularioCobro = useCallback((pendiente: number) => {
    setPagoId("");
    setEntidadId("");
    setCuotaId("");
    setFechaAcreditacionDdMmYyyy("");
    setMontoNorm(
      pendiente > 0 ? montoArCentsToNormalizedString(montoArCentsTopePesoEntero(pendiente)) : ""
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    setCobros([]);
    setPaso(
      comprobante != null && esFacturaTipoVenta(comprobante.tipo)
        ? "cobro"
        : "generar"
    );
    resetFormularioCobro(totalCentsDeComprobante(comprobante));
  }, [open, comprobante, resetFormularioCobro]);

  useEffect(() => {
    if (!open || !esVenta) return;
    let cancelled = false;
    const sucursalCodigo = leerUsuarioSesion()?.sucursalPorDefecto;
    void (sucursalCodigo
      ? listarCatalogoCobroFacturaAction({ sucursalCodigo })
      : Promise.resolve({
          ok: true as const,
          data: {
            pagos: [] as FinAnaCosFinaPagoItem[],
            cuotas: [] as CobrosCuotaItem[],
          },
        })
    ).then((res) => {
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

  useEffect(() => {
    if (!open || !esVenta) return;
    if (pagosDisponibles.length !== 1 || pagoId !== "") return;
    const unico = pagosDisponibles[0];
    setPagoId(unico.id);
    setEntidadId(unico.entidadIds.length === 1 ? unico.entidadIds[0] : "");
    setCuotaId("");
    setFechaAcreditacionDdMmYyyy(
      unico.fechaAcreditacionVariable
        ? formatIsoYmdDdMmYyyyArgentina(dateToIsoYmdArgentina(new Date()))
        : ""
    );
  }, [open, esVenta, pagosDisponibles, pagoId]);

  function handlePagoChange(nextId: string) {
    if (nextId === pagoId) return;
    setPagoId(nextId);
    const next = pagosDisponibles.find((p) => p.id === nextId);
    const unicas =
      next && next.entidadIds.length === 1 ? next.entidadIds[0] : "";
    setEntidadId(unicas);
    setCuotaId("");
    setFechaAcreditacionDdMmYyyy(
      next?.fechaAcreditacionVariable
        ? formatIsoYmdDdMmYyyyArgentina(dateToIsoYmdArgentina(new Date()))
        : ""
    );
  }

  function handleEntidadChange(value: string) {
    setEntidadId(value === VACIO ? "" : value);
    setCuotaId("");
  }

  function handleCuotaChange(value: string) {
    setCuotaId(value === VACIO ? "" : value);
  }

  function cobroDesdeFormulario():
    | { ok: true; cobro: Omit<CobroRegistrado, "id"> | null }
    | { ok: false; error: string } {
    if (!pagoSel) return { ok: true, cobro: null };
    if ((pagoSel.entidadIds.length > 0) && !entidadId) {
      return { ok: false, error: "Seleccioná una entidad." };
    }
    if (muestraCuotas && !cuotaId) {
      return { ok: false, error: "Seleccioná las cuotas." };
    }
    if (pagoSel.fechaAcreditacionVariable && !fechaAcreditacionIso) {
      return { ok: false, error: "Ingresá la fecha de acreditación." };
    }
    const montoCents = montoArNormalizedStringToCents(montoNorm);
    if (montoCents <= 0) {
      return { ok: false, error: "Ingresá un monto a pagar." };
    }
    if (montoCents > montoArCentsTopePesoEntero(pendienteCents)) {
      return { ok: false, error: "El monto no puede ser mayor al saldo pendiente." };
    }
    const entidadIdx = pagoSel.entidadIds.indexOf(entidadId);
    const entidadNombre = pagoSel.entidadNombres[entidadIdx] ?? "";
    const cuota = cuotas.find((c) => c.id === cuotaId);
    return {
      ok: true,
      cobro: {
        pagoNombre: pagoSel.nombre,
        entidadNombre,
        cuotaEtiqueta: cuota?.cuotas ?? null,
        fechaAcreditacionIso: pagoSel.fechaAcreditacionVariable
          ? fechaAcreditacionIso
          : undefined,
        montoCents,
      },
    };
  }

  function agregarCobro() {
    const res = cobroDesdeFormulario();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.cobro == null) {
      toast.error("Seleccioná una forma de pago.");
      return;
    }
    const siguientePendiente = pendienteCents - res.cobro.montoCents;
    const fila: CobroRegistrado = {
      id: crypto.randomUUID(),
      pagoNombre: res.cobro.pagoNombre,
      entidadNombre: res.cobro.entidadNombre,
      cuotaEtiqueta: res.cobro.cuotaEtiqueta,
      fechaAcreditacionIso: res.cobro.fechaAcreditacionIso,
      montoCents: res.cobro.montoCents,
    };
    setCobros((prev) => [...prev, fila]);
    resetFormularioCobro(siguientePendiente);
    if (siguientePendiente <= 0) {
      setPaso("generar");
    }
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
    const cobrosEmitir: CobroFacturaEmitirInput[] = cobros.map(
      ({
        pagoNombre,
        entidadNombre,
        cuotaEtiqueta,
        fechaAcreditacionIso,
        montoCents,
      }) => ({
        pagoNombre,
        entidadNombre: entidadNombre ?? "",
        cuotaEtiqueta,
        fechaAcreditacionIso,
        montoCents,
      })
    );
    setPending(accion);
    try {
      const emitido = await onEmitir(cobrosEmitir);
      if (emitido == null) return;
      if (accion === "emitir") {
        toast.success("Comprobante generado.");
      } else {
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
  const mostrarPasoCobro = esVenta && paso === "cobro";
  const mostrarPasoGenerar = !esVenta || paso === "generar";
  const tituloModal = mostrarPasoCobro
    ? "COBRO"
    : mostrarPasoGenerar
      ? "GENERAR COMPROBANTE"
      : tituloComprobante(comprobante);

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
        title={tituloModal}
        actions={
          <>
            {esVenta && paso === "generar" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaso("cobro")}
                disabled={ocupado}
              >
                Volver
              </Button>
            ) : null}
          <Button
            type="button"
            variant="outline"
              onClick={cerrarSinEmitir}
            disabled={ocupado}
          >
            Cancelar
          </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {mostrarPasoCobro ? (
            <section className={SECCION_MODAL_CLASS}>
              <p className="text-center text-xl font-bold uppercase tracking-wide tabular-nums text-foreground">
                SALDO PENDIENTE: {montoArCentsToDisplayPesoEntero(pendienteCents, "$")}
              </p>

              {formCobroVisible ? (
                <div className="flex flex-col gap-3">
                  {pagosDisponibles.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      {nombresPagoPromo.length > 0
                        ? `Este descuento solo admite ${nombresPagoPromo.join(" / ")}.`
                        : "No hay formas de pago cargadas."}
                    </p>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Forma de pago"
                      className="flex flex-wrap justify-center gap-2"
                    >
                        {pagosDisponibles.map((pago) => {
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
                          {cuotasOpciones.map((cuota) => (
                            <SelectItem key={cuota.id} value={cuota.id}>
                              {cuota.cuotas}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  ) : null}

                  <label className="flex w-[8.5rem] shrink-0 flex-col gap-1">
                    <ModalMicroLabel>MONTO</ModalMicroLabel>
                    <MontoArInput
                      valueNormalized={montoNorm}
                      onValueNormalizedChange={setMontoNorm}
                      soloPesosEnteros
                      disabled={ocupado}
                      aria-label="Monto a pagar"
                    />
                  </label>
                  {pagoSel?.fechaAcreditacionVariable ? (
                    <label className="flex w-[10.5rem] shrink-0 flex-col gap-1">
                      <ModalMicroLabel>FECHA ACREDITACIÓN</ModalMicroLabel>
                      <div className="relative w-full">
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="dd/mm/aaaa"
                          value={fechaAcreditacionDdMmYyyy}
                          onChange={(e) =>
                            setFechaAcreditacionDdMmYyyy(
                              maskDigitsToDdMmYyyyDisplay(e.target.value)
                            )
                          }
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            abrirSelectorFechaNativo(hiddenFechaAcreditacionRef.current);
                          }}
                          disabled={ocupado}
                          className="h-9 pr-10 tabular-nums"
                          aria-label="Fecha de acreditación (dd/mm/aaaa). Ícono de calendario o doble clic para calendario."
                          title="Ícono de calendario o doble clic para abrir el calendario"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={ocupado}
                          className={cn(
                            "absolute right-0 top-0 h-9 w-9 shrink-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            abrirSelectorFechaNativo(hiddenFechaAcreditacionRef.current);
                          }}
                          aria-label="Abrir calendario para fecha de acreditación"
                          title="Abrir calendario"
                        >
                          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                        </Button>
                      </div>
                      <input
                        ref={hiddenFechaAcreditacionRef}
                        type="date"
                        tabIndex={-1}
                        aria-hidden
                        className="sr-only"
                        value={fechaAcreditacionIsoParaPicker}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) setFechaAcreditacionDdMmYyyy(formatIsoYmdDdMmYyyyArgentina(v));
                        }}
                      />
                    </label>
                  ) : null}
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
                <div
                  className="mx-auto flex w-full max-w-md flex-col px-4"
                  role="table"
                  aria-label="Cobros y saldo pendiente"
                >
                  {cobros.map((cobro, i) => {
                    const etiquetaFormaPago = etiquetaFormaPagoCobroRegistrado(cobro);
                    const esUltimo = i === cobros.length - 1;
                    return (
                      <div
                        key={cobro.id}
                        role="row"
                        className={cn(
                          COBRO_RESUMEN_FILA_CLASS,
                          esUltimo
                            ? COBRO_RESUMEN_LINEA_GRUESA_CLASS
                            : COBRO_RESUMEN_LINEA_SUAVE_CLASS
                        )}
                      >
                        <span
                          className="min-w-0 truncate text-center text-sm font-medium uppercase"
                          title={etiquetaFormaPago}
                        >
                          {etiquetaFormaPago}
                        </span>
                        <span className="text-center text-sm font-medium tabular-nums">
                          {montoArCentsToDisplayPesoEntero(cobro.montoCents, "$")}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                            "justify-self-center"
                          )}
                          aria-label="Quitar cobro"
                          disabled={ocupado}
                          onClick={() => quitarCobro(cobro.id)}
                        >
                          <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                  <div
                    role="row"
                    className={cn(COBRO_RESUMEN_FILA_CLASS, "font-semibold")}
                  >
                    <span className="min-w-0 truncate text-center text-sm uppercase">
                      SALDO PENDIENTE
                    </span>
                    <span className="text-center text-sm tabular-nums">
                      {montoArCentsToDisplayPesoEntero(pendienteCents, "$")}
                    </span>
                    <span aria-hidden className="justify-self-center" />
                  </div>
                </div>
              ) : null}

              {pendienteCents > 0 ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={ocupado}
                  onClick={() => setPaso("generar")}
                >
                  Continuar Con Saldo Impago
                </Button>
              ) : null}

            </section>
          ) : null}

          {mostrarPasoGenerar ? (
          <section className={SECCION_MODAL_CLASS}>
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
            <div className="grid grid-cols-4 gap-2">
          <Button
            type="button"
            variant="outline"
                className={BOTON_GENERAR_CLASS}
            disabled={ocupado}
                aria-label="Generar"
                onClick={() => void ejecutar("emitir")}
          >
                {pending === "emitir" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
                  <span className="text-center text-[0.7rem] font-semibold uppercase leading-tight tracking-wide">
                    GENERAR
                  </span>
            )}
          </Button>
              {ACCIONES_GENERAR.map((accion) => (
          <Button
                  key={accion.id}
            type="button"
            variant="outline"
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
          ) : null}
        </div>
      </AppModal>
    </Dialog>
  );
}
