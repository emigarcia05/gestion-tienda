"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtCantidad } from "@/lib/format";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import { TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS } from "@/lib/transfDepositosControl";
import type { HistorialTransfDepositosSeccionDto } from "@/lib/transfDepositosTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codTienda: string;
  descripcion: string;
}

/**
 * Modal CONTROL: historial de transferencias (vacío hasta el nuevo backend).
 */
export default function HistorialTransfDepositosModal({
  open,
  onOpenChange,
  codTienda,
  descripcion,
}: Props) {
  const [secciones, setSecciones] = useState<HistorialTransfDepositosSeccionDto[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !codTienda) return;
    queueMicrotask(() => {
      setLoading(true);
      setSecciones([]);
      setLoading(false);
    });
  }, [open, codTienda]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        title="Transferencias"
        bodyClassName="space-y-4"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <p
          className="text-sm font-medium text-foreground text-center line-clamp-2"
          title={descripcion}
        >
          {descripcion}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Últimos {TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS} días
        </p>
        {loading ? (
          <p className="text-sm text-foreground py-6 text-center">Cargando…</p>
        ) : secciones.length === 0 ? (
          <p className="text-sm text-foreground py-6 text-center">
            Sin transferencias en el período.
          </p>
        ) : (
          secciones.map((sec) => (
            <div key={`${sec.origenCodigo}-${sec.destinoCodigo}`} className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{sec.titulo}</p>
              <div className="contenedor-tabla-gestion">
                <Table variant="compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead>FECHA</TableHead>
                      <TableHead className="text-right">CANT.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sec.items.map((item, idx) => (
                      <TableRow key={`${item.createdAtIso}-${idx}`}>
                        <TableCell className="celda-datos tabular-nums">
                          {formatDdMmHhMmArgentina(new Date(item.createdAtIso))}
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          {fmtCantidad(item.cantidad)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
        )}
      </AppModal>
    </Dialog>
  );
}
