"use client";

import { useCallback, useEffect, useState } from "react";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  crearFinTesoreriaEntidadAction,
  editarFinTesoreriaEntidadAction,
  eliminarFinTesoreriaEntidadAction,
  listarEntidadesFinTesoreriaAction,
} from "@/actions/cajasTesoreria";
import type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tras alta/edición/baja del catálogo (refrescar listas en el padre). */
  onCatalogoChanged?: () => void;
  /** Al crear una entidad nueva desde el flujo de caja: seleccionarla en el padre. */
  onEntidadCreadaSeleccion?: (id: string) => void;
}

export default function CrearEntidadTesoreriaModal({
  open,
  onOpenChange,
  onCatalogoChanged,
  onEntidadCreadaSeleccion,
}: Props) {
  const [items, setItems] = useState<FinTesoreriaEntidadItem[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<FinTesoreriaEntidadItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await listarEntidadesFinTesoreriaAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar las entidades.");
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

  async function handleAgregar() {
    if (!nuevoNombre.trim() || pending) return;
    setPending(true);
    try {
      const res = await crearFinTesoreriaEntidadAction({ nombre: nuevoNombre });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear la entidad.");
        return;
      }
      toast.success("Entidad creada.");
      setNuevoNombre("");
      await cargar();
      onCatalogoChanged?.();
      onEntidadCreadaSeleccion?.(res.data.id);
    } finally {
      setPending(false);
    }
  }

  async function handleGuardarEdicion() {
    if (!editingId || !editDraft.trim() || pending) return;
    setPending(true);
    try {
      const res = await editarFinTesoreriaEntidadAction({ id: editingId, nombre: editDraft });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Entidad actualizada.");
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
      const res = await eliminarFinTesoreriaEntidadAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Entidad eliminada.");
      setBorrarTarget(null);
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !pending && !borrando && onOpenChange(next)}>
        <AppModal
          title="GESTIONAR ENTIDADES"
          size="lg"
          className="max-w-xl"
          scrollBody
          hideBodyScrollbars
          actions={
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>NUEVA ENTIDAD</ModalMicroLabel>
              <div className="flex gap-2">
                <Input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Nombre (se guardará en mayúsculas)"
                  disabled={pending}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAgregar();
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={pending || !nuevoNombre.trim()}
                  onClick={() => void handleAgregar()}
                >
                  Agregar
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 border-t pt-3">
              <ModalMicroLabel>ENTIDADES EXISTENTES</ModalMicroLabel>
              <ul className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {items.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5"
                  >
                    {editingId === e.id ? (
                      <>
                        <Input
                          value={editDraft}
                          onChange={(ev) => setEditDraft(ev.target.value)}
                          className="h-8 flex-1 text-xs"
                          disabled={pending}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={pending}
                          onClick={() => void handleGuardarEdicion()}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0"
                          disabled={pending}
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
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nombre}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          aria-label={`Editar ${e.nombre}`}
                          disabled={pending}
                          onClick={() => {
                            setEditingId(e.id);
                            setEditDraft(e.nombre);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          aria-label={`Eliminar ${e.nombre}`}
                          disabled={pending}
                          onClick={() => setBorrarTarget(e)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="py-6 text-center text-sm text-muted-foreground">No hay entidades.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="Eliminar Entidad"
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
            ¿Eliminar la entidad{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>? Esta acción no se puede
            deshacer. No podrás eliminarla si hay cajas que la usan.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
