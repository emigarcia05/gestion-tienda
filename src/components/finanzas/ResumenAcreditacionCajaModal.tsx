"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listarPendientesAcreditacionCajaAction } from "@/actions/tesoreriaMovimientos";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import AppModal from "@/components/shared/AppModal";
import LineaLecturaModal from "@/components/shared/LineaLecturaModal";
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
    void cargar(cajaId);
  }, [open, cajaId, cargar]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDatos(VACIO);
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
            <div className="flex flex-col gap-1">
              <LineaLecturaModal
                etiqueta="DEPÓSITOS DE TARJETA"
                valor={`$${fmtPrecio(datos.totalTarjeta)}`}
                tabular
              />
              <LineaLecturaModal
                etiqueta="CHEQUES"
                valor={`$${fmtPrecio(datos.totalCheque)}`}
                tabular
              />
              {datos.totalOtros > 0 ? (
                <LineaLecturaModal
                  etiqueta="OTROS"
                  valor={`$${fmtPrecio(datos.totalOtros)}`}
                  tabular
                />
              ) : null}
              <LineaLecturaModal
                etiqueta="TOTAL"
                valor={`$${fmtPrecio(datos.total)}`}
                tabular
              />
            </div>
            <div className="contenedor-tabla-gestion max-h-[50vh]">
              <Table variant="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>FECHA ACREDITACIÓN</TableHead>
                    <TableHead>ORIGEN</TableHead>
                    <TableHead>DETALLE</TableHead>
                    <TableHead className="text-right">MONTO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.filas.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      message={cargando ? "Cargando..." : "No hay montos a acreditar."}
                    />
                  ) : (
                    datos.filas.map((fila) => (
                      <TableRow key={fila.id}>
                        <TableCell className="celda-datos">
                          {formatIsoYmdDdMmYyyyArgentina(fila.fechaAcreditacionIso)}
                        </TableCell>
                        <TableCell className="celda-datos">{fila.origenEtiqueta}</TableCell>
                        <TableCell className="celda-datos">{fmtCelda(fila.detalle)}</TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          ${fmtPrecio(fila.montoAcreditado)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {datos.filas.length > 0 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="celda-datos font-bold">
                        TOTAL
                      </TableCell>
                      <TableCell className="celda-datos text-right font-bold tabular-nums">
                        ${fmtPrecio(datos.total)}
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
