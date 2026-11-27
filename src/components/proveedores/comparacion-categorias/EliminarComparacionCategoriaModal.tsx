"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import {
  deleteCategoriaAction,
  deleteSubcategoriaAction,
} from "@/actions/comparacionCategorias";
import type { NivelComparacionCategoria } from "./CrearEditarComparacionCategoriaModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nivel: NivelComparacionCategoria;
  id: string | null;
  nombre: string | null;
  onSuccess?: () => void;
}

const LABELS: Record<NivelComparacionCategoria, { singular: string; articuloDefinido: string }> = {
  categoria: { singular: "Categoría", articuloDefinido: "la categoría" },
  subcategoria: { singular: "Subcategoría", articuloDefinido: "la subcategoría" },
};

export default function EliminarComparacionCategoriaModal({
  open,
  onOpenChange,
  nivel,
  id,
  nombre,
  onSuccess,
}: Props) {
  const [pending, setPending] = useState(false);
  const labels = LABELS[nivel];

  async function handleDelete() {
    if (!id) return;
    setPending(true);
    try {
      const res = await dispatch(nivel, id);
      if (!res.ok) {
        toast.error(res.error ?? `No se pudo eliminar ${labels.articuloDefinido}.`);
        return;
      }
      toast.success(`${labels.singular} eliminada correctamente.`);
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={`Eliminar ${labels.singular}`}
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
            <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
              Sí, Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Confirmás eliminar <span className="font-medium text-foreground">{nombre}</span>? Esta acción
          no se puede deshacer.
        </p>
      </AppModal>
    </Dialog>
  );
}

async function dispatch(
  nivel: NivelComparacionCategoria,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (nivel === "categoria") {
    const r = await deleteCategoriaAction(id);
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
  }
  if (nivel === "subcategoria") {
    const r = await deleteSubcategoriaAction(id);
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
  }
  return { ok: false, error: "Nivel inválido." };
}
