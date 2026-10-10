"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import {
  listarCajasPagoProveedorAction,
  listarComprobantesCompraPendientesPagoAction,
  registrarNotaCreditoBonificacionAction,
  registrarPagoCuentaCorrienteProveedoresAction,
} from "@/actions/controlComprobantes";
import { emitirEcheqPagoProveedorAction } from "@/actions/tesoreriaChequesEmitidos";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import MontoArInput from "@/components/shared/MontoArInput";
import NumeroComprobanteBloquesInput from "@/components/shared/NumeroComprobanteBloquesInput";
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
import { imputarPagoFifoVentas, type FacturaVentaPendientePago } from "@/lib/factura";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { montoArNormalizedStringToCents } from "@/lib/montoArMask";
import {
  formatearNumeroComprobanteCompra,
  numeroComprobanteCompraCompleto,
} from "@/lib/numeroComprobanteCompra";
import { cn } from "@/lib/utils";
import type { CajaPagoProveedorOpcion } from "@/services/controlComprobantes.service";

const VACIO = "none";
/** Opción fija junto a las cajas: NC del proveedor por bonificación (sin stock ni tesorería). */
const ORIGEN_NOTA_CREDITO = "__nota_credito__";
const BOTON_CAJA_PAGO_CLASS =
  "h-auto min-h-16 w-[9rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `proveedores.id_proveedor_dux` del proveedor filtrado en Comp. Compras. */
  idProveedorDux: string;
  proveedorNombre: string;
  onRegistrado: () => void;
};

