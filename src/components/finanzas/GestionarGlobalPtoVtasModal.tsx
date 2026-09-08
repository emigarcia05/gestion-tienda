"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  crearGlobalPtoVtaAction,
  editarGlobalPtoVtaAction,
  eliminarGlobalPtoVtaAction,
  listarGlobalPtoVtasAction,
} from "@/actions/globalPtoVtas";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { GlobalPtoVtaItem, GlobalPtoVtaSucursalOption } from "@/lib/globalPtoVtas";
import type { ActionResult } from "@/lib/types";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemsIniciales: GlobalPtoVtaItem[];
  sucursales: GlobalPtoVtaSucursalOption[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

function etiquetaSucursales(item: GlobalPtoVtaItem): string {
  return item.sucursales.map((s) => s.nombre).join(", ");
}

export default function GestionarGlobalPtoVtasModal({
  open,
  onOpenChange,
  itemsIniciales,
  sucursales,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<GlobalPtoVtaItem[]>(itemsIniciales);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GlobalPtoVtaItem | null>(null);
  const [formPtoVenta, setFormPtoVenta] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formSucursalIds, setFormSucursalIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<GlobalPtoVtaItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res: ActionResult<GlobalPtoVtaItem[]> = await listarGlobalPtoVtasAction();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar los puntos de venta.");
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
    setFormPtoVenta("");
    setFormNombre("");
    setFormSucursalIds([]);
    setBorrarTarget(null);
    void cargar();
  }, [open, cargar, itemsIniciales]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [String(item.ptoVenta), item.nombrePtoVenta, etiquetaSucursales(item)],
        q
      )
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormPtoVenta("");
    setFormNombre("");
    setFormSucursalIds([]);
  }

  function abrirCrear() {
    if (!esEditor || pending) return;
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: GlobalPtoVtaItem) {
    if (!esEditor || pending) return;
    setEditingItem(item);
    setFormPtoVenta(String(item.ptoVenta));
    setFormNombre(item.nombrePtoVenta);
    setFormSucursalIds(
      item.sucursales
        .map((s) => s.id)
        .filter((id) => sucursales.some((opt) => opt.id === id))
    );
    setFormOpen(true);
  }

  function toggleSucursal(id: string) {
    setFormSucursalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const formValido =
    formPtoVenta.trim().length > 0 &&
    formNombre.trim().length > 0 &&
    formSucursalIds.length > 0;

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    try {
      const payload = {
        ptoVenta: formPtoVenta,
        nombrePtoVenta: formNombre,
        sucursalIds: formSucursalIds,
      };
      if (editingItem) {
        const res = await editarGlobalPtoVtaAction({
          id: editingItem.id,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Punto de venta actualizado.");
      } else {
        const res = await crearGlobalPtoVtaAction(payload);
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear.");
          return;
        }
        toast.success("Punto de venta creado.");
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
      const res = await eliminarGlobalPtoVtaAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Punto de venta eliminado.");
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
          title="PUNTOS DE VENTA"
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
                  placeholder="BUSCAR PTO. VTA..."
                  className="h-10 pl-9"
                  aria-label="Buscar punto de venta"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar punto de venta"
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
                  No hay puntos de venta. Usá el botón + para agregar el primero.
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ningún punto de venta coincide con la búsqueda.
                </p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium text-foreground">
                          {item.ptoVenta} · {item.nombrePtoVenta}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {etiquetaSucursales(item)}
                        </p>
                      </div>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${item.nombrePtoVenta}`}
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
                            aria-label={`Eliminar ${item.nombrePtoVenta}`}
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
          title={editingItem ? "EDITAR PUNTO DE VENTA" : "NUEVO PUNTO DE VENTA"}
          size="md"
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
              <ModalMicroLabel>Pto. Venta</ModalMicroLabel>
              <Input
                value={formPtoVenta}
                onChange={(e) => setFormPtoVenta(e.target.value.replace(/\D/g, ""))}
                placeholder="NRO."
                disabled={pending}
                inputMode="numeric"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Nombre</ModalMicroLabel>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value.toLocaleUpperCase("es-AR"))}
                placeholder="NOMBRE (SE GUARDARÁ EN MAYÚSCULAS)"
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <ModalMicroLabel>Suc. Asociadas</ModalMicroLabel>
              {sucursales.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay sucursales cargadas.</p>
              ) : (
                <ul className="flex max-h-[16rem] flex-col gap-1 overflow-y-auto pr-1">
                  {sucursales.map((suc) => {
                    const seleccionado = formSucursalIds.includes(suc.id);
                    return (
                      <li key={suc.id}>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => toggleSucursal(suc.id)}
                          aria-pressed={seleccionado}
                          aria-label={
                            seleccionado
                              ? `Quitar ${suc.nombre}`
                              : `Asociar ${suc.nombre}`
                          }
                          className="flex h-auto w-full items-center justify-start gap-2 rounded-md px-2 py-2 text-left font-normal"
                        >
                          <span
                            className={cn(
                              "tabla-check-toggle shrink-0",
                              seleccionado &&
                                "border-primary text-primary"
                            )}
                            aria-hidden
                          >
                            {seleccionado ? (
                              <Check className={TABLE_ROW_ACTION_ICON_CLASS} />
                            ) : null}
                          </span>
                          <span className="min-w-0 truncate text-foreground">{suc.nombre}</span>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="ELIMINAR PUNTO DE VENTA"
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
            ¿Eliminar el punto de venta{" "}
            <span className="font-semibold text-foreground">
              {borrarTarget?.ptoVenta} · {borrarTarget?.nombrePtoVenta}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
