"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listarCatalogoCobroFacturaAction,
  listarCobrosComprobanteFacturaAction,
  registrarCobroComprobanteFacturaAction,
} from "@/actions/factura";
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
  lineasFormaPagoCobro,
  type FacturaComprobanteCobroItem,
} from "@/lib/factura";
import { formatInstanteDdMmYyHhMmArgentina } from "@/lib/fechaArgentina";
import { fmtCelda } from "@/lib/format";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobanteId: string | null;
  nroComprobante: string;
};

export default function FacturaComprobanteCobrosModal({
  open,
  onOpenChange,
  comprobanteId,
  nroComprobante,
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

  const haySaldo = saldoPendiente != null && saldoPendiente > 0;
  const pagoSel = useMemo(
    () => pagos.find((p) => p.id === pagoId) ?? null,
    [pagos, pagoId]
  );
  const muestraCuotas = Boolean(pagoSel?.aceptaCuotas);
  const muestraEntidad = Boolean(pagoSel?.entidadObligatoria);

  const resetFormulario = useCallback((pendiente: number | null) => {
    setPagoId("");
    setEntidadId("");
    setCuotaId("");
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
    if (!open || !comprobanteId) return;
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
  }, [open, comprobanteId, resetFormulario]);

  useEffect(() => {
    if (!open || !formAbierto) return;
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
  }, [open, formAbierto]);

  function handlePagoChange(nextId: string) {
    if (nextId === pagoId) return;
    setPagoId(nextId);
    const next = pagos.find((p) => p.id === nextId);
    const unicas =
      next?.entidadObligatoria && next.entidadIds.length === 1 ? next.entidadIds[0] : "";
    setEntidadId(unicas);
    setCuotaId("");
  }

  async function persistirCobro() {
    if (!comprobanteId) return;
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
    const saldoCents =
      saldoPendiente != null ? Math.round(saldoPendiente * 100) : 0;
    if (montoCents > saldoCents) {
      toast.error("El monto no puede ser mayor al saldo pendiente.");
      return;
    }
    const entidadIdx = pagoSel.entidadIds.indexOf(entidadId);
    const entidadNombre = pagoSel.entidadNombres[entidadIdx] ?? "";
    const cuota = cuotas.find((c) => c.id === cuotaId);
    setGuardando(true);
    const res = await registrarCobroComprobanteFacturaAction({
      id: comprobanteId,
      pagoNombre: pagoSel.nombre,
      entidadNombre,
      cuotaEtiqueta: cuota?.cuotas ?? null,
      montoCents,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cobro registrado.");
    setFormAbierto(false);
    await cargarCobros(comprobanteId);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        padding="sm"
        title={`COBROS ${nroComprobante}`.trim()}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
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
                      return (
                        <TableRow key={cobro.id}>
                          <TableCell className="celda-datos tabular-nums">
                            {formatInstanteDdMmYyHhMmArgentina(new Date(cobro.createdAtIso))}
                          </TableCell>
                          <TableCell className="celda-datos text-left">
                            <span className="flex flex-col gap-0.5">
                              <span>{linea1}</span>
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
  );
}
