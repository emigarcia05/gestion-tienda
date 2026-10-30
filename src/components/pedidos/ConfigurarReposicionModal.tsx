"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import ReposicionConfigCampos, { useReposicionConfigForm } from "./ReposicionConfigForm";
import type { ItemReposicion, SucursalReposicion } from "@/actions/reposicion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemReposicion;
  sucursal?: SucursalReposicion;
  modo?: "sucursal" | "corp";
}

export default function ConfigurarReposicionModal({
  open,
  onOpenChange,
  item,
  sucursal,
  modo = "sucursal",
}: Props) {
  const router = useRouter();
  const form = useReposicionConfigForm({ open, item, sucursal, modo });
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const guardados = await form.guardar();
      if (guardados === null) return;
      toast.success(
        guardados > 1 ? `Configuración guardada para ${guardados} producto(s).` : "Configuración guardada."
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title={modo === "corp" ? "CONFIGURAR REPOSICIÓN CORP." : "Configurar Reposición"}
        className="max-w-[56rem] max-h-[100vh]"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={handleGuardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6 items-stretch text-center">
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-sm text-foreground font-medium">{item.descripcionTienda ?? "—"}</p>
            <div className="w-full h-px bg-[#0072BB]" />
          </div>
          <ReposicionConfigCampos
            form={form}
            item={item}
            sucursal={sucursal}
            aplicarPisoCorp={modo === "sucursal"}
            modo={modo}
          />
        </div>
      </AppModal>
    </Dialog>
  );
}
