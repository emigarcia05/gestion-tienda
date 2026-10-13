"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listarPendientesAcreditacionCajaAction } from "@/actions/tesoreriaMovimientos";
import {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import AppModal from "@/components/shared/AppModal";
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
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResumenPendientesAcreditacionCaja } from "@/services/tesoreriaMovimientos.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: TesoreriaCajaFila | null;
}

const VACIO: ResumenPendientesAcreditacionCaja = {
  total: 0,
  totalTarjeta: 0,
  totalCheque: 0,
  totalOtros: 0,
  filas: [],
};

export default function ResumenAcreditacionCajaModal({ open, onOpenChange, caja }: Props) {
  const [datos, setDatos] = useState<ResumenPendientesAcreditacionCaja>(VACIO);
  const [cargando, setCargando] = useState(false);
  const [filtroFormaPago, setFiltroFormaPago] = useState("");
  const cajaId = caja?.id ?? null;

  const cargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const res = await listarPendientesAcreditacionCajaAction({ cajaId: id });
      if (!res.ok) {
        toast.error(res.error);
        setDatos(VACIO);
        return;
      }
      setDatos(res.data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !cajaId) return;
    setFiltroFormaPago("");
    void cargar(cajaId);
  }, [open, cajaId, cargar]);

  const formasPago = useMemo(
    () =>
      [...new Set(datos.filas.map((f) => f.formaPago).filter((nombre) => nombre.trim() !== ""))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [datos.filas]
  );

  const filasFiltradas = useMemo(
    () =>
      filtroFormaPago
        ? datos.filas.filter((f) => f.formaPago === filtroFormaPago)
        : datos.filas,
    [datos.filas, filtroFormaPago]
  );
  const totalFiltrado = filasFiltradas.reduce((acc, f) => acc + f.montoAcreditado, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDatos(VACIO);
          setFiltroFormaPago("");
        }
        onOpenChange(next);
      }}
    >
      {open && caja ? (
        <AppModal
          title="MONTO A ACREDITAR"
          size="lg"
          className="max-w-[min(72rem,calc(100%-2rem))]"
          actions={
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <FiltroIndividualContainer
              className={cn(FILTER_SELECT_WRAPPER_CLASS, "w-[20rem]")}
              activo={Boolean(filtroFormaPago)}
              onLimpiar={() => setFiltroFormaPago("")}
            >
              <Select
                value={filtroFormaPago}
                onValueChange={setFiltroFormaPago}
                disabled={formasPago.length === 0}
              >
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                  aria-label="Forma de pago"
                >
                  <SelectValue placeholder="FORMA DE PAGO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {formasPago.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FiltroIndividualContainer>
            <div className="contenedor-tabla-gestion max-h-[50vh]">
              <Table variant="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>FECHA ACREDITACIÓN</TableHead>
                    <TableHead>FORMA DE PAGO</TableHead>
                    <TableHead>DETALLE</TableHead>
                    <TableHead className="text-right">MONTO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filasFiltradas.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      message={cargando ? "Cargando..." : "No hay montos a acreditar."}
                    />
                  ) : (
                    filasFiltradas.map((fila) => (
                      <TableRow key={fila.id}>
                        <TableCell className="celda-datos">
                          {formatIsoYmdDdMmYyyyArgentina(fila.fechaAcreditacionIso)}
                        </TableCell>
                        <TableCell className="celda-datos">{fmtCelda(fila.formaPago)}</TableCell>
                        <TableCell className="celda-datos">{fmtCelda(fila.detalle)}</TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          ${fmtPrecio(fila.montoAcreditado)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {filasFiltradas.length > 0 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="celda-datos font-bold">
                        TOTAL
                      </TableCell>
                      <TableCell className="celda-datos text-right font-bold tabular-nums">
                        ${fmtPrecio(totalFiltrado)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>
          </div>
        </AppModal>
      ) : null}
    </Dialog>
  );
}
