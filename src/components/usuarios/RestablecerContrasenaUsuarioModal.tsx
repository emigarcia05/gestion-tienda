"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { restablecerContrasenaUsuarioAction } from "@/actions/globalPersonal";
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GlobalPersonalItem | null;
  onSuccess?: () => void;
}

export default function RestablecerContrasenaUsuarioModal({
  open,
  onOpenChange,
  item,
  onSuccess,
}: Props) {
  const [pending, setPending] = useState(false);

  async function handleRestablecer() {
    if (!item) return;
    setPending(true);
    try {
      const res = await restablecerContrasenaUsuarioAction({
        idPersonal: item.idPersonal,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo restablecer la contraseña.");
        return;
      }
      toast.success("Contraseña restablecida. La creará en su próximo ingreso.");
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <AppModal
        title="Restablecer Contraseña"
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
              disabled={pending || !item}
              onClick={handleRestablecer}
            >
              Sí, Restablecer
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {item
            ? `Se borra la contraseña de ${item.nombrePersonal}. En su próximo ingreso tendrá que crear una nueva.`
            : "Seleccioná un usuario."}
        </p>
      </AppModal>
    </Dialog>
  );
}
