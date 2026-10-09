"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  depositarChequesAction,
  obtenerDatosChequesCajaAction,
} from "@/actions/tesoreriaCheques";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import BotonDepositarCheque from "@/components/finanzas/BotonDepositarCheque";
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
  chequePuedeAcreditarsePorFechaArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { CALLOUT_WARNING_CLASS, TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { DatosChequesCaja } from "@/services/tesoreriaCheques.service";

type Vista = "lista" | "depositar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: TesoreriaCajaFila | null;
  esEditor: boolean;
  onChanged?: () => void;
}

const DATOS_VACIOS: DatosChequesCaja = { cheques: [], cajasDeposito: [], proveedores: [] };
const COL_SPAN = 4;

export default function ChequesCajaTesoreriaModal({
  open,
  onOpenChange,
  caja,
  esEditor,
  onChanged,
}: Props) {
  const [datos, setDatos] = useState<DatosChequesCaja>(DATOS_VACIOS);
  const [cargando, setCargando] = useState(false);
  const [chequeDepositoId, setChequeDepositoId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("lista");
  const [cajaDestinoId, setCajaDestinoId] = useState("");
  const [saving, setSaving] = useState(false);

  const cajaId = caja?.id ?? null;

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
    setChequeDepositoId(null);
    setVista("lista");
    setCajaDestinoId("");
  }

  const chequeDeposito =
    chequeDepositoId == null
      ? null
      : (datos.cheques.find((c) => c.id === chequeDepositoId) ?? null);
  const totalCartera = datos.cheques.reduce((acc, c) => acc + c.monto, 0);
  const haySinAcreditar =
    chequeDeposito != null &&
    !chequePuedeAcreditarsePorFechaArgentina(chequeDeposito.fechaAcreditacionIso);

  function iniciarDepositoCheque(id: string) {
    setChequeDepositoId(id);
    setVista("depositar");
  }

  async function tras(okMensaje: string) {
    toast.success(okMensaje);
    setChequeDepositoId(null);
    setVista("lista");
    setCajaDestinoId("");
    if (cajaId) await cargar(cajaId);
    onChanged?.();
  }

  async function confirmarDeposito() {
    if (!cajaDestinoId || chequeDeposito == null) return;
    setSaving(true);
    try {
      const res = await depositarChequesAction({
        chequeIds: [chequeDeposito.id],
        cajaDestinoId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await tras("Cheque depositado.");
    } finally {
      setSaving(false);
    }
  }

  let titulo = "CHEQUES";
  let acciones: React.ReactNode;
  let cuerpo: React.ReactNode;

  if (vista === "depositar") {
    titulo = "DEPOSITAR CHEQUE";
    acciones = (
      <>
        <Button type="button" variant="outline" disabled={saving} onClick={() => setVista("lista")}>
          Volver
        </Button>
        <Button
          type="button"
          disabled={saving || !cajaDestinoId || haySinAcreditar || chequeDeposito == null}
          onClick={() => void confirmarDeposito()}
        >
          {saving ? "Depositando..." : "Confirmar Depósito"}
        </Button>
      </>
    );
    cuerpo = (
      <div className="flex flex-col gap-3">
        {chequeDeposito ? (
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>CHEQUE</ModalMicroLabel>
            <p className="text-sm tabular-nums text-foreground">
              {fmtCelda(chequeDeposito.clienteNombre)} — $
              {fmtPrecio(chequeDeposito.monto)} —{" "}
              {formatIsoYmdDdMmYyyyArgentina(chequeDeposito.fechaAcreditacionIso)}
            </p>
          </div>
        ) : null}
        {haySinAcreditar ? (
          <p className={CALLOUT_WARNING_CLASS}>
            La fecha de acreditación es posterior a hoy: no se puede depositar todavía.
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
  } else {
    acciones = (
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
    );
    cuerpo = (
      <div className="contenedor-tabla-gestion max-h-[60vh]">
        <Table variant="compact">
          <TableHeader>
            <TableRow>
              <TableHead>CLIENTE</TableHead>
              <TableHead>FECHA ACREDITACIÓN</TableHead>
              <TableHead className="text-right">MONTO</TableHead>
              <TableHead className="tabla-bloque-secundario-head-divider text-center">
                ACCIONES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.cheques.length === 0 ? (
              <EmptyTableRow
                colSpan={COL_SPAN}
                message={cargando ? "Cargando..." : "No hay cheques en cartera."}
              />
            ) : (
              datos.cheques.map((cheque) => (
                <TableRow key={cheque.id}>
                  <TableCell className="celda-datos" title={cheque.comprobanteEtiqueta || undefined}>
                    {fmtCelda(cheque.clienteNombre)}
                  </TableCell>
                  <TableCell className="celda-datos">
                    {formatIsoYmdDdMmYyyyArgentina(cheque.fechaAcreditacionIso)}
                  </TableCell>
                  <TableCell className="celda-datos text-right tabular-nums">
                    ${fmtPrecio(cheque.monto)}
                  </TableCell>
                  <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                    <div
                      className={cn(
                        TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                        "flex-nowrap justify-center"
                      )}
                    >
                      <BotonDepositarCheque
                        fechaAcreditacionIso={cheque.fechaAcreditacionIso}
                        disabled={!esEditor}
                        onClick={() => iniciarDepositoCheque(cheque.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {datos.cheques.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={COL_SPAN - 2} className="celda-datos font-bold">
                  TOTAL
                </TableCell>
                <TableCell className="celda-datos text-right font-bold tabular-nums">
                  ${fmtPrecio(totalCartera)}
                </TableCell>
                <TableCell className="celda-datos tabla-bloque-secundario-cell-divider" />
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
        <AppModal
          title={titulo}
          size="lg"
          className="max-w-[min(72rem,calc(100%-2rem))]"
          actions={acciones}
        >
          {cuerpo}
        </AppModal>
      ) : null}
    </Dialog>
  );
}
