"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { eliminarDescPromoAction } from "@/actions/descPromo";
import type { DescPromoFila } from "@/lib/descPromo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DescPromoFila | null;
  onDeleted?: () => void;
}

export default function EliminarDescPromoModal({
  open,
  onOpenChange,
  item,
  onDeleted,
}: Props) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!item) return;
    setPending(true);
    try {
      const res = await eliminarDescPromoAction({ id: item.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar el descuento.");
        return;
      }
      toast.success("Descuento eliminado.");
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}
    >
      <AppModal
        title="Eliminar Descuento"
        size="sm"
        className="max-w-md"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !item}
              onClick={() => void handleDelete()}
            >
              Sí, Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {item
            ? `¿Estás seguro de eliminar ${item.nombre}? Esta acción no se puede deshacer.`
            : "Seleccioná un descuento para eliminar."}
        </p>
      </AppModal>
    </Dialog>
  );
}
