"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  asignarNotaCreditoComoCobroAction,
  listarCatalogoCobroFacturaAction,
  listarCobrosComprobanteFacturaAction,
  listarVistaCobroNotaCreditoAction,
  registrarCobroComprobanteFacturaAction,
} from "@/actions/factura";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
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
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import {
  FACTURA_COBRO_NOTA_CREDITO_LABEL,
  FACTURA_COBRO_NOTA_CREDITO_UI_ID,
  esCobroNotaCreditoNombre,
  lineasFormaPagoCobro,
  ncPermiteDevolucion,
  type FacturaComprobanteCobroItem,
  type FacturaNcCobroVista,
} from "@/lib/factura";
import {
  formatInstanteDdMmYyHhMmArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import {
  iconoFormaPagoDesdeNombre,
  type FinAnaCosFinaPagoItem,
} from "@/lib/finAnaCosFinaPagos";
import {
  montoArCentsToDisplayWithCurrency,
  montoArNormalizedStringToCents,
  montoArNumberToNormalizedString,
} from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

const VACIO = "none";
const BOTON_FORMA_PAGO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";
const COMPROBANTE_LINK_CLASS = cn(
  "h-auto min-h-0 px-0 py-0 font-semibold tabular-nums underline",
  "!h-auto !min-h-0 !p-0"
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobanteId: string | null;
  nroComprobante: string;
  /** NC: ver imputaciones y asignarla como pago de una venta. */
  esNotaCredito?: boolean;
};

export default function FacturaComprobanteCobrosModal({
  open,
  onOpenChange,
  comprobanteId,
  nroComprobante,
  esNotaCredito = false,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<FacturaComprobanteCobroItem[]>([]);
  const [saldoPendiente, setSaldoPendiente] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [pagos, setPagos] = useState<FinAnaCosFinaPagoItem[]>([]);
  const [cuotas, setCuotas] = useState<CobrosCuotaItem[]>([]);
  const [pagoId, setPagoId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [cuotaId, setCuotaId] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [notaCreditoRef, setNotaCreditoRef] = useState("");
  const [vistaNc, setVistaNc] = useState<FacturaNcCobroVista | null>(null);
  const [asignandoVentaId, setAsignandoVentaId] = useState<string | null>(null);
  const [previewComprobanteId, setPreviewComprobanteId] = useState<string | null>(
    null
  );

  const haySaldo = saldoPendiente != null && saldoPendiente > 0;
  const pagosDisponibles = useMemo<FinAnaCosFinaPagoItem[]>(
    () => [
      {
        id: FACTURA_COBRO_NOTA_CREDITO_UI_ID,
        nombre: FACTURA_COBRO_NOTA_CREDITO_LABEL,
        enCostosFinancieros: false,
        enMargenContribucion: false,
        aceptaCuotas: false,
        entidadObligatoria: false,
        entidadIds: [],
        entidadNombres: [],
      },
      ...pagos,
    ],
    [pagos]
  );
  const pagoSel = useMemo(
    () =>
      (esNotaCredito ? pagos : pagosDisponibles).find((p) => p.id === pagoId) ??
      null,
    [esNotaCredito, pagos, pagosDisponibles, pagoId]
  );
  const pagoEsNotaCredito = pagoSel?.id === FACTURA_COBRO_NOTA_CREDITO_UI_ID;
  const muestraCuotas = Boolean(pagoSel?.aceptaCuotas);
  const muestraEntidad = Boolean(pagoSel?.entidadObligatoria);
  const historialNc = useMemo(() => {
    const asign = (vistaNc?.asignaciones ?? []).map((fila) => ({
      kind: "asig" as const,
      id: fila.id,
      createdAtIso: fila.createdAtIso,
      montoCents: fila.montoCents,
      personalNombre: fila.personalNombre,
      comprobanteId: fila.comprobanteId,
      comprobanteNro: fila.comprobanteNro,
    }));
    const devs = (vistaNc?.devoluciones ?? []).map((fila) => ({
      kind: "dev" as const,
      id: fila.id,
      createdAtIso: fila.createdAtIso,
      montoCents: fila.montoCents,
      personalNombre: fila.personalNombre,
      cobro: fila,
    }));
    return [...asign, ...devs].sort((a, b) =>
      a.createdAtIso < b.createdAtIso ? 1 : a.createdAtIso > b.createdAtIso ? -1 : 0
    );
  }, [vistaNc]);

  const resetFormulario = useCallback((pendiente: number | null) => {
    setPagoId("");
    setEntidadId("");
    setCuotaId("");
    setNotaCreditoRef("");
    setMontoNorm(
      pendiente != null && pendiente > 0
        ? montoArNumberToNormalizedString(pendiente)
        : ""
    );
  }, []);

  const cargarCobros = useCallback(
    async (id: string) => {
      const res = await listarCobrosComprobanteFacturaAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        setItems([]);
        setSaldoPendiente(null);
        return;
      }
      setItems(res.data.items);
      setSaldoPendiente(res.data.saldoPendiente);
      resetFormulario(res.data.saldoPendiente);
    },
    [resetFormulario]
  );

  useEffect(() => {
    if (!open || !comprobanteId || esNotaCredito) return;
    const id = comprobanteId;
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setFormAbierto(false);
    });
    void listarCobrosComprobanteFacturaAction({ id }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setItems([]);
        setSaldoPendiente(null);
        return;
      }
      setItems(res.data.items);
      setSaldoPendiente(res.data.saldoPendiente);
      resetFormulario(res.data.saldoPendiente);
    });
    return () => {
      cancelled = true;
    };
  }, [open, comprobanteId, esNotaCredito, resetFormulario]);

  const cargarVistaNc = useCallback(async (id: string) => {
    const res = await listarVistaCobroNotaCreditoAction({ id });
    if (!res.ok) {
      toast.error(res.error);
      setVistaNc(null);
      return;
    }
    setVistaNc(res.data);
    resetFormulario(
      ncPermiteDevolucion(res.data) ? res.data.saldoDisponible : null
    );
  }, [resetFormulario]);

  useEffect(() => {
    if (!open || !comprobanteId || !esNotaCredito) return;
    const id = comprobanteId;
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    void listarVistaCobroNotaCreditoAction({ id }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setVistaNc(null);
        return;
      }
      setVistaNc(res.data);
      resetFormulario(
        ncPermiteDevolucion(res.data) ? res.data.saldoDisponible : null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, comprobanteId, esNotaCredito, resetFormulario]);

  async function asignarNc(ventaId: string) {
    if (!comprobanteId || !ventaId) {
      toast.error("Elegí el comprobante.");
      return;
    }
    setAsignandoVentaId(ventaId);
    const res = await asignarNotaCreditoComoCobroAction({
      notaCreditoId: comprobanteId,
      ventaId,
    });
    setAsignandoVentaId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Nota de crédito asignada como pago.");
    await cargarVistaNc(comprobanteId);
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    const cargarCatalogo =
      formAbierto ||
      (esNotaCredito && vistaNc != null && ncPermiteDevolucion(vistaNc));
    if (!cargarCatalogo) return;
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
  }, [open, formAbierto, esNotaCredito, vistaNc]);

  function handlePagoChange(nextId: string) {
    if (nextId === pagoId) return;
    setPagoId(nextId);
    setNotaCreditoRef("");
    const lista = esNotaCredito ? pagos : pagosDisponibles;
    const next = lista.find((p) => p.id === nextId);
    const unicas =
      next?.entidadObligatoria && next.entidadIds.length === 1 ? next.entidadIds[0] : "";
    setEntidadId(unicas);
    setCuotaId("");
  }

  async function persistirCobro() {
    if (!comprobanteId) return;
    if (esNotaCredito && (vistaNc == null || !ncPermiteDevolucion(vistaNc))) {
      toast.error(
        "La devolución solo aplica si no quedan ventas para imputar y hay saldo disponible."
      );
      return;
    }
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
    const saldoLimite = esNotaCredito
      ? vistaNc != null && ncPermiteDevolucion(vistaNc)
        ? vistaNc.saldoDisponible
        : 0
      : (saldoPendiente ?? 0);
    const saldoCents = Math.round(saldoLimite * 100);
    if (montoCents > saldoCents) {
      toast.error(
        esNotaCredito
          ? "El monto no puede ser mayor al saldo disponible."
          : "El monto no puede ser mayor al saldo pendiente."
      );
      return;
    }
    const referenciaNc = notaCreditoRef.trim().toLocaleUpperCase("es-AR");
    if (!esNotaCredito && pagoEsNotaCredito && !referenciaNc) {
      toast.error("Ingresá la referencia de la nota de crédito.");
      return;
    }
    const entidadIdx = pagoSel.entidadIds.indexOf(entidadId);
    const entidadNombre = pagoSel.entidadNombres[entidadIdx] ?? "";
    const cuota = cuotas.find((c) => c.id === cuotaId);
    setGuardando(true);
    const res = await registrarCobroComprobanteFacturaAction({
      id: comprobanteId,
      pagoNombre: pagoSel.nombre,
      entidadNombre: pagoEsNotaCredito ? referenciaNc : entidadNombre,
      cuotaEtiqueta: cuota?.cuotas ?? null,
      montoCents,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(esNotaCredito ? "Devolución registrada." : "Cobro registrado.");
    setFormAbierto(false);
    if (esNotaCredito) {
      await cargarVistaNc(comprobanteId);
    } else {
      await cargarCobros(comprobanteId);
    }
    router.refresh();
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPreviewComprobanteId(null);
        onOpenChange(next);
      }}
    >
      <AppModal
        size="lg"
        padding="sm"
        className="max-w-[43.2rem]"
        title={`COBROS ${nroComprobante}`.trim()}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : esNotaCredito ? (
          <div className="flex min-h-0 flex-col gap-3">
            <p className="shrink-0 text-center text-xl font-bold uppercase tracking-wide tabular-nums text-foreground">
              SALDO DISPONIBLE:{" "}
              {montoArCentsToDisplayWithCurrency(
                Math.round((vistaNc?.saldoDisponible ?? 0) * 100),
                "$"
              )}
            </p>
            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[7.5rem]">FECHA</TableHead>
                    <TableHead>COMPROBANTE</TableHead>
                    <TableHead className="w-[6.5rem] text-right">MONTO</TableHead>
                    <TableHead className="w-[8rem]">PERSONAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historialNc.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      message="Esta nota de crédito no está asignada como pago."
                    />
                  ) : (
                    historialNc.map((fila) => {
                      const detalleDev =
                        fila.kind === "dev" ? lineasFormaPagoCobro(fila.cobro) : null;
                      return (
                        <TableRow key={fila.id}>
                          <TableCell className="celda-datos tabular-nums">
                            {formatInstanteDdMmYyHhMmArgentina(new Date(fila.createdAtIso))}
                          </TableCell>
                          <TableCell className="celda-datos tabular-nums">
                            {fila.kind === "asig" ? (
                              <Button
                                type="button"
                                variant="link"
                                aria-label={`Ver ${fila.comprobanteNro}`}
                                className={COMPROBANTE_LINK_CLASS}
                                onClick={() => setPreviewComprobanteId(fila.comprobanteId)}
                              >
                                {fila.comprobanteNro}
                              </Button>
                            ) : (
                              <span className="flex flex-col gap-0.5 text-left">
                                <span>DEVOLUCIÓN · {detalleDev?.linea1}</span>
                                {detalleDev?.linea2 ? (
                                  <span className="font-normal">{detalleDev.linea2}</span>
                                ) : null}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="celda-datos text-right tabular-nums">
                            {montoArCentsToDisplayWithCurrency(fila.montoCents, "$")}
                          </TableCell>
                          <TableCell className="celda-datos text-left">
                            {fmtCelda(fila.personalNombre)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {(vistaNc?.saldoDisponible ?? 0) > 0 &&
            (vistaNc?.ventas.length ?? 0) > 0 ? (
              <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
                <Table className="w-full table-fixed text-center">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[34%]" />
                    <col className="w-[22%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">FECHA</TableHead>
                      <TableHead className="text-center">COMPROBANTE</TableHead>
                      <TableHead className="text-center">SALDO</TableHead>
                      <TableHead className="text-center">ASIGNAR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vistaNc?.ventas.map((venta) => (
                      <TableRow key={venta.id}>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {formatIsoYmdDdMmYyyyArgentina(venta.fechaIso)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          <Button
                            type="button"
                            variant="link"
                            aria-label={`Ver ${venta.nroComprobante}`}
                            className={cn(
                              "h-auto min-h-0 px-0 py-0 font-semibold tabular-nums underline",
                              "!h-auto !min-h-0 !p-0"
                            )}
                            onClick={() => setPreviewComprobanteId(venta.id)}
                          >
                            {venta.nroComprobante}
                          </Button>
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          ${fmtPrecio(venta.saldoPendiente)}
                        </TableCell>
                        <TableCell className="celda-datos text-center">
                          <Button
                            type="button"
                            size="sm"
                            aria-label={`Asignar a ${venta.nroComprobante}`}
                            disabled={asignandoVentaId != null}
                            onClick={() => void asignarNc(venta.id)}
                          >
                            Asignar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            {vistaNc != null && ncPermiteDevolucion(vistaNc) ? (
              <div className="flex shrink-0 flex-col gap-3">
                <p className="shrink-0 text-center text-xl font-bold uppercase tracking-wide tabular-nums text-foreground">
                  DEVOLUCIÓN:{" "}
                  {montoArCentsToDisplayWithCurrency(
                    Math.round((vistaNc?.saldoDisponible ?? 0) * 100),
                    "$"
                  )}
                </p>
                {pagos.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No hay formas de pago cargadas.
                  </p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Forma de devolución"
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
                          disabled={guardando}
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
                        onValueChange={(value) =>
                          setEntidadId(value === VACIO ? "" : value)
                        }
                        disabled={guardando || !pagoSel}
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
                        onValueChange={(value) =>
                          setCuotaId(value === VACIO ? "" : value)
                        }
                        disabled={guardando}
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
                      disabled={guardando}
                      aria-label="Monto a devolver"
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 shrink-0 gap-2"
                    disabled={guardando}
                    onClick={() => void persistirCobro()}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    Agregar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            {haySaldo ? (
              <p className="shrink-0 text-center text-xl font-bold uppercase tracking-wide tabular-nums text-foreground">
                SALDO PENDIENTE:{" "}
                {montoArCentsToDisplayWithCurrency(
                  Math.round((saldoPendiente ?? 0) * 100),
                  "$"
                )}
              </p>
            ) : null}
            <div className="contenedor-tabla-gestion min-h-0 max-h-[50vh] overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[7.5rem]">FECHA</TableHead>
                    <TableHead>FORMA PAGO</TableHead>
                    <TableHead className="w-[6.5rem] text-right">MONTO</TableHead>
                    <TableHead className="w-[8rem]">PERSONAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <EmptyTableRow colSpan={4} message="No hay cobros registrados." />
                  ) : (
                    items.map((cobro) => {
                      const { linea1, linea2 } = lineasFormaPagoCobro(cobro);
                      const previewNcId =
                        esCobroNotaCreditoNombre(cobro.pagoNombre)
                          ? cobro.notaCreditoId
                          : null;
                      return (
                        <TableRow key={cobro.id}>
                          <TableCell className="celda-datos tabular-nums">
                            {formatInstanteDdMmYyHhMmArgentina(new Date(cobro.createdAtIso))}
                          </TableCell>
                          <TableCell className="celda-datos text-left">
                            <span className="flex flex-col gap-0.5">
                              {previewNcId ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  aria-label={`Ver ${cobro.entidadNombre.trim()}`}
                                  className={cn(
                                    COMPROBANTE_LINK_CLASS,
                                    "justify-start text-left"
                                  )}
                                  onClick={() => setPreviewComprobanteId(previewNcId)}
                                >
                                  {linea1}
                                </Button>
                              ) : (
                                <span>{linea1}</span>
                              )}
                              {linea2 ? (
                                <span className="font-normal">{linea2}</span>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="celda-datos text-right tabular-nums">
                            {montoArCentsToDisplayWithCurrency(cobro.montoCents, "$")}
                          </TableCell>
                          <TableCell className="celda-datos text-left">
                            {fmtCelda(cobro.personalNombre)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {haySaldo && !formAbierto ? (
              <div className="flex shrink-0 justify-center">
                <Button
                  type="button"
                  size="icon"
                  aria-label="Agregar cobro"
                  disabled={guardando}
                  onClick={() => {
                    resetFormulario(saldoPendiente);
                    setFormAbierto(true);
                  }}
                >
                  <Plus className="size-5 shrink-0" aria-hidden />
                </Button>
              </div>
            ) : null}
            {haySaldo && formAbierto ? (
              <div className="flex shrink-0 flex-col gap-3">
                {pagosDisponibles.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No hay formas de pago cargadas.
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
                          disabled={guardando}
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
                {pagoEsNotaCredito ? (
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <ModalMicroLabel>COMPROBANTE NC</ModalMicroLabel>
                    <Input
                      value={notaCreditoRef}
                      onChange={(e) =>
                        setNotaCreditoRef(e.target.value.toLocaleUpperCase("es-AR"))
                      }
                      placeholder="EJ: 00001-00001234"
                      disabled={guardando}
                      className="w-full"
                    />
                  </label>
                ) : null}
                <div className="flex items-end justify-center gap-2">
                  {muestraEntidad ? (
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <ModalMicroLabel>ENTIDAD</ModalMicroLabel>
                      <Select
                        value={entidadId || VACIO}
                        onValueChange={(value) =>
                          setEntidadId(value === VACIO ? "" : value)
                        }
                        disabled={guardando || !pagoSel}
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
                        onValueChange={(value) =>
                          setCuotaId(value === VACIO ? "" : value)
                        }
                        disabled={guardando}
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
                      disabled={guardando}
                      aria-label="Monto a pagar"
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 shrink-0 gap-2"
                    disabled={guardando}
                    onClick={() => void persistirCobro()}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    Agregar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </AppModal>
    </Dialog>
    <FacturaComprobanteDetalleModal
      open={previewComprobanteId != null}
      onOpenChange={(next) => {
        if (!next) setPreviewComprobanteId(null);
      }}
      comprobanteId={previewComprobanteId}
    />
    </>
  );
}
