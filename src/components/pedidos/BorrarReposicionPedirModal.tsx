"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";

export type OpcionBorrarReposicion = "no-pedir" | "borrar-configuracion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descripcion: string;
  /** El ítem también tiene cantidad URGENTE (se borra con cualquiera de las dos opciones). */
  tieneUrgente: boolean;
  onElegir: (opcion: OpcionBorrarReposicion) => Promise<boolean>;
}

export default function BorrarReposicionPedirModal({
  open,
  onOpenChange,
  descripcion,
  tieneUrgente,
  onElegir,
}: Props) {
  const [procesando, setProcesando] = useState<OpcionBorrarReposicion | null>(null);

  async function elegir(opcion: OpcionBorrarReposicion) {
    setProcesando(opcion);
    try {
      if (await onElegir(opcion)) onOpenChange(false);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="Borrar"
        size="md"
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={!!procesando}>
            Cancelar
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-medium text-foreground">{descripcion}</p>
          <p className="text-sm text-muted-foreground">
            El producto tiene reposición configurada.
            {tieneUrgente ? " La cantidad urgente se borra con cualquiera de las dos opciones." : ""}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button type="button" onClick={() => void elegir("no-pedir")} disabled={!!procesando}>
              {procesando === "no-pedir" ? "Guardando..." : "NO PEDIR EN ESTE PEDIDO"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void elegir("borrar-configuracion")}
              disabled={!!procesando}
            >
              {procesando === "borrar-configuracion" ? "Borrando..." : "BORRAR CONFIGURACIÓN DE REPOSICIÓN"}
            </Button>
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
