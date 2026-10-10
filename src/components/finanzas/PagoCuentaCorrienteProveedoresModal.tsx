"use client";

import { useEffect, useMemo, useState } from "react";
import { FileOutput, Landmark } from "lucide-react";
import { toast } from "sonner";
import {
  listarCajasPagoProveedorAction,
  listarComprobantesCompraPendientesPagoAction,
  registrarPagoCuentaCorrienteProveedoresAction,
} from "@/actions/controlComprobantes";
import {
  emitirEcheqPagoProveedorAction,
  listarCajasEmiteChequeAction,
} from "@/actions/tesoreriaChequesEmitidos";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
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
import { cn } from "@/lib/utils";
import type { CajaPagoProveedorOpcion } from "@/services/controlComprobantes.service";
import type { CajaEmiteChequeOpcion } from "@/services/tesoreriaChequesEmitidos.service";

const VACIO = "none";
/** Opción fija junto a las cajas: emite un eCheq diferido desde una caja `emite_cheque`. */
const ORIGEN_ECHEQ = "__echeq__";
const BOTON_ORIGEN_PAGO_CLASS =
  "h-auto min-h-16 w-[9rem] shrink-0 flex-col gap-1 whitespace-normal border border-primary px-2 py-1.5";
const BOTON_ORIGEN_PAGO_TEXTO_CLASS =
  "line-clamp-2 text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-wide";

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
  const [cajasPago, setCajasPago] = useState<CajaPagoProveedorOpcion[]>([]);
  const [cajasEcheq, setCajasEcheq] = useState<CajaEmiteChequeOpcion[]>([]);
  /** Id de la caja de pago o `ORIGEN_ECHEQ`. */
  const [origenId, setOrigenId] = useState("");
  const [montoNorm, setMontoNorm] = useState("");
  const [cajaEcheqId, setCajaEcheqId] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaPago, setFechaPago] = useState("");
  const [numeroEcheq, setNumeroEcheq] = useState("");

  const esEcheq = origenId === ORIGEN_ECHEQ;
  const cajaSel = cajasPago.find((c) => c.id === origenId) ?? null;
  const montoCents = montoArNormalizedStringToCents(montoNorm);
  const montoPesos = montoCents / 100;
  const superaDisponible = cajaSel != null && montoPesos > cajaSel.montoDisponible;
  const filas = useMemo(
    () => imputarPagoFifoVentas(comprobantes, montoPesos),
    [comprobantes, montoPesos]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const hoy = dateToIsoYmdArgentina(new Date());
    queueMicrotask(() => {
      setLoading(true);
      setOrigenId("");
      setMontoNorm("");
      setCajaEcheqId("");
      setFechaEmision(hoy);
      setFechaPago("");
      setNumeroEcheq("");
    });
    void Promise.all([
      listarComprobantesCompraPendientesPagoAction({ idProveedorDux }),
      listarCajasPagoProveedorAction(),
      listarCajasEmiteChequeAction(),
    ]).then(([compRes, cajasPagoRes, cajasEcheqRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!compRes.ok) {
        toast.error(compRes.error);
        setComprobantes([]);
      } else {
        setComprobantes(compRes.data.comprobantes);
      }
      if (!cajasPagoRes.ok) {
        toast.error(cajasPagoRes.error);
        setCajasPago([]);
      } else {
        setCajasPago(cajasPagoRes.data);
      }
      if (!cajasEcheqRes.ok) {
        toast.error(cajasEcheqRes.error);
        setCajasEcheq([]);
      } else {
        setCajasEcheq(cajasEcheqRes.data);
        if (cajasEcheqRes.data.length === 1) setCajaEcheqId(cajasEcheqRes.data[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, idProveedorDux]);

  function finalizarOk(mensaje: string) {
    toast.success(mensaje);
    onOpenChange(false);
    onRegistrado();
  }

  async function confirmarEcheq() {
    if (!cajaEcheqId) {
      toast.error("Seleccioná la caja que emite el eCheq.");
      return;
    }
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
      cajaId: cajaEcheqId,
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
  }

  async function confirmar() {
    if (montoCents <= 0) {
      toast.error("Ingresá un monto a pagar.");
      return;
    }
    if (esEcheq) {
      await confirmarEcheq();
      return;
    }
    if (!cajaSel) {
      toast.error("Seleccioná la caja de la que sale el pago.");
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
              disabled={guardando || loading || montoCents <= 0 || !origenId || superaDisponible}
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
              aria-label="Caja de origen del pago"
              className="flex flex-wrap justify-center gap-2"
            >
              {cajasPago.map((caja) => {
                const seleccionado = caja.id === origenId;
                return (
                  <Button
                    key={caja.id}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    variant={seleccionado ? "default" : "outline"}
                    disabled={guardando}
                    className={BOTON_ORIGEN_PAGO_CLASS}
                    title={caja.etiqueta}
                    onClick={() => setOrigenId(caja.id)}
                  >
                    <Landmark className="size-5 shrink-0" aria-hidden />
                    <span className={BOTON_ORIGEN_PAGO_TEXTO_CLASS}>{caja.etiqueta}</span>
                    <span className="text-[0.65rem] tabular-nums">
                      ${fmtPrecio(caja.montoDisponible)}
                    </span>
                  </Button>
                );
              })}
              <Button
                type="button"
                role="radio"
                aria-checked={esEcheq}
                variant={esEcheq ? "default" : "outline"}
                disabled={guardando || cajasEcheq.length === 0}
                title={
                  cajasEcheq.length === 0
                    ? "No hay cajas con EMITE CHEQUE (TESORERIA → Cajas)."
                    : undefined
                }
                className={BOTON_ORIGEN_PAGO_CLASS}
                onClick={() => setOrigenId(ORIGEN_ECHEQ)}
              >
                <FileOutput className="size-5 shrink-0" aria-hidden />
                <span className={BOTON_ORIGEN_PAGO_TEXTO_CLASS}>eCheq</span>
              </Button>
            </div>
            {cajasPago.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No hay cajas de tesorería con saldo disponible.
              </p>
            ) : null}
            {esEcheq ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="col-span-2 flex min-w-0 flex-col gap-1">
                  <ModalMicroLabel>CAJA</ModalMicroLabel>
                  <Select
                    value={cajaEcheqId || VACIO}
                    onValueChange={(value) => setCajaEcheqId(value === VACIO ? "" : value)}
                    disabled={guardando}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                      <SelectValue placeholder="CAJA" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro"
                    >
                      <SelectItem value={VACIO}>CAJA</SelectItem>
                      {cajasEcheq.map((caja) => (
                        <SelectItem key={caja.id} value={caja.id}>
                          {caja.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
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
            ) : (
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
