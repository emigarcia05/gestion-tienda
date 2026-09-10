"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { eliminarUsuarioPersonalAction } from "@/actions/globalPersonal";
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GlobalPersonalItem | null;
  onDeleted?: () => void;
}

export default function EliminarUsuarioModal({
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
      const res = await eliminarUsuarioPersonalAction({
        idPersonal: item.idPersonal,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar el usuario.");
        return;
      }
      toast.success("Usuario eliminado correctamente.");
      onOpenChange(false);
      onDeleted?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <AppModal
        title="Eliminar Usuario"
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
              onClick={handleDelete}
            >
              Sí, Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {item
            ? `¿Estás seguro de eliminar a ${item.nombrePersonal}? Esta acción no se puede deshacer.`
            : "Seleccioná un usuario para eliminar."}
        </p>
      </AppModal>
    </Dialog>
  );
}
