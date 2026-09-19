"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  crearFinAnaCosFinaPagoAction,
  editarFinAnaCosFinaPagoAction,
  eliminarFinAnaCosFinaPagoAction,
  listarFinAnaCosFinaPagosAction,
  reordenarFinAnaCosFinaPagosAction,
} from "@/actions/finAnaCosFina";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagosIniciales: FinAnaCosFinaPagoItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const DRAG_PAGO_ID_KEY = "fin-ana-cos-fina-pago-id";

const BOTON_ACCION_PAGO_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-8 max-h-8 min-h-8 min-w-8 shrink-0 !p-0"
);

const BOTON_ARRASTRE_PAGO_CLASS = cn(
  "flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground",
  "hover:bg-muted/60 hover:text-foreground active:cursor-grabbing",
  "disabled:pointer-events-none disabled:opacity-40"
);

function reordenarPagosLista(
  items: FinAnaCosFinaPagoItem[],
  origenId: string,
  destinoId: string
): FinAnaCosFinaPagoItem[] {
  const from = items.findIndex((p) => p.id === origenId);
  const to = items.findIndex((p) => p.id === destinoId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function GestionarPagosFinAnaCosFinaModal({
  open,
  onOpenChange,
  pagosIniciales,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<FinAnaCosFinaPagoItem[]>(pagosIniciales);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [reordenando, setReordenando] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<FinAnaCosFinaPagoItem | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ignoreParentCloseRef = useRef(false);

  const bloqueado = pending || reordenando || borrando;
  const puedeArrastrar = esEditor && !editingId && !bloqueado;

  function markNestedDialogClosing() {
    ignoreParentCloseRef.current = true;
    queueMicrotask(() => {
      ignoreParentCloseRef.current = false;
    });
  }

  const cargar = useCallback(async () => {
    const res = await listarFinAnaCosFinaPagosAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar las formas de pago.");
      setItems([]);
      return;
    }
    setItems(res.data);
  }, []);

  useEffect(() => {
    if (!open) return;
    setItems(pagosIniciales);
    void cargar();
    setNuevoNombre("");
    setEditingId(null);
    setEditDraft("");
    setDraggingId(null);
    setBorrarTarget(null);
    // Solo al abrir: no resetear en refresh de props (evita cerrar edición / modal).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open
  }, [open]);

  async function handleCrear() {
    if (!esEditor || !nuevoNombre.trim() || bloqueado) return;
    setPending(true);
    try {
      const res = await crearFinAnaCosFinaPagoAction({ nombre: nuevoNombre });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear la forma de pago.");
        return;
      }
      toast.success("Forma de pago creada.");
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
      const res = await editarFinAnaCosFinaPagoAction({ id: editingId, nombre: editDraft });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Forma de pago actualizada.");
      setEditingId(null);
      setEditDraft("");
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setPending(false);
    }
  }

  async function handleReordenar(origenId: string, destinoId: string) {
    if (!puedeArrastrar || origenId === destinoId) return;

    const prev = items;
    const next = reordenarPagosLista(prev, origenId, destinoId);
    setItems(next);
    setDraggingId(null);
    setReordenando(true);

    try {
      const res = await reordenarFinAnaCosFinaPagosAction({
        ordenIds: next.map((p) => p.id),
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar el orden.");
        setItems(prev);
        return;
      }
      setItems(res.data);
      onCatalogoChanged?.();
    } finally {
      setReordenando(false);
    }
  }

  async function confirmarBorrar() {
    if (!borrarTarget || borrando) return;
    setBorrando(true);
    try {
      const res = await eliminarFinAnaCosFinaPagoAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Forma de pago eliminada.");
      markNestedDialogClosing();
      setBorrarTarget(null);
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && (bloqueado || ignoreParentCloseRef.current || Boolean(borrarTarget) || Boolean(editingId))) {
            return;
          }
          onOpenChange(next);
        }}
      >
        <AppModal
          title="Gestionar Formas Pago"
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
                <ModalMicroLabel>NUEVA FORMA DE PAGO</ModalMicroLabel>
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
              <ModalMicroLabel>FORMAS DE PAGO EXISTENTES</ModalMicroLabel>
              {esEditor ? (
                <p className="text-xs text-muted-foreground">
                  Arrastrá con el ícono de agarre para definir el orden de las columnas en Margen
                  Contribución.
                </p>
              ) : null}
              <ul className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {items.map((pago) => (
                  <li
                    key={pago.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 transition-colors",
                      draggingId === pago.id && "border-primary/50 bg-primary/5",
                      draggingId && draggingId !== pago.id && puedeArrastrar && "border-dashed"
                    )}
                    onDragOver={(e) => {
                      if (!puedeArrastrar) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const origenId = e.dataTransfer.getData(DRAG_PAGO_ID_KEY);
                      if (!origenId) return;
                      void handleReordenar(origenId, pago.id);
                    }}
                  >
                    {editingId === pago.id && esEditor ? (
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
                        {esEditor ? (
                          <button
                            type="button"
                            draggable={puedeArrastrar}
                            disabled={!puedeArrastrar}
                            className={BOTON_ARRASTRE_PAGO_CLASS}
                            aria-label={`Reordenar ${pago.nombre}`}
                            onDragStart={(e) => {
                              e.dataTransfer.setData(DRAG_PAGO_ID_KEY, pago.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingId(pago.id);
                            }}
                            onDragEnd={() => setDraggingId(null)}
                          >
                            <GripVertical className="size-4 shrink-0" aria-hidden />
                          </button>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{pago.nombre}</span>
                        {esEditor ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_PAGO_CLASS}
                              aria-label={`Editar ${pago.nombre}`}
                              disabled={bloqueado}
                              onClick={() => {
                                setEditingId(pago.id);
                                setEditDraft(pago.nombre);
                              }}
                            >
                              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_PAGO_CLASS}
                              aria-label={`Eliminar ${pago.nombre}`}
                              disabled={bloqueado}
                              onClick={() => setBorrarTarget(pago)}
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
                    No hay formas de pago.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={Boolean(borrarTarget)}
        onOpenChange={(o) => {
          if (!o && !borrando) {
            markNestedDialogClosing();
            setBorrarTarget(null);
          }
        }}
      >
        <AppModal
          title="Eliminar Forma de Pago"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={borrando}
                onClick={() => {
                  markNestedDialogClosing();
                  setBorrarTarget(null);
                }}
              >
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
            ¿Eliminar la forma de pago{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>? Se borrarán
            también sus filas de costos financieros y descuentos asociados. Esta acción no se puede
            deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
