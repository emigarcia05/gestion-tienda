"use client";

import { useEffect, useMemo, useState } from "react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategoriaAction,
  createSubcategoriaAction,
  updateCategoriaAction,
  updateSubcategoriaAction,
} from "@/actions/comparacionCategorias";

export type NivelComparacionCategoria = "categoria" | "subcategoria";
type Modo = "crear" | "editar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nivel: NivelComparacionCategoria;
  modo: Modo;
  id?: string;
  nombreInicial?: string;
  parentId?: string;
  parentNombre?: string;
  onSuccess?: () => void;
}

const LABELS: Record<
  NivelComparacionCategoria,
  { singular: string; placeholder: string; parentLabel: string }
> = {
  categoria: {
    singular: "Categoría",
    placeholder: "INGRESAR NOMBRE DE LA CATEGORÍA",
    parentLabel: "",
  },
  subcategoria: {
    singular: "Subcategoría",
    placeholder: "INGRESAR NOMBRE DE LA SUBCATEGORÍA",
    parentLabel: "CATEGORÍA",
  },
};

export default function CrearEditarComparacionCategoriaModal({
  open,
  onOpenChange,
  nivel,
  modo,
  id,
  nombreInicial = "",
  parentId,
  parentNombre,
  onSuccess,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(modo === "editar" ? nombreInicial : "");
  }, [open, modo, nombreInicial]);

  const labels = LABELS[nivel];

  const hasChanges = useMemo(() => {
    if (modo !== "editar") return true;
    return nombre.trim().toUpperCase() !== nombreInicial.trim().toUpperCase();
  }, [modo, nombre, nombreInicial]);

  const disabledSubmit = useMemo(() => {
    if (saving) return true;
    if (nombre.trim().length === 0) return true;
    if (modo === "editar" && !id) return true;
    if (modo === "editar" && !hasChanges) return true;
    if (modo === "crear" && nivel !== "categoria" && !parentId) return true;
    return false;
  }, [saving, nombre, modo, id, hasChanges, nivel, parentId]);

  async function handleSubmit() {
    if (disabledSubmit) return;
    setSaving(true);
    try {
      const res = await dispatch({
        nombre,
        nivel,
        modo,
        id,
        parentId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success(
        modo === "crear"
          ? `${labels.singular} creada correctamente.`
          : `${labels.singular} actualizada correctamente.`
      );
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }

  const titulo = `${modo === "crear" ? "Crear" : "Editar"} ${labels.singular}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving && !next) return;
        onOpenChange(next);
      }}
    >
      <AppModal
        title={titulo}
        size="md"
        className="max-w-lg"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={disabledSubmit} onClick={handleSubmit}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="grid min-h-0 grid-cols-1 gap-3">
          {nivel !== "categoria" && parentNombre ? (
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>{labels.parentLabel}</ModalMicroLabel>
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm font-medium">
                {parentNombre}
              </div>
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <ModalMicroLabel>NOMBRE</ModalMicroLabel>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder={labels.placeholder}
              maxLength={120}
              disabled={saving}
              autoFocus
            />
          </label>
        </div>
      </AppModal>
    </Dialog>
  );
}

async function dispatch(args: {
  nombre: string;
  nivel: NivelComparacionCategoria;
  modo: Modo;
  id?: string;
  parentId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { nombre, nivel, modo, id, parentId } = args;

  if (nivel === "categoria") {
    if (modo === "crear") {
      const r = await createCategoriaAction(nombre);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
    }
    const r = await updateCategoriaAction(id!, { nombre });
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
  }

  if (nivel === "subcategoria") {
    if (modo === "crear") {
      const r = await createSubcategoriaAction(parentId!, nombre);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
    }
    const r = await updateSubcategoriaAction(id!, { nombre, categoriaId: parentId });
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "" };
  }

  return { ok: false, error: "Nivel inválido." };
}
