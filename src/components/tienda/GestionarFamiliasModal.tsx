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
  crearFamiliaAction,
  editarFamiliaAction,
  eliminarFamiliaAction,
  listarFamiliasCatalogoAction,
} from "@/actions/listaProductos";
import GestionarItemsFamiliaModal from "@/components/tienda/GestionarItemsFamiliaModal";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { FamiliaCatalogoItem } from "@/lib/listaProductos";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-9 w-9 min-h-9 max-h-9");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

export default function GestionarFamiliasModal({ open, onOpenChange, esEditor, onCatalogoChanged }: Props) {
  const [items, setItems] = useState<FamiliaCatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FamiliaCatalogoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [pending, setPending] = useState(false);
  const [itemsAbiertos, setItemsAbiertos] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<FamiliaCatalogoItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarFamiliasCatalogoAction();
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
    return items.filter((familia) =>
      matchByMultiTerm([familia.nombre, ...familia.descripciones], q)
    );
  }, [items, busqueda]);

  const puedeGuardar = esEditor && formNombre.trim().length > 0 && !pending;

  function abrirForm(item: FamiliaCatalogoItem | null) {
    if (!esEditor || pending) return;
    setEditing(item);
    setFormNombre(item?.nombre ?? "");
    setFormOpen(true);
  }

  async function guardar() {
    if (!puedeGuardar) return;
    setPending(true);
    try {
      const payload = { nombre: formNombre };
      const res = editing
        ? await editarFamiliaAction({ id: editing.id, ...payload })
        : await crearFamiliaAction(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Familia actualizada." : "Familia creada.");
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
      const res = await eliminarFamiliaAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Familia eliminada.");
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
        onOpenChange={(next) =>
          !pending && !borrando && !formOpen && !borrarTarget && !itemsAbiertos && onOpenChange(next)
        }
      >
        <AppModal
          title="GESTIONAR FAMILIAS"
          size="lg"
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
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="BUSCAR POR DESCRIPCIÓN..."
                  className="h-10 pl-9"
                  aria-label="Buscar familia por descripción"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Nueva familia"
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
                  {items.length === 0 ? "No hay familias." : "Ninguna familia coincide con la búsqueda."}
                </p>
              ) : (
                <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((familia) => (
                    <li
                      key={familia.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 truncate font-medium text-foreground">{familia.nombre}</p>
                      {esEditor ? (
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${familia.nombre}`}
                            title="Editar"
                            disabled={pending}
                            onClick={() => abrirForm(familia)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Borrar ${familia.nombre}`}
                            title="Borrar"
                            disabled={pending}
                            onClick={() => setBorrarTarget(familia)}
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
          if (pending || itemsAbiertos) return;
          if (!next) setItemsAbiertos(false);
          setFormOpen(next);
        }}
      >
        <AppModal
          title={editing ? "EDITAR FAMILIA" : "NUEVA FAMILIA"}
          size="md"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}>
                Guardar
              </Button>
            </div>
          }
        >
            <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>NOMBRE</ModalMicroLabel>
              <Input
                value={formNombre}
                maxLength={120}
                disabled={pending}
                aria-label="Nombre de familia"
                onChange={(e) => setFormNombre(e.target.value.toLocaleUpperCase("es-AR"))}
              />
            </div>
            {editing ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setItemsAbiertos(true)}
              >
                Gestionar Items
              </Button>
            ) : null}
          </div>
        </AppModal>
      </Dialog>

      {editing ? (
        <GestionarItemsFamiliaModal
          open={itemsAbiertos}
          onOpenChange={setItemsAbiertos}
          familiaId={editing.id}
          onGuardado={() => {
            void cargar();
            onCatalogoChanged?.();
          }}
        />
      ) : null}

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="BORRAR FAMILIA"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={borrando} onClick={() => setBorrarTarget(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={borrando} onClick={() => void confirmarBorrar()}>
                Borrar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            ¿Borrar la familia{" "}
            <span className="font-semibold text-foreground">
              {borrarTarget?.nombre ?? ""}
            </span>
            ? Los ítems quedan sin familia.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
