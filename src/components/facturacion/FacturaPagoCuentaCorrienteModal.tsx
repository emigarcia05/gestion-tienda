"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listarCatalogoCobroFacturaAction,
  listarVentasPendientesPagoCuentaCorrienteAction,
  registrarPagoCuentaCorrienteAction,
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
  esCobroNotaCreditoNombre,
  imputarPagoFifoVentas,
  totalSaldoVentasPendientes,
  type FacturaVentaPendientePago,
} from "@/lib/factura";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import {
  iconoFormaPagoDesdeNombre,
  type FinAnaCosFinaPagoItem,
} from "@/lib/finAnaCosFinaPagos";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import { cn } from "@/lib/utils";

const VACIO = "none";
const BOTON_FORMA_PAGO_CLASS =
  "h-16 w-[6.5rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | null;
  onRegistrado: () => void;
};

export default function FacturaPagoCuentaCorrienteModal({
  open,
  onOpenChange,
  clienteId,
  onRegistrado,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ventas, setVentas] = useState<FacturaVentaPendientePago[]>([]);
  const [pagos, setPagos] = useState<FinAnaCosFinaPagoItem[]>([]);
  const [cuotas, setCuotas] = useState<CobrosCuotaItem[]>([]);
  const [pagoId, setPagoId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [cuotaId, setCuotaId] = useState("");
  const [montoNorm, setMontoNorm] = useState("");

  const pagosForma = useMemo(
    () => pagos.filter((p) => !esCobroNotaCreditoNombre(p.nombre)),
    [pagos]
  );
  const pagoSel = useMemo(
    () => pagosForma.find((p) => p.id === pagoId) ?? null,
    [pagosForma, pagoId]
  );
  const muestraCuotas = Boolean(pagoSel?.aceptaCuotas);
  const muestraEntidad = Boolean(pagoSel?.entidadObligatoria);
  const etiquetaMonto =
    !muestraCuotas && pagoSel != null ? pagoSel.nombre : "MONTO";
  const montoCents = montoArNormalizedStringToCents(montoNorm);
  const montoPesos = montoCents / 100;
  const totalPendiente = totalSaldoVentasPendientes(ventas);
  const filas = useMemo(
    () => imputarPagoFifoVentas(ventas, montoPesos),
    [ventas, montoPesos]
  );
  const aFavor = Math.round(Math.max(0, montoPesos - totalPendiente) * 100) / 100;

  useEffect(() => {
    if (!open || !clienteId) return;
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setPagoId("");
      setEntidadId("");
      setCuotaId("");
      setMontoNorm("");
    });
    void Promise.all([
      listarVentasPendientesPagoCuentaCorrienteAction({ clienteId }),
      listarCatalogoCobroFacturaAction(),
    ]).then(([ventasRes, catRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!ventasRes.ok) {
        toast.error(ventasRes.error);
        setVentas([]);
      } else {
        setVentas(ventasRes.data.ventas);
      }
      if (!catRes.ok) {
        toast.error(catRes.error ?? "No se pudieron cargar las formas de pago.");
        setPagos([]);
        setCuotas([]);
        return;
      }
      setPagos(catRes.data.pagos);
      setCuotas(catRes.data.cuotas);
    });
    return () => {
      cancelled = true;
    };
  }, [open, clienteId]);

  function handlePagoChange(nextId: string) {
    if (nextId === pagoId) return;
    setPagoId(nextId);
    const next = pagosForma.find((p) => p.id === nextId);
    const unicas =
      next?.entidadObligatoria && next.entidadIds.length === 1 ? next.entidadIds[0] : "";
    setEntidadId(unicas);
    setCuotaId("");
  }

  async function confirmar() {
    if (!clienteId) return;
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
    if (montoCents <= 0) {
      toast.error("Ingresá un monto a pagar.");
      return;
    }
    const entidadIdx = pagoSel.entidadIds.indexOf(entidadId);
    const entidadNombre = pagoSel.entidadNombres[entidadIdx] ?? "";
    const cuota = cuotas.find((c) => c.id === cuotaId);
    setGuardando(true);
    const res = await registrarPagoCuentaCorrienteAction({
      clienteId,
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
    toast.success("Pago de cuenta corriente registrado.");
    onOpenChange(false);
    onRegistrado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        padding="sm"
        className="max-w-[43.2rem]"
        title="PAGO CUENTA CORRIENTE"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={guardando || loading || montoCents <= 0}
              onClick={() => void confirmar()}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            {pagosForma.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No hay formas de pago cargadas.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Forma de pago"
                className="flex flex-wrap justify-center gap-2"
              >
                {pagosForma.map((pago) => {
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
              <div className="flex w-[8.5rem] shrink-0 flex-col gap-1">
                <ModalMicroLabel>{etiquetaMonto}</ModalMicroLabel>
                <MontoArInput
                  valueNormalized={montoNorm}
                  onValueNormalizedChange={setMontoNorm}
                  disabled={guardando}
                  aria-label="Monto a pagar"
                />
              </div>
            </div>
            {aFavor > 0 ? (
              <p className="text-center text-sm font-semibold tabular-nums">
                SALDO A FAVOR: ${fmtPrecio(aFavor)}
              </p>
            ) : null}
            <div className="contenedor-tabla-gestion min-h-0 max-h-[40vh] overflow-auto">
              <Table className="w-full table-fixed text-center">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[30%]" />
                  <col className="w-[24%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">FECHA</TableHead>
                    <TableHead className="text-center">COMPROBANTE</TableHead>
                    <TableHead className="text-center">SALDO</TableHead>
                    <TableHead className="text-center">ASIGNADO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      message="No hay comprobantes con saldo."
                    />
                  ) : (
                    filas.map((fila) => (
                      <TableRow key={fila.id}>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {formatIsoYmdDdMmYyyyArgentina(fila.fechaIso)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {fila.nroComprobante}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          ${fmtPrecio(fila.saldoPendiente)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {fila.asignado > 0
                            ? `$${fmtPrecio(fila.asignado)}`
                            : fmtCelda("")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </AppModal>
    </Dialog>
  );
}
