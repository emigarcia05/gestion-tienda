"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { eliminarSucursalCatalogoAction } from "@/actions/sucursalesCatalogo";
import type { SucursalCatalogoItem } from "@/services/sucursalesCatalogo.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SucursalCatalogoItem | null;
  onDeleted?: () => void;
}

export default function EliminarSucursalModal({
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
      const res = await eliminarSucursalCatalogoAction({ id: item.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo borrar la sucursal.");
        return;
      }
      toast.success("Sucursal eliminada.");
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <AppModal
        title="ELIMINAR SUCURSAL"
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
            : "Seleccioná una sucursal para eliminar."}
        </p>
      </AppModal>
    </Dialog>
  );
}
