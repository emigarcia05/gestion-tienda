"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listarCobrosComprobanteFacturaAction } from "@/actions/factura";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { FacturaComprobanteCobroItem } from "@/lib/factura";
import { montoArCentsToDisplayWithCurrency } from "@/lib/montoArMask";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprobanteId: string | null;
  nroComprobante: string;
};

export default function FacturaComprobanteCobrosModal({
  open,
  onOpenChange,
  comprobanteId,
  nroComprobante,
}: Props) {
  const [items, setItems] = useState<FacturaComprobanteCobroItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !comprobanteId) return;
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    void listarCobrosComprobanteFacturaAction({ id: comprobanteId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        setItems([]);
        return;
      }
      setItems(res.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [open, comprobanteId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        size="md"
        padding="sm"
        title={`COBROS ${nroComprobante}`.trim()}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cobros registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((cobro) => (
              <li
                key={cobro.id}
                className="rounded-md border border-border bg-muted/20 px-2 py-1.5 text-sm font-medium"
              >
                {cobro.pagoNombre}
                {cobro.entidadNombre ? ` · ${cobro.entidadNombre}` : ""}
                {cobro.cuotaEtiqueta ? ` · ${cobro.cuotaEtiqueta}` : ""}
                {cobro.esCuentaCorriente && cobro.plazoDias != null
                  ? ` · ${cobro.plazoDias} DÍAS`
                  : ""}
                {` · ${montoArCentsToDisplayWithCurrency(cobro.montoCents, "$")}`}
              </li>
            ))}
          </ul>
        )}
      </AppModal>
    </Dialog>
  );
}
