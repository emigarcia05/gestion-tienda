"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearEstPorProdUnPresentacionAction,
  editarEstPorProdUnPresentacionAction,
  eliminarEstPorProdUnPresentacionAction,
  listarEstPorProdUnPresentacionesAction,
} from "@/actions/estPorProdUnPresentacion";
import { matchByMultiTerm } from "@/lib/busqueda";
import type {
  EstPorProdPosicionUnidad,
  EstPorProdUnPresentacionItem,
} from "@/lib/estPorProdUnPresentacion";
import { etiquetaPosicionUnidad } from "@/lib/estPorProdUnPresentacion";
import type { ActionResult } from "@/lib/types";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

const SELECT_TRIGGER_CLASS = "input-filtro-unificado w-full";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemsIniciales: EstPorProdUnPresentacionItem[];
  esEditor: boolean;
  /** Tras crear/editar/eliminar: p. ej. `router.refresh()`. */
  onCatalogoChanged?: () => void;
}

function etiquetaSuma(suma: boolean): string {
  return suma ? "SI" : "NO";
}

export default function GestionarEstPorProdUnPresentacionModal({
  open,
  onOpenChange,
  itemsIniciales,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<EstPorProdUnPresentacionItem[]>(itemsIniciales);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstPorProdUnPresentacionItem | null>(
    null
  );
  const [formUnidad, setFormUnidad] = useState("");
  const [formPosicion, setFormPosicion] = useState<EstPorProdPosicionUnidad>("SUFIJO");
  const [formSuma, setFormSuma] = useState<"true" | "false">("true");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<EstPorProdUnPresentacionItem | null>(
    null
  );
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res: ActionResult<EstPorProdUnPresentacionItem[]> =
        await listarEstPorProdUnPresentacionesAction();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar las unidades.");
        setItems([]);
        return;
      }
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setItems(itemsIniciales);
    setBusqueda("");
    setFormOpen(false);
    setEditingItem(null);
    setFormUnidad("");
    setFormPosicion("SUFIJO");
    setFormSuma("true");
    setBorrarTarget(null);
    void cargar();
  }, [open, cargar, itemsIniciales]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [item.unidad, item.posicionUnidad, etiquetaPosicionUnidad(item.posicionUnidad), etiquetaSuma(item.suma)],
        q
      )
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormUnidad("");
    setFormPosicion("SUFIJO");
    setFormSuma("true");
  }

  function abrirCrear() {
    if (!esEditor || pending) return;
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: EstPorProdUnPresentacionItem) {
    if (!esEditor || pending) return;
    setEditingItem(item);
    setFormUnidad(item.unidad);
    setFormPosicion(item.posicionUnidad);
    setFormSuma(item.suma ? "true" : "false");
    setFormOpen(true);
  }

  async function handleGuardarForm() {
    if (!esEditor || !formUnidad.trim() || pending) return;
    setPending(true);
    try {
      const payload = {
        unidad: formUnidad,
        posicionUnidad: formPosicion,
        suma: formSuma === "true",
      };
      if (editingItem) {
        const res = await editarEstPorProdUnPresentacionAction({
          id: editingItem.id,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Unidad actualizada.");
      } else {
        const res = await crearEstPorProdUnPresentacionAction(payload);
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear.");
          return;
        }
        toast.success("Unidad creada.");
      }
      setFormOpen(false);
      resetForm();
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
      const res = await eliminarEstPorProdUnPresentacionAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Unidad eliminada.");
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
          title="Gestion Unidades"
          size="lg"
          className="max-w-xl"
          scrollBody
          hideBodyScrollbars
          actions={
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
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
                  placeholder="BUSCAR UNIDAD..."
                  className="h-10 pl-9"
                  aria-label="Buscar unidad"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar unidad"
                  disabled={pending}
                  onClick={abrirCrear}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              ) : null}
            </div>

            <div className="min-h-[12rem]">
              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay unidades. Usá el botón + para agregar la primera.
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguna unidad coincide con la búsqueda.
                </p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium text-foreground">{item.unidad}</p>
                        <p className="text-xs text-muted-foreground">
                          {etiquetaPosicionUnidad(item.posicionUnidad)} · SUMA{" "}
                          {etiquetaSuma(item.suma)}
                        </p>
                      </div>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${item.unidad}`}
                            disabled={pending}
                            onClick={() => abrirEditar(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Eliminar ${item.unidad}`}
                            disabled={pending}
                            onClick={() => setBorrarTarget(item)}
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
          setFormOpen(next);
          if (!next) resetForm();
        }}
      >
        <AppModal
          title={editingItem ? "Editar Unidad" : "Nueva Unidad"}
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !formUnidad.trim()}
                onClick={() => void handleGuardarForm()}
              >
                Guardar
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Unidad</ModalMicroLabel>
              <Input
                value={formUnidad}
                onChange={(e) => setFormUnidad(e.target.value)}
                placeholder="Ej. LTS (se guarda en mayúsculas)"
                disabled={pending}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Posicion unidad</ModalMicroLabel>
              <Select
                value={formPosicion}
                onValueChange={(v) => setFormPosicion(v as EstPorProdPosicionUnidad)}
                disabled={pending}
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Posicion unidad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="PREFIJO">PREFIJO</SelectItem>
                  <SelectItem value="SUFIJO">SUFIJO</SelectItem>
                  <SelectItem value="SUFIJO_SIN_ESPACIO">SUFIJO SIN ESPACIO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ModalSiNoChoice
              label="SUMA"
              value={formSuma === "true"}
              onChange={(checked) => setFormSuma(checked ? "true" : "false")}
              disabled={pending}
            />
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={Boolean(borrarTarget)}
        onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}
      >
        <AppModal
          title="Eliminar Unidad"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={borrando}
                onClick={() => setBorrarTarget(null)}
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
            ¿Eliminar la unidad{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.unidad}</span>?
            Esta acción no se puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
