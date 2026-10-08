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
  crearMarcaAction,
  editarMarcaAction,
  eliminarMarcaAction,
  listarMarcasCatalogoAction,
} from "@/actions/listaProductos";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { MarcaCatalogoItem } from "@/lib/listaProductos";
import { describirFormatoCod, parsearFormatoCod } from "@/lib/tintometricoFormatoCod";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-9 w-9 min-h-9 max-h-9");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

export default function GestionarMarcasModal({ open, onOpenChange, esEditor, onCatalogoChanged }: Props) {
  const [items, setItems] = useState<MarcaCatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarcaCatalogoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formFormato, setFormFormato] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<MarcaCatalogoItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarMarcasCatalogoAction();
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
    return items.filter((m) => matchByMultiTerm([m.nombre, m.formatoCodTintometrico], q));
  }, [items, busqueda]);

  const formatoTrim = formFormato.trim();
  const formatoParse = formatoTrim ? parsearFormatoCod(formatoTrim) : null;
  const errorFormato = formatoParse && !formatoParse.ok ? formatoParse.error : null;
  function abrirForm(item: MarcaCatalogoItem | null) {
    if (!esEditor || pending) return;
    setEditing(item);
    setFormNombre(item?.nombre ?? "");
    setFormFormato(item?.formatoCodTintometrico ?? "");
    setFormOpen(true);
  }

  async function guardar() {
    if (!esEditor || !formNombre.trim() || errorFormato || pending) return;
    setPending(true);
    try {
      const payload = { nombre: formNombre, formatoCodTintometrico: formatoTrim || null };
      const res = editing
        ? await editarMarcaAction({ id: editing.id, ...payload })
        : await crearMarcaAction(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Marca actualizada." : "Marca creada.");
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
      const res = await eliminarMarcaAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marca eliminada.");
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
          title="GESTIONAR MARCAS"
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
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="BUSCAR MARCA..."
                  className="h-10 pl-9"
                  aria-label="Buscar marca"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar marca"
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
                  {items.length === 0 ? "No hay marcas." : "Ninguna marca coincide con la búsqueda."}
                </p>
              ) : (
                <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 truncate font-medium text-foreground">{m.nombre}</p>
                      {esEditor ? (
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${m.nombre}`}
                            disabled={pending}
                            onClick={() => abrirForm(m)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Eliminar ${m.nombre}`}
                            disabled={pending}
                            onClick={() => setBorrarTarget(m)}
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
          title={editing ? "EDITAR MARCA" : "NUEVA MARCA"}
          size="md"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !formNombre.trim() || Boolean(errorFormato)}
                onClick={() => void guardar()}
              >
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
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="NOMBRE (SE GUARDA EN MAYÚSCULAS)"
                disabled={pending}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>FORMATO TINTOMÉTRICO</ModalMicroLabel>
              <Input
                value={formFormato}
                onChange={(e) => setFormFormato(e.target.value)}
                placeholder='EJ.: LLNN NN/NNN  ·  "SW"NNNN  (VACÍO = CÓDIGO LIBRE)'
                disabled={pending}
                aria-invalid={Boolean(errorFormato) || undefined}
                className={cn("tabular-nums", errorFormato && "border-destructive")}
              />
              <p className={cn("text-xs", errorFormato ? "text-destructive" : "text-muted-foreground")}>
                {errorFormato ??
                  (formatoTrim
                    ? describirFormatoCod(formatoTrim)
                    : 'L = letra · N = número · "…" = texto fijo · espacio / - . = literales')}
              </p>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="ELIMINAR MARCA"
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
            ¿Eliminar la marca <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>?
            {borrarTarget && borrarTarget.productos > 0
              ? ` Tiene ${borrarTarget.productos} producto(s) vinculado(s): no se podrá eliminar.`
              : " Esta acción no se puede deshacer."}
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
