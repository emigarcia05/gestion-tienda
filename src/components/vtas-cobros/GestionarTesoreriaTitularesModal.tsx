"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  crearTesoreriaTitularAction,
  editarTesoreriaTitularAction,
  eliminarTesoreriaTitularAction,
  listarTesoreriaTitularesAction,
} from "@/actions/tesoreriaTitulares";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TesoreriaTitularItem } from "@/lib/cajasTesoreriaTitulares";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const BOTON_ACCION_TITULAR_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-8 max-h-8 min-h-8 min-w-8 shrink-0 !p-0"
);

export default function GestionarTesoreriaTitularesModal({
  open,
  onOpenChange,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<TesoreriaTitularItem[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<TesoreriaTitularItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const bloqueado = pending || borrando;

  const cargar = useCallback(async () => {
    const res = await listarTesoreriaTitularesAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar los titulares.");
      setItems([]);
      return;
    }
    setItems(res.data);
  }, []);

  useEffect(() => {
    if (!open) return;
    void cargar();
    setNuevoNombre("");
    setEditingId(null);
    setEditDraft("");
    setBorrarTarget(null);
  }, [open, cargar]);

  async function handleCrear() {
    if (!esEditor || !nuevoNombre.trim() || bloqueado) return;
    setPending(true);
    try {
      const res = await crearTesoreriaTitularAction({ nombre: nuevoNombre });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear el titular.");
        return;
      }
      toast.success("Titular creado.");
      setNuevoNombre("");
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setPending(false);
    }
  }

  async function handleGuardarEdicion() {
    if (!esEditor || !editingId || !editDraft.trim() || bloqueado) return;
    setPending(true);
    try {
      const res = await editarTesoreriaTitularAction({
        id: editingId,
        nombre: editDraft,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Titular actualizado.");
      setEditingId(null);
      setEditDraft("");
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setPending(false);
    }
  }

  async function confirmarBorrar() {
    if (!borrarTarget || borrando) return;
    setBorrando(true);
    try {
      const res = await eliminarTesoreriaTitularAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Titular eliminado.");
      setBorrarTarget(null);
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !bloqueado && onOpenChange(next)}>
        <AppModal
          title="GESTIONAR TITULARES"
          size="lg"
          className="max-w-xl"
          scrollBody
          hideBodyScrollbars
          actions={
            <Button type="button" variant="outline" disabled={bloqueado} onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="flex min-h-0 flex-col gap-4">
            {esEditor ? (
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>NUEVO TITULAR</ModalMicroLabel>
                <div className="flex gap-2">
                  <Input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Nombre (se guardará en mayúsculas)"
                    disabled={bloqueado}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCrear();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={bloqueado || !nuevoNombre.trim()}
                    onClick={() => void handleCrear()}
                    className="gap-2"
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    Crear
                  </Button>
                </div>
              </div>
            ) : null}

            <div className={cn("flex min-h-0 flex-1 flex-col gap-1", esEditor && "border-t pt-3")}>
              <ModalMicroLabel>TITULARES EXISTENTES</ModalMicroLabel>
              <ul className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {items.map((titular) => (
                  <li
                    key={titular.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5"
                  >
                    {editingId === titular.id && esEditor ? (
                      <>
                        <Input
                          value={editDraft}
                          onChange={(ev) => setEditDraft(ev.target.value)}
                          className="h-8 flex-1 text-xs"
                          disabled={bloqueado}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={bloqueado}
                          onClick={() => void handleGuardarEdicion()}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0"
                          disabled={bloqueado}
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {titular.nombre}
                        </span>
                        {esEditor ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_TITULAR_CLASS}
                              aria-label={`Editar ${titular.nombre}`}
                              disabled={bloqueado}
                              onClick={() => {
                                setEditingId(titular.id);
                                setEditDraft(titular.nombre);
                              }}
                            >
                              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_TITULAR_CLASS}
                              aria-label={`Eliminar ${titular.nombre}`}
                              disabled={bloqueado}
                              onClick={() => setBorrarTarget(titular)}
                            >
                              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    No hay titulares.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="ELIMINAR TITULAR"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={borrando} onClick={() => setBorrarTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={borrando}
                onClick={() => void confirmarBorrar()}
              >
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el titular{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>? Esta
            acción no se puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
