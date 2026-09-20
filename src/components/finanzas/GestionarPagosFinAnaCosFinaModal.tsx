"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
  listarFinAnaCosFinaTerminalesMarcasAction,
  reordenarFinAnaCosFinaPagosAction,
} from "@/actions/finAnaCosFina";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagosIniciales: FinAnaCosFinaPagoItem[];
  entidadesIniciales: FinAnaCosFinaTerminalMarcaItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const DRAG_PAGO_ID_KEY = "fin-ana-cos-fina-pago-id";

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

const BOTON_ARRASTRE_PAGO_CLASS = cn(
  "flex size-9 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground",
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

function toggleEntidadId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export default function GestionarPagosFinAnaCosFinaModal({
  open,
  onOpenChange,
  pagosIniciales,
  entidadesIniciales,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<FinAnaCosFinaPagoItem[]>(pagosIniciales);
  const [entidades, setEntidades] =
    useState<FinAnaCosFinaTerminalMarcaItem[]>(entidadesIniciales);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinAnaCosFinaPagoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formEntidadIds, setFormEntidadIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [reordenando, setReordenando] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<FinAnaCosFinaPagoItem | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ignoreParentCloseRef = useRef(false);

  const bloqueado = pending || reordenando || borrando;
  const puedeArrastrar = esEditor && !formOpen && !bloqueado;

  function markNestedDialogClosing() {
    ignoreParentCloseRef.current = true;
    queueMicrotask(() => {
      ignoreParentCloseRef.current = false;
    });
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resPagos, resEntidades] = await Promise.all([
        listarFinAnaCosFinaPagosAction(),
        listarFinAnaCosFinaTerminalesMarcasAction(),
      ]);
      if (!resPagos.ok) {
        toast.error(resPagos.error ?? "No se pudieron cargar las formas de pago.");
        setItems([]);
      } else {
        setItems(resPagos.data);
      }
      if (!resEntidades.ok) {
        toast.error(resEntidades.error ?? "No se pudieron cargar las entidades.");
        setEntidades([]);
      } else {
        setEntidades(resEntidades.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setItems(pagosIniciales);
    setEntidades(entidadesIniciales);
    setBusqueda("");
    setFormOpen(false);
    setEditingItem(null);
    setFormNombre("");
    setFormEntidadIds([]);
    setDraggingId(null);
    setBorrarTarget(null);
    void cargar();
    // Solo al abrir: no resetear en refresh de props.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open
  }, [open]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm([item.nombre, ...item.entidadNombres], q)
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormNombre("");
    setFormEntidadIds([]);
  }

  function abrirCrear() {
    if (!esEditor || pending) return;
    if (entidades.length === 0) {
      toast.error("Creá al menos una entidad antes de agregar una forma de pago.");
      return;
    }
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: FinAnaCosFinaPagoItem) {
    if (!esEditor || pending) return;
    setEditingItem(item);
    setFormNombre(item.nombre);
    setFormEntidadIds([...item.entidadIds]);
    setFormOpen(true);
  }

  const formValido = formNombre.trim().length > 0 && formEntidadIds.length > 0;

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    try {
      if (editingItem) {
        const res = await editarFinAnaCosFinaPagoAction({
          id: editingItem.id,
          nombre: formNombre,
          entidadIds: formEntidadIds,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Forma de pago actualizada.");
      } else {
        const res = await crearFinAnaCosFinaPagoAction({
          nombre: formNombre,
          entidadIds: formEntidadIds,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear la forma de pago.");
          return;
        }
        toast.success("Forma de pago creada.");
      }
      markNestedDialogClosing();
      setFormOpen(false);
      resetForm();
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
          if (
            !next &&
            (bloqueado || formOpen || Boolean(borrarTarget) || ignoreParentCloseRef.current)
          ) {
            return;
          }
          onOpenChange(next);
        }}
      >
        <AppModal
          title="GESTIONAR FORMAS PAGO"
          size="lg"
          scrollBody
          hideBodyScrollbars
          actions={
            <Button type="button" variant="outline" disabled={bloqueado} onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="BUSCAR FORMA DE PAGO O ENTIDAD..."
                  className="h-10 pl-9"
                  aria-label="Buscar forma de pago"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar forma de pago"
                  disabled={bloqueado}
                  onClick={abrirCrear}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              ) : null}
            </div>

            {esEditor ? (
              <p className="text-sm text-muted-foreground">
                Arrastrá con el ícono de agarre para definir el orden. Las entidades de cada forma
                de pago se eligen al crear o editar.
              </p>
            ) : null}

            <div className="min-h-[12rem]">
              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay formas de pago. Usá el botón + para agregar la primera.
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguna forma de pago coincide con la búsqueda.
                </p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((pago) => (
                    <li
                      key={pago.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2",
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-left font-medium text-foreground">
                          {pago.nombre}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {pago.entidadNombres.length > 0
                            ? pago.entidadNombres.join(", ")
                            : "Sin entidades"}
                        </p>
                      </div>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${pago.nombre}`}
                            disabled={bloqueado}
                            onClick={() => abrirEditar(pago)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Eliminar ${pago.nombre}`}
                            disabled={bloqueado}
                            onClick={() => setBorrarTarget(pago)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(next) => {
          if (pending) return;
          if (!next) markNestedDialogClosing();
          setFormOpen(next);
          if (!next) resetForm();
        }}
      >
        <AppModal
          title={editingItem ? "EDITAR FORMA DE PAGO" : "NUEVA FORMA DE PAGO"}
          size="md"
          scrollBody
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  markNestedDialogClosing();
                  setFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !formValido}
                onClick={() => void handleGuardarForm()}
              >
                Guardar
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Nombre</ModalMicroLabel>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value.toLocaleUpperCase("es-AR"))}
                placeholder="NOMBRE (SE GUARDARÁ EN MAYÚSCULAS)"
                disabled={pending}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <ModalMicroLabel>Entidades (mínimo 1)</ModalMicroLabel>
              {entidades.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay entidades. Creá una desde Gestionar Entidades.
                </p>
              ) : (
                <ul className="max-h-[min(16rem,40vh)] space-y-1.5 overflow-y-auto pr-1">
                  {entidades.map((entidad) => {
                    const checked = formEntidadIds.includes(entidad.id);
                    return (
                      <li key={entidad.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
                            checked ? "border-primary bg-primary/5" : "bg-card"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-4 shrink-0 accent-primary"
                            checked={checked}
                            disabled={pending}
                            onChange={() =>
                              setFormEntidadIds((prev) => toggleEntidadId(prev, entidad.id))
                            }
                          />
                          <span className="min-w-0 truncate font-medium">{entidad.nombre}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
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
          title="ELIMINAR FORMA DE PAGO"
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
