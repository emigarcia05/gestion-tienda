"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  crearFinAnaCosFinaTerminalAction,
  editarFinAnaCosFinaTerminalAction,
  eliminarFinAnaCosFinaTerminalAction,
  listarFinAnaCosFinaTerminalesAction,
} from "@/actions/finAnaCosFina";
import type { FinAnaCosFinaTerminalItem } from "@/lib/finAnaCosFinaTerminales";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalesIniciales: FinAnaCosFinaTerminalItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const BOTON_ACCION_TERMINAL_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-8 max-h-8 min-h-8 min-w-8 shrink-0 !p-0"
);

export default function GestionarTerminalesFinAnaCosFinaModal({
  open,
  onOpenChange,
  terminalesIniciales,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<FinAnaCosFinaTerminalItem[]>(terminalesIniciales);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoIdDux, setNuevoIdDux] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editDraftIdDux, setEditDraftIdDux] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<FinAnaCosFinaTerminalItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await listarFinAnaCosFinaTerminalesAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar las terminales.");
      setItems([]);
      return;
    }
    setItems(res.data);
  }, []);

  useEffect(() => {
    if (!open) return;
    setItems(terminalesIniciales);
    void cargar();
    setNuevoNombre("");
    setNuevoIdDux("");
    setEditingId(null);
    setEditDraft("");
    setEditDraftIdDux("");
    setBorrarTarget(null);
  }, [open, cargar, terminalesIniciales]);

  async function handleCrear() {
    if (!esEditor || !nuevoNombre.trim() || pending) return;
    setPending(true);
    try {
      const res = await crearFinAnaCosFinaTerminalAction({
        nombre: nuevoNombre,
        idDux: nuevoIdDux,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear la terminal.");
        return;
      }
      toast.success("Terminal creada.");
      setNuevoNombre("");
      setNuevoIdDux("");
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setPending(false);
    }
  }

  async function handleGuardarEdicion() {
    if (!esEditor || !editingId || !editDraft.trim() || pending) return;
    setPending(true);
    try {
      const res = await editarFinAnaCosFinaTerminalAction({
        id: editingId,
        nombre: editDraft,
        idDux: editDraftIdDux,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Terminal actualizada.");
      setEditingId(null);
      setEditDraft("");
      setEditDraftIdDux("");
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
      const res = await eliminarFinAnaCosFinaTerminalAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Terminal eliminada.");
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
          title="Gestionar Terminales"
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
            {esEditor ? (
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>NUEVA TERMINAL</ModalMicroLabel>
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
                        void handleCrear();
                      }
                    }}
                  />
                  <Input
                    value={nuevoIdDux}
                    onChange={(e) => setNuevoIdDux(e.target.value)}
                    placeholder="ID DUX"
                    inputMode="numeric"
                    disabled={pending}
                    className="w-32 shrink-0"
                    aria-label="ID DUX"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCrear();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={pending || !nuevoNombre.trim()}
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
              <ModalMicroLabel>TERMINALES EXISTENTES</ModalMicroLabel>
              <ul className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {items.map((terminal) => (
                  <li
                    key={terminal.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5"
                  >
                    {editingId === terminal.id && esEditor ? (
                      <>
                        <Input
                          value={editDraft}
                          onChange={(ev) => setEditDraft(ev.target.value)}
                          className="h-8 flex-1 text-xs"
                          disabled={pending}
                          aria-label={`Nombre ${terminal.nombre}`}
                        />
                        <Input
                          value={editDraftIdDux}
                          onChange={(ev) => setEditDraftIdDux(ev.target.value)}
                          className="h-8 w-28 shrink-0 text-xs tabular-nums"
                          placeholder="ID DUX"
                          inputMode="numeric"
                          disabled={pending}
                          aria-label={`ID DUX ${terminal.nombre}`}
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
                            setEditDraftIdDux("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{terminal.nombre}</span>
                        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {terminal.idDux ?? ""}
                        </span>
                        {esEditor ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_TERMINAL_CLASS}
                              aria-label={`Editar ${terminal.nombre}`}
                              disabled={pending}
                              onClick={() => {
                                setEditingId(terminal.id);
                                setEditDraft(terminal.nombre);
                                setEditDraftIdDux(terminal.idDux ?? "");
                              }}
                            >
                              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_TERMINAL_CLASS}
                              aria-label={`Eliminar ${terminal.nombre}`}
                              disabled={pending}
                              onClick={() => setBorrarTarget(terminal)}
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
                  <li className="py-6 text-center text-sm text-muted-foreground">No hay terminales.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="Eliminar Terminal"
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
            ¿Eliminar la terminal{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>? Se borrarán también
            sus filas de costos financieros. Esta acción no se puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
