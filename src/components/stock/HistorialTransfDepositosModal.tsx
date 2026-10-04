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
import { listarHistorialTransfDepositosProductoAction } from "@/actions/stock";
import type { HistorialTransfDepositosSeccionDto } from "@/actions/stock";
import { fmtCantidad } from "@/lib/format";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import { TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS } from "@/lib/transfDepositosControl";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codTienda: string;
  descripcion: string;
}

/**
 * Modal CONTROL: transferencias del producto en los últimos 14 días,
 * una sección por par origen → destino.
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !codTienda) return;
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      setSecciones([]);
    });
    listarHistorialTransfDepositosProductoAction({ codTienda }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSecciones(res.data);
    });
    return () => {
      cancelled = true;
    };
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
        <p className="text-xs font-medium text-foreground text-center">
          Últimos {TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS} días
        </p>

        {loading ? (
          <p className="text-sm text-foreground py-6 text-center">Cargando…</p>
        ) : null}

        {!loading && error ? (
          <p className="text-sm text-destructive py-6 text-center">{error}</p>
        ) : null}

        {!loading && !error && secciones.length === 0 ? (
          <p className="text-sm text-foreground py-6 text-center">
            Sin transferencias en los últimos{" "}
            {TRANSF_DEPOSITOS_VENTANA_HISTORIAL_DIAS} días.
          </p>
        ) : null}

        {!loading &&
          !error &&
          secciones.map((sec) => (
            <section key={sec.titulo} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground text-center">
                {sec.titulo}
              </h3>
              <Table variant="compact">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[60%]">FECHA</TableHead>
                    <TableHead className="w-[40%] text-center">
                      CANTIDAD
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sec.items.map((item) => (
                    <TableRow key={`${item.createdAtIso}-${item.cantidad}`}>
                      <TableCell className="celda-datos">
                        {formatDdMmHhMmArgentina(new Date(item.createdAtIso))}
                      </TableCell>
                      <TableCell className="celda-datos text-center tabular-nums">
                        {fmtCantidad(item.cantidad)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
      </AppModal>
    </Dialog>
  );
}
