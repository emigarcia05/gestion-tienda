"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { eliminarCajaTesoreriaAction } from "@/actions/cajasTesoreria";
import type { TesoreriaCajaFila } from "@/components/finanzas/TablaTesoreriaCajas";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";
import type { TipoCajaTesoreria } from "@prisma/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: TesoreriaCajaFila | null;
  onDeleted?: () => void;
}

export default function EliminarCajaTesoreriaModal({
  open,
  onOpenChange,
  caja,
  onDeleted,
}: Props) {
  const [pending, setPending] = useState(false);
  const esCheque = caja?.tipoCaja === "CHEQUE";

  async function handleDelete() {
    if (!caja) return;
    setPending(true);
    try {
      const res = await eliminarCajaTesoreriaAction({ id: caja.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar la caja.");
        return;
      }
      toast.success("Caja eliminada correctamente.");
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <AppModal
        title="ELIMINAR CAJA"
        size="sm"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={pending || !caja} onClick={() => void handleDelete()}>
              Eliminar
            </Button>
          </div>
        }
      >
        {caja ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              ¿Eliminar la caja{" "}
              <span className="font-semibold text-foreground">{caja.entidadNombre}</span>
              {caja.titular ? (
                <>
                  {" "}
                  (<span className="font-semibold text-foreground">{caja.titular}</span>)
                </>
              ) : null}
              {caja.tipoCaja ? (
                <>
                  {" "}
                  · {etiquetaTipoCajaEnPantalla(caja.tipoCaja as TipoCajaTesoreria)}
                </>
              ) : null}
              ? Esta acción no se puede deshacer.
            </p>
            {esCheque ? (
              <p className="text-sm text-muted-foreground">
                Si la caja tiene cheques asociados, primero hay que transferirlos o eliminarlos.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Seleccioná una caja para eliminar.</p>
        )}
      </AppModal>
    </Dialog>
  );
}
