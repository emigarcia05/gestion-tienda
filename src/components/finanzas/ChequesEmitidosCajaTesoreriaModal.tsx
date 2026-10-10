"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import {
  anularChequeEmitidoAction,
  listarChequesEmitidosCajaAction,
} from "@/actions/tesoreriaChequesEmitidos";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import {
  CALLOUT_WARNING_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type {
  ChequeEmitidoFila,
  ChequesEmitidosCaja,
} from "@/services/tesoreriaChequesEmitidos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: TesoreriaCajaFila | null;
  esEditor: boolean;
  onChanged?: () => void;
}

const DATOS_VACIOS: ChequesEmitidosCaja = { cheques: [], totalADebitar: 0 };
const COL_SPAN = 7;

export default function ChequesEmitidosCajaTesoreriaModal({
  open,
  onOpenChange,
  caja,
  esEditor,
  onChanged,
}: Props) {
  const [datos, setDatos] = useState<ChequesEmitidosCaja>(DATOS_VACIOS);
  const [cargando, setCargando] = useState(false);
  const [chequeAnular, setChequeAnular] = useState<ChequeEmitidoFila | null>(null);
  const [saving, setSaving] = useState(false);

  const cajaId = caja?.id ?? null;

  const cargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const res = await listarChequesEmitidosCajaAction({ cajaId: id });
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
    setChequeAnular(null);
  }

  async function confirmarAnulacion() {
    if (!chequeAnular) return;
    setSaving(true);
    try {
      const res = await anularChequeEmitidoAction({ id: chequeAnular.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("eCheq anulado: la deuda volvió a la cuenta corriente del proveedor.");
      setChequeAnular(null);
      if (cajaId) await cargar(cajaId);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  let titulo = "ECHEQS EMITIDOS";
  let acciones: React.ReactNode;
  let cuerpo: React.ReactNode;

  if (chequeAnular) {
    titulo = "ANULAR ECHEQ";
    acciones = (
      <>
        <Button type="button" variant="outline" disabled={saving} onClick={() => setChequeAnular(null)}>
          Volver
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={saving}
          onClick={() => void confirmarAnulacion()}
        >
          {saving ? "Anulando..." : "Confirmar Anulación"}
        </Button>
      </>
    );
    cuerpo = (
      <div className="flex flex-col gap-3">
        <p className="text-sm tabular-nums text-foreground">
          {chequeAnular.numero ? `N° ${chequeAnular.numero} — ` : ""}
          {chequeAnular.proveedorNombre} — ${fmtPrecio(chequeAnular.monto)} — pago{" "}
          {formatIsoYmdDdMmYyyyArgentina(chequeAnular.fechaPagoIso)}
        </p>
        <p className={CALLOUT_WARNING_CLASS}>
          Se elimina el egreso diferido de la caja y el monto vuelve a quedar pendiente en los
          comprobantes del proveedor.
        </p>
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
              <TableHead>N°</TableHead>
              <TableHead>PROVEEDOR</TableHead>
              <TableHead>EMISIÓN</TableHead>
              <TableHead>PAGO</TableHead>
              <TableHead className="text-right">MONTO</TableHead>
              <TableHead className="text-center">ESTADO</TableHead>
              <TableHead className="tabla-bloque-secundario-head-divider text-center">
                ACCIONES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.cheques.length === 0 ? (
              <EmptyTableRow
                colSpan={COL_SPAN}
                message={cargando ? "Cargando..." : "La caja no emitió eCheqs."}
              />
            ) : (
              datos.cheques.map((cheque) => (
                <TableRow
                  key={cheque.id}
                  className={cn(cheque.estado === "ANULADO" && "text-muted-foreground line-through")}
                >
                  <TableCell className="celda-datos tabular-nums">{fmtCelda(cheque.numero)}</TableCell>
                  <TableCell className="celda-datos">{cheque.proveedorNombre}</TableCell>
                  <TableCell className="celda-datos tabular-nums">
                    {formatIsoYmdDdMmYyyyArgentina(cheque.fechaEmisionIso)}
                  </TableCell>
                  <TableCell className="celda-datos tabular-nums">
                    {formatIsoYmdDdMmYyyyArgentina(cheque.fechaPagoIso)}
                  </TableCell>
                  <TableCell className="celda-datos text-right tabular-nums">
                    ${fmtPrecio(cheque.monto)}
                  </TableCell>
                  <TableCell className="celda-datos text-center">
                    {cheque.estado === "ANULADO"
                      ? "ANULADO"
                      : cheque.puedeAnular
                        ? "A DEBITAR"
                        : "DEBITADO"}
                  </TableCell>
                  <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                    <div
                      className={cn(
                        TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                        "flex-nowrap justify-center"
                      )}
                    >
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        disabled={!esEditor || !cheque.puedeAnular}
                        onClick={() => setChequeAnular(cheque)}
                        aria-label="Anular eCheq"
                        title={
                          cheque.puedeAnular
                            ? "Anular eCheq"
                            : "Solo se anulan eCheqs emitidos con fecha de pago posterior a hoy"
                        }
                      >
                        <Ban className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {datos.cheques.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="celda-datos font-bold">
                  TOTAL A DEBITAR
                </TableCell>
                <TableCell className="celda-datos text-right font-bold tabular-nums">
                  ${fmtPrecio(datos.totalADebitar)}
                </TableCell>
                <TableCell className="celda-datos" />
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
