"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  crearTesoreriaTipoCajaAction,
  editarTesoreriaTipoCajaAction,
  eliminarTesoreriaTipoCajaAction,
  listarTesoreriaTipoCajaAction,
} from "@/actions/tesoreriaTipoCaja";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TesoreriaTipoCajaItem } from "@/lib/cajasTesoreriaTipoCaja";
import { OPCIONES_TIPO_CAJA_TESORERIA_UI } from "@/lib/cajasTesoreriaTipos";
import { matchByMultiTerm } from "@/lib/busqueda";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

export default function GestionarTesoreriaTipoCajaModal({
  open,
  onOpenChange,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<TesoreriaTipoCajaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TesoreriaTipoCajaItem | null>(null);
  const [formCodigo, setFormCodigo] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<TesoreriaTipoCajaItem | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ignoreParentCloseRef = useRef(false);

  const bloqueado = pending || borrando;
  const codigosUsados = useMemo(() => new Set(items.map((i) => i.codigo)), [items]);
  const codigosDisponibles = useMemo(
    () => OPCIONES_TIPO_CAJA_TESORERIA_UI.filter((o) => !codigosUsados.has(o.value)),
    [codigosUsados]
  );
  const puedeCrear = esEditor && codigosDisponibles.length > 0;

  function markNestedDialogClosing() {
    ignoreParentCloseRef.current = true;
    queueMicrotask(() => {
      ignoreParentCloseRef.current = false;
    });
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarTesoreriaTipoCajaAction();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar los tipos de caja.");
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
    setEditingItem(null);
    setFormCodigo("");
    setFormNombre("");
    setBorrarTarget(null);
    void cargar();
    // Solo al abrir: no resetear en refresh de props.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open
  }, [open]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) => matchByMultiTerm([item.nombre, item.codigo], q));
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormCodigo("");
    setFormNombre("");
  }

  function abrirCrear() {
    if (!puedeCrear || pending) return;
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: TesoreriaTipoCajaItem) {
    if (!esEditor || pending) return;
    setEditingItem(item);
    setFormCodigo(item.codigo);
    setFormNombre(item.nombre);
    setFormOpen(true);
  }

  const formValido = editingItem
    ? formNombre.trim().length > 0
    : formCodigo.length > 0 && formNombre.trim().length > 0;

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    try {
      if (editingItem) {
        const res = await editarTesoreriaTipoCajaAction({
          id: editingItem.id,
          nombre: formNombre,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Tipo de caja actualizado.");
      } else {
        const res = await crearTesoreriaTipoCajaAction({
          codigo: formCodigo,
          nombre: formNombre,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear el tipo de caja.");
          return;
        }
        toast.success("Tipo de caja creado.");
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

  async function confirmarBorrar() {
    if (!borrarTarget || borrando) return;
    setBorrando(true);
    try {
      const res = await eliminarTesoreriaTipoCajaAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Tipo de caja eliminado.");
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
          title="GESTIONAR TIPO DE CAJA"
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
                  placeholder="BUSCAR TIPO DE CAJA..."
                  className="h-10 pl-9"
                  aria-label="Buscar tipo de caja"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar tipo de caja"
                  disabled={bloqueado || !puedeCrear}
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
                  No hay tipos de caja. Usá el botón + para agregar el primero.
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ningún tipo de caja coincide con la búsqueda.
                </p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
                        {item.nombre}
                      </p>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${item.nombre}`}
                            disabled={bloqueado}
                            onClick={() => abrirEditar(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Eliminar ${item.nombre}`}
                            disabled={bloqueado}
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
          if (!next) markNestedDialogClosing();
          setFormOpen(next);
          if (!next) resetForm();
        }}
      >
        <AppModal
          title={editingItem ? "EDITAR TIPO DE CAJA" : "NUEVO TIPO DE CAJA"}
          size="sm"
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
          <div className="flex flex-col gap-3">
            {editingItem ? (
              <p className="text-sm text-muted-foreground">Código: {editingItem.codigo}</p>
            ) : (
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Código</ModalMicroLabel>
                <Select
                  value={formCodigo || undefined}
                  onValueChange={(value) => {
                    setFormCodigo(value);
                    const etiqueta = OPCIONES_TIPO_CAJA_TESORERIA_UI.find((o) => o.value === value)?.label;
                    if (etiqueta && formNombre.trim().length === 0) {
                      setFormNombre(etiqueta);
                    }
                  }}
                  disabled={pending}
                >
                  <SelectTrigger className="w-full" aria-label="Código">
                    <SelectValue placeholder="ELEGIR CÓDIGO" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    {codigosDisponibles.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Nombre</ModalMicroLabel>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value.toLocaleUpperCase("es-AR"))}
                placeholder="NOMBRE (SE GUARDARÁ EN MAYÚSCULAS)"
                disabled={pending}
                autoFocus={Boolean(editingItem)}
              />
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
          title="ELIMINAR TIPO DE CAJA"
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
            ¿Eliminar el tipo{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>
            {borrarTarget?.codigo ? ` (${borrarTarget.codigo})` : ""}? No se puede deshacer. Si hay
            cajas con ese tipo, la baja fallará.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
