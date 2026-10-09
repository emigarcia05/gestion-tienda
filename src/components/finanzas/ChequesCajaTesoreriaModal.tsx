"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  depositarChequesAction,
  obtenerDatosChequesCajaAction,
  pagarProveedorConChequesAction,
} from "@/actions/tesoreriaCheques";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { CALLOUT_WARNING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { DatosChequesCaja } from "@/services/tesoreriaCheques.service";

type Vista = "lista" | "depositar" | "pagar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: TesoreriaCajaFila | null;
  esEditor: boolean;
  onChanged?: () => void;
}

const DATOS_VACIOS: DatosChequesCaja = { cheques: [], cajasDeposito: [], proveedores: [] };

export default function ChequesCajaTesoreriaModal({
  open,
  onOpenChange,
  caja,
  esEditor,
  onChanged,
}: Props) {
  const [datos, setDatos] = useState<DatosChequesCaja>(DATOS_VACIOS);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [vista, setVista] = useState<Vista>("lista");
  const [cajaDestinoId, setCajaDestinoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [saving, setSaving] = useState(false);

  const cajaId = caja?.id ?? null;
  const hoyIso = dateToIsoYmdArgentina(new Date());

  const cargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const res = await obtenerDatosChequesCajaAction({ cajaId: id });
      if (!res.ok) {
        toast.error(res.error);
        setDatos(DATOS_VACIOS);
        return;
      }
      setDatos(res.data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !cajaId) return;
    void cargar(cajaId);
  }, [open, cajaId, cargar]);

  function reset() {
    setDatos(DATOS_VACIOS);
    setSeleccion(new Set());
    setVista("lista");
    setCajaDestinoId("");
    setProveedorId("");
  }

  const seleccionados = useMemo(
    () => datos.cheques.filter((c) => seleccion.has(c.id)),
    [datos.cheques, seleccion]
  );
  const totalCartera = datos.cheques.reduce((acc, c) => acc + c.monto, 0);
  const totalSeleccion = seleccionados.reduce((acc, c) => acc + c.monto, 0);
  const haySinAcreditar = seleccionados.some((c) => c.fechaAcreditacionIso > hoyIso);
  const proveedorElegido = datos.proveedores.find((p) => p.id === proveedorId) ?? null;
  const superaSaldoProveedor =
    proveedorElegido != null && totalSeleccion > proveedorElegido.saldoPendiente;

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function tras(okMensaje: string) {
    toast.success(okMensaje);
    setSeleccion(new Set());
    setVista("lista");
    setCajaDestinoId("");
    setProveedorId("");
    if (cajaId) await cargar(cajaId);
    onChanged?.();
  }

  async function confirmarDeposito() {
    if (!cajaDestinoId || seleccionados.length === 0) return;
    setSaving(true);
    try {
      const res = await depositarChequesAction({
        chequeIds: seleccionados.map((c) => c.id),
        cajaDestinoId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await tras(
        res.data.cantidad > 1
          ? `${res.data.cantidad} cheques depositados.`
          : "Cheque depositado."
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmarPago() {
    if (!proveedorId || seleccionados.length === 0) return;
    setSaving(true);
    try {
      const res = await pagarProveedorConChequesAction({
        chequeIds: seleccionados.map((c) => c.id),
        proveedorId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await tras("Pago a proveedor registrado.");
    } finally {
      setSaving(false);
    }
  }

  const resumenSeleccion = (
    <div className="flex flex-col gap-1">
      <ModalMicroLabel>CHEQUES SELECCIONADOS</ModalMicroLabel>
      <p className="text-sm tabular-nums text-foreground">
        {seleccionados.length} — ${fmtPrecio(totalSeleccion)}
      </p>
    </div>
  );

  let titulo = "CHEQUES";
  let acciones: React.ReactNode;
  let cuerpo: React.ReactNode;

  if (vista === "depositar") {
    titulo = "DEPOSITAR CHEQUES";
    acciones = (
      <>
        <Button type="button" variant="outline" disabled={saving} onClick={() => setVista("lista")}>
          Volver
        </Button>
        <Button
          type="button"
          disabled={saving || !cajaDestinoId || haySinAcreditar}
          onClick={() => void confirmarDeposito()}
        >
          {saving ? "Depositando..." : "Confirmar Depósito"}
        </Button>
      </>
    );
    cuerpo = (
      <div className="flex flex-col gap-3">
        {resumenSeleccion}
        {haySinAcreditar ? (
          <p className={CALLOUT_WARNING_CLASS}>
            Hay cheques con fecha de acreditación posterior a hoy: no se pueden depositar todavía.
          </p>
        ) : null}
        <label className="flex flex-col gap-1">
          <ModalMicroLabel>CAJA DESTINO</ModalMicroLabel>
          <Select value={cajaDestinoId} onValueChange={setCajaDestinoId} disabled={saving}>
            <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
              <SelectValue placeholder="SELECCIONAR CAJA" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              className="select-content-filtro"
            >
              {datos.cajasDeposito.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {datos.cajasDeposito.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cajas con DEPOSITA CHEQUE. Configuralo en Editar Caja.
          </p>
        ) : null}
      </div>
    );
  } else if (vista === "pagar") {
    titulo = "PAGAR A PROVEEDOR";
    acciones = (
      <>
        <Button type="button" variant="outline" disabled={saving} onClick={() => setVista("lista")}>
          Volver
        </Button>
        <Button
          type="button"
          disabled={saving || !proveedorId || superaSaldoProveedor}
          onClick={() => void confirmarPago()}
        >
          {saving ? "Registrando..." : "Confirmar Pago"}
        </Button>
      </>
    );
    cuerpo = (
      <div className="flex flex-col gap-3">
        {resumenSeleccion}
        <label className="flex flex-col gap-1">
          <ModalMicroLabel>PROVEEDOR</ModalMicroLabel>
          <Select value={proveedorId} onValueChange={setProveedorId} disabled={saving}>
            <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
              <SelectValue placeholder="SELECCIONAR PROVEEDOR" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              className="select-content-filtro"
            >
              {datos.proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {`${p.nombre} — SALDO $${fmtPrecio(p.saldoPendiente)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {superaSaldoProveedor ? (
          <p className={CALLOUT_WARNING_CLASS}>
            El total de cheques supera el saldo pendiente del proveedor.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Se imputa a los comprobantes pendientes del proveedor, del más antiguo al más nuevo.
        </p>
      </div>
    );
  } else {
    const colSpan = esEditor ? 4 : 3;
    acciones = (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            onOpenChange(false);
          }}
        >
          Cerrar
        </Button>
        {esEditor ? (
          <>
            <Button
              type="button"
              disabled={seleccionados.length === 0}
              onClick={() => setVista("depositar")}
            >
              Depositar
            </Button>
            <Button
              type="button"
              disabled={seleccionados.length === 0}
              onClick={() => setVista("pagar")}
            >
              Pagar A Proveedor
            </Button>
          </>
        ) : null}
      </>
    );
    cuerpo = (
      <div className="contenedor-tabla-gestion max-h-[60vh]">
        <Table variant="compact">
          <TableHeader>
            <TableRow>
              {esEditor ? (
                <TableHead className="w-12 text-center">
                  <Check className="mx-auto size-4" aria-hidden />
                  <span className="sr-only">SELECCIÓN</span>
                </TableHead>
              ) : null}
              <TableHead>CLIENTE</TableHead>
              <TableHead>FECHA ACREDITACIÓN</TableHead>
              <TableHead className="text-right">MONTO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.cheques.length === 0 ? (
              <EmptyTableRow
                colSpan={colSpan}
                message={cargando ? "Cargando..." : "No hay cheques en cartera."}
              />
            ) : (
              datos.cheques.map((cheque) => {
                const marcado = seleccion.has(cheque.id);
                return (
                  <TableRow key={cheque.id}>
                    {esEditor ? (
                      <TableCell className="celda-datos text-center">
                        <button
                          type="button"
                          className="tabla-check-toggle"
                          aria-pressed={marcado}
                          aria-label={marcado ? "Quitar de la selección" : "Seleccionar cheque"}
                          onClick={() => toggle(cheque.id)}
                        >
                          {marcado ? <Check aria-hidden /> : null}
                        </button>
                      </TableCell>
                    ) : null}
                    <TableCell className="celda-datos" title={cheque.comprobanteEtiqueta || undefined}>
                      {fmtCelda(cheque.clienteNombre)}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {formatIsoYmdDdMmYyyyArgentina(cheque.fechaAcreditacionIso)}
                    </TableCell>
                    <TableCell className="celda-datos text-right tabular-nums">
                      ${fmtPrecio(cheque.monto)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {datos.cheques.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={colSpan - 1} className="celda-datos font-bold">
                  {seleccionados.length > 0
                    ? `TOTAL (SELECCIONADOS $${fmtPrecio(totalSeleccion)})`
                    : "TOTAL"}
                </TableCell>
                <TableCell className="celda-datos text-right font-bold tabular-nums">
                  ${fmtPrecio(totalCartera)}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      {open && caja ? (
        <AppModal title={titulo} size="lg" actions={acciones}>
          {cuerpo}
        </AppModal>
      ) : null}
    </Dialog>
  );
}
