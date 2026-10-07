"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import {
  crearRubroAction,
  editarRubroAction,
  eliminarRubroAction,
  listarRubrosCatalogoAction,
} from "@/actions/listaProductos";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { RubroCatalogoItem } from "@/lib/listaProductos";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-9 w-9 min-h-9 max-h-9");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

export default function GestionarRubrosModal({ open, onOpenChange, esEditor, onCatalogoChanged }: Props) {
  const [items, setItems] = useState<RubroCatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RubroCatalogoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<RubroCatalogoItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarRubrosCatalogoAction();
      if (!res.ok) {
        toast.error(res.error);
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
    setBusqueda("");
    setFormOpen(false);
    setBorrarTarget(null);
    void cargar();
  }, [open, cargar]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((r) => matchByMultiTerm([r.nombre], q));
  }, [items, busqueda]);

  function abrirForm(item: RubroCatalogoItem | null) {
    if (!esEditor || pending) return;
    setEditing(item);
    setFormNombre(item?.nombre ?? "");
    setFormOpen(true);
  }

  async function guardar() {
    if (!esEditor || !formNombre.trim() || pending) return;
    setPending(true);
    try {
      const res = editing
        ? await editarRubroAction({ id: editing.id, nombre: formNombre })
        : await crearRubroAction({ nombre: formNombre });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Rubro actualizado." : "Rubro creado.");
      setFormOpen(false);
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
      const res = await eliminarRubroAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Rubro eliminado.");
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
        onOpenChange={(next) => !pending && !borrando && !formOpen && !borrarTarget && onOpenChange(next)}
      >
        <AppModal
          title="GESTIONAR RUBROS"
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="BUSCAR RUBRO..."
                  className="h-10 pl-9"
                  aria-label="Buscar rubro"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar rubro"
                  disabled={pending}
                  onClick={() => abrirForm(null)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              ) : null}
            </div>

            <div className="min-h-[12rem]">
              {loading && items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {items.length === 0 ? "No hay rubros." : "Ningún rubro coincide con la búsqueda."}
                </p>
              ) : (
                <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 truncate font-medium text-foreground">{r.nombre}</p>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {r.productos > 0 ? `${r.productos} PROD.` : ""}
                      </span>
                      {esEditor ? (
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${r.nombre}`}
                            disabled={pending}
                            onClick={() => abrirForm(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Eliminar ${r.nombre}`}
                            disabled={pending}
                            onClick={() => setBorrarTarget(r)}
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

      <Dialog open={formOpen} onOpenChange={(next) => !pending && setFormOpen(next)}>
        <AppModal
          title={editing ? "EDITAR RUBRO" : "NUEVO RUBRO"}
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={pending || !formNombre.trim()} onClick={() => void guardar()}>
                Guardar
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-1">
            <ModalMicroLabel>NOMBRE</ModalMicroLabel>
            <Input
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="NOMBRE (SE GUARDA EN MAYÚSCULAS)"
              disabled={pending}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void guardar();
                }
              }}
            />
            {editing && editing.productos > 0 ? (
              <p className="text-xs text-muted-foreground">
                Al renombrar se actualizan sus {editing.productos} producto(s) y la lista de precios de proveedores.
              </p>
            ) : null}
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="ELIMINAR RUBRO"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={borrando} onClick={() => setBorrarTarget(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={borrando} onClick={() => void confirmarBorrar()}>
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el rubro <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>?
            {borrarTarget && borrarTarget.productos > 0
              ? ` Tiene ${borrarTarget.productos} producto(s): no se podrá eliminar.`
              : " Esta acción no se puede deshacer."}
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