export default function PagoCuentaCorrienteProveedoresModal({
  open,
  onOpenChange,
  idProveedorDux,
  proveedorNombre,
  onRegistrado,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [comprobantes, setComprobantes] = useState<FacturaVentaPendientePago[]>([]);
  const [cajas, setCajas] = useState<CajaPagoProveedorOpcion[]>([]);
  const [cajaId, setCajaId] = useState("");
  const [generarEcheq, setGenerarEcheq] = useState(false);
  const [montoNorm, setMontoNorm] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaPago, setFechaPago] = useState("");
  const [numeroEcheq, setNumeroEcheq] = useState("");
  const [ncPuntoVenta, setNcPuntoVenta] = useState("");
  const [ncNumero, setNcNumero] = useState("");
  const [ncFecha, setNcFecha] = useState("");
  const [ncComprobanteId, setNcComprobanteId] = useState("");

  /** `cajaId` también puede valer `ORIGEN_NOTA_CREDITO`. */
  const esNotaCredito = cajaId === ORIGEN_NOTA_CREDITO;
  const cajaSel = cajas.find((c) => c.id === cajaId) ?? null;
  const esEcheq = cajaSel != null && cajaSel.emiteCheque && generarEcheq;
  const montoCents = montoArNormalizedStringToCents(montoNorm);
  const montoPesos = montoCents / 100;
  /** El eCheq se debita en FECHA PAGO: no se limita al disponible de hoy. */
  const superaDisponible =
    cajaSel != null && !esEcheq && montoPesos > cajaSel.montoDisponible;
  const ncComprobante = comprobantes.find((c) => c.id === ncComprobanteId) ?? null;
  const superaSaldoNc = ncComprobante != null && montoPesos > ncComprobante.saldoPendiente;
  const filas = useMemo(() => {
    if (!esNotaCredito) return imputarPagoFifoVentas(comprobantes, montoPesos);
    return comprobantes.map((c) => ({
      ...c,
      asignado: c.id === ncComprobanteId ? Math.min(montoPesos, c.saldoPendiente) : 0,
    }));
  }, [comprobantes, montoPesos, esNotaCredito, ncComprobanteId]);
  const origenElegido = cajaSel != null || esNotaCredito;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const hoy = dateToIsoYmdArgentina(new Date());
    queueMicrotask(() => {
      setLoading(true);
      setCajaId("");
      setGenerarEcheq(false);
      setMontoNorm("");
      setFechaEmision(hoy);
      setFechaPago("");
      setNumeroEcheq("");
      setNcPuntoVenta("");
      setNcNumero("");
      setNcFecha(hoy);
      setNcComprobanteId("");
    });
    void Promise.all([
      listarComprobantesCompraPendientesPagoAction({ idProveedorDux }),
      listarCajasPagoProveedorAction(),
    ]).then(([compRes, cajasRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!compRes.ok) {
        toast.error(compRes.error);
        setComprobantes([]);
      } else {
        setComprobantes(compRes.data.comprobantes);
      }
      if (!cajasRes.ok) {
        toast.error(cajasRes.error);
        setCajas([]);
      } else {
        setCajas(cajasRes.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, idProveedorDux]);

  function seleccionarCaja(caja: CajaPagoProveedorOpcion) {
    setCajaId(caja.id);
    setGenerarEcheq(caja.emiteCheque && caja.montoDisponible <= 0);
  }

  function finalizarOk(mensaje: string) {
    toast.success(mensaje);
    onOpenChange(false);
    onRegistrado();
  }

  function seleccionarComprobanteNc(id: string) {
    setNcComprobanteId(id);
    const comp = comprobantes.find((c) => c.id === id);
    setMontoNorm(comp ? comp.saldoPendiente.toFixed(2) : "");
  }

  async function confirmarNotaCredito() {
    if (!numeroComprobanteCompraCompleto(ncPuntoVenta, ncNumero)) {
      toast.error("Ingresá el N° de la nota de crédito.");
      return;
    }
    if (!ncFecha) {
      toast.error("Ingresá la fecha de la nota de crédito.");
      return;
    }
    if (!ncComprobante) {
      toast.error("Seleccioná el comprobante que cancela.");
      return;
    }
    if (superaSaldoNc) {
      toast.error("El monto supera el saldo del comprobante.");
      return;
    }
    setGuardando(true);
    const res = await registrarNotaCreditoBonificacionAction({
      idProveedorDux,
      comprobanteId: ncComprobante.id,
      numero: formatearNumeroComprobanteCompra(ncPuntoVenta, ncNumero),
      fecha: ncFecha,
      montoCents,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    finalizarOk("Nota de crédito registrada.");
  }

  async function confirmar() {
    if (montoCents <= 0) {
      toast.error("Ingresá un monto.");
      return;
    }
    if (esNotaCredito) {
      await confirmarNotaCredito();
      return;
    }
    if (!cajaSel) {
      toast.error("Seleccioná la caja de la que sale el pago.");
      return;
    }
    if (esEcheq) {
      if (!fechaEmision || !fechaPago) {
        toast.error("Completá la fecha de emisión y la fecha de pago.");
        return;
      }
      if (fechaPago < fechaEmision) {
        toast.error("La fecha de pago no puede ser anterior a la de emisión.");
        return;
      }
      setGuardando(true);
      const res = await emitirEcheqPagoProveedorAction({
        idProveedorDux,
        cajaId: cajaSel.id,
        montoCents,
        fechaEmision,
        fechaPago,
        numero: numeroEcheq,
      });
      setGuardando(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      finalizarOk("eCheq emitido y aplicado a la cuenta corriente.");
      return;
    }
    if (superaDisponible) {
      toast.error("El monto supera el disponible de la caja.");
      return;
    }
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Elegí un usuario en el menú de sesión.");
      return;
    }
    setGuardando(true);
    const res = await registrarPagoCuentaCorrienteProveedoresAction({
      idProveedorDux,
      cajaId: cajaSel.id,
      montoCents,
      personalId: usuario.idPersonal,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    finalizarOk("Pago de cuenta corriente registrado.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="lg"
        padding="sm"
        className="max-w-[43.2rem]"
        title={`PAGO CUENTA CORRIENTE — ${proveedorNombre}`}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={
                guardando ||
                loading ||
                montoCents <= 0 ||
                !origenElegido ||
                superaDisponible ||
                superaSaldoNc
              }
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
            <div
              role="radiogroup"
              aria-label="Origen del pago"
              className="flex flex-wrap justify-center gap-2"
            >
                {cajas.map((caja) => {
                  const seleccionado = caja.id === cajaId;
                  return (
                    <Button
                      key={caja.id}
                      type="button"
                      role="radio"
                      aria-checked={seleccionado}
                      variant={seleccionado ? "default" : "outline"}
                      disabled={guardando}
                      className={BOTON_CAJA_PAGO_CLASS}
                      title={caja.etiqueta}
                      onClick={() => seleccionarCaja(caja)}
                    >
                      <Landmark className="size-5 shrink-0" aria-hidden />
                      <span className="line-clamp-2 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
                        {caja.etiqueta}
                      </span>
                      <span className="text-[0.65rem] tabular-nums">
                        ${fmtPrecio(caja.montoDisponible)}
                      </span>
                    </Button>
                  );
                })}
              <Button
                type="button"
                role="radio"
                aria-checked={esNotaCredito}
                variant={esNotaCredito ? "default" : "outline"}
                disabled={guardando || comprobantes.length === 0}
                className={BOTON_CAJA_PAGO_CLASS}
                title="Bonificación comercial del proveedor: cancela saldo sin stock ni tesorería"
                onClick={() => {
                  setCajaId(ORIGEN_NOTA_CREDITO);
                  setGenerarEcheq(false);
                  seleccionarComprobanteNc(ncComprobanteId);
                }}
              >
                <ReceiptText className="size-5 shrink-0" aria-hidden />
                <span className="line-clamp-2 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide">
                  NOTA CRÉDITO
                </span>
              </Button>
            </div>
            {cajas.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No hay cajas de tesorería con saldo disponible ni que emitan cheque.
              </p>
            ) : null}
            {esNotaCredito ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>N° NOTA CRÉDITO</ModalMicroLabel>
                  <NumeroComprobanteBloquesInput
                    puntoVenta={ncPuntoVenta}
                    numero={ncNumero}
                    onPuntoVentaChange={setNcPuntoVenta}
                    onNumeroChange={setNcNumero}
                    disabled={guardando}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>FECHA</ModalMicroLabel>
                  <Input
                    type="date"
                    value={ncFecha}
                    onChange={(e) => setNcFecha(e.target.value)}
                    disabled={guardando}
                    className="input-filtro-unificado tabular-nums"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>COMPROBANTE</ModalMicroLabel>
                  <Select
                    value={ncComprobanteId || VACIO}
                    onValueChange={(value) => seleccionarComprobanteNc(value === VACIO ? "" : value)}
                    disabled={guardando}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                      <SelectValue placeholder="COMPROBANTE" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value={VACIO}>COMPROBANTE</SelectItem>
                      {comprobantes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nroComprobante} — ${fmtPrecio(c.saldoPendiente)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>MONTO</ModalMicroLabel>
                  <MontoArInput
                    valueNormalized={montoNorm}
                    onValueNormalizedChange={setMontoNorm}
                    disabled={guardando || !ncComprobante}
                    aria-label="Monto de la nota de crédito"
                  />
                </label>
                {superaSaldoNc ? (
                  <p className="col-span-full text-center text-xs text-destructive">
                    Supera el saldo del comprobante (${fmtPrecio(ncComprobante.saldoPendiente)}).
                  </p>
                ) : null}
              </div>
            ) : null}
            {cajaSel?.emiteCheque ? (
              <ModalSiNoChoice
                label="GENERAR ECHEQ"
                value={generarEcheq}
                onChange={setGenerarEcheq}
                disabled={guardando || cajaSel.montoDisponible <= 0}
              />
            ) : null}
            {esEcheq ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>N° ECHEQ</ModalMicroLabel>
                  <Input
                    value={numeroEcheq}
                    onChange={(e) => setNumeroEcheq(e.target.value)}
                    maxLength={50}
                    placeholder="Opcional"
                    disabled={guardando}
                    className="input-filtro-unificado tabular-nums"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>FECHA EMISIÓN</ModalMicroLabel>
                  <Input
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    disabled={guardando}
                    className="input-filtro-unificado tabular-nums"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>FECHA PAGO</ModalMicroLabel>
                  <Input
                    type="date"
                    value={fechaPago}
                    min={fechaEmision || undefined}
                    onChange={(e) => setFechaPago(e.target.value)}
                    disabled={guardando}
                    className="input-filtro-unificado tabular-nums"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>MONTO</ModalMicroLabel>
                  <MontoArInput
                    valueNormalized={montoNorm}
                    onValueNormalizedChange={setMontoNorm}
                    disabled={guardando}
                    aria-label="Monto del eCheq"
                  />
                </label>
              </div>
            ) : esNotaCredito ? null : (
              <div className="flex flex-col items-center gap-1">
                <label className="flex w-[8.5rem] shrink-0 flex-col gap-1">
                  <ModalMicroLabel>MONTO</ModalMicroLabel>
                  <MontoArInput
                    valueNormalized={montoNorm}
                    onValueNormalizedChange={setMontoNorm}
                    disabled={guardando || !cajaSel}
                    aria-label="Monto a pagar"
                  />
                </label>
                {superaDisponible ? (
                  <p className="text-xs text-destructive">
                    Supera el disponible de la caja (${fmtPrecio(cajaSel.montoDisponible)}).
                  </p>
                ) : null}
              </div>
            )}
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
                      message="El proveedor no tiene comprobantes con saldo."
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
