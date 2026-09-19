"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const BOTON_ACCION_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "!size-8 max-h-8 min-h-8 min-w-8 shrink-0 !p-0"
);

export default function GestionarTesoreriaTipoCajaModal({
  open,
  onOpenChange,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<TesoreriaTipoCajaItem[]>([]);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<TesoreriaTipoCajaItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const bloqueado = pending || borrando;
  const codigosUsados = new Set(items.map((i) => i.codigo));
  const codigosDisponibles = OPCIONES_TIPO_CAJA_TESORERIA_UI.filter(
    (o) => !codigosUsados.has(o.value)
  );

  const cargar = useCallback(async () => {
    const res = await listarTesoreriaTipoCajaAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar los tipos de caja.");
      setItems([]);
      return;
    }
    setItems(res.data);
  }, []);

  useEffect(() => {
    if (!open) return;
    void cargar();
    setNuevoCodigo("");
    setNuevoNombre("");
    setEditingId(null);
    setEditDraft("");
    setBorrarTarget(null);
  }, [open, cargar]);

  async function handleCrear() {
    if (!esEditor || !nuevoCodigo || !nuevoNombre.trim() || bloqueado) return;
    setPending(true);
    try {
      const res = await crearTesoreriaTipoCajaAction({
        codigo: nuevoCodigo,
        nombre: nuevoNombre,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear el tipo de caja.");
        return;
      }
      toast.success("Tipo de caja creado.");
      setNuevoCodigo("");
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
      const res = await editarTesoreriaTipoCajaAction({
        id: editingId,
        nombre: editDraft,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Tipo de caja actualizado.");
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
      const res = await eliminarTesoreriaTipoCajaAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Tipo de caja eliminado.");
      setBorrarTarget(null);
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !bloqueado && onOpenChange(next)}>
        <AppModal
          title="GESTIONAR TIPO DE CAJA"
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
            {esEditor && codigosDisponibles.length > 0 ? (
              <div className="flex flex-col gap-2">
                <ModalMicroLabel>NUEVO TIPO DE CAJA</ModalMicroLabel>
                <div className="flex flex-col gap-2">
                  <Select value={nuevoCodigo} onValueChange={setNuevoCodigo} disabled={bloqueado}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="CÓDIGO" />
                    </SelectTrigger>
                    <SelectContent>
                      {codigosDisponibles.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      placeholder="Nombre en pantalla (MAYÚSCULAS)"
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
                      disabled={bloqueado || !nuevoCodigo || !nuevoNombre.trim()}
                      onClick={() => void handleCrear()}
                      className="gap-2"
                    >
                      <Plus className="size-4 shrink-0" aria-hidden />
                      Crear
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn("flex min-h-0 flex-1 flex-col gap-1", esEditor && "border-t pt-3")}>
              <ModalMicroLabel>TIPOS EXISTENTES</ModalMicroLabel>
              <ul className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5"
                  >
                    {editingId === item.id && esEditor ? (
                      <>
                        <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">
                          {item.codigo}
                        </span>
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
                        <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">
                          {item.codigo}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {item.nombre}
                        </span>
                        {esEditor ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_CLASS}
                              aria-label={`Editar ${item.nombre}`}
                              disabled={bloqueado}
                              onClick={() => {
                                setEditingId(item.id);
                                setEditDraft(item.nombre);
                              }}
                            >
                              <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={BOTON_ACCION_CLASS}
                              aria-label={`Eliminar ${item.nombre}`}
                              disabled={bloqueado}
                              onClick={() => setBorrarTarget(item)}
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
                    No hay tipos de caja.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="ELIMINAR TIPO DE CAJA"
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
            ¿Eliminar el tipo{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span> (
            {borrarTarget?.codigo})? No se puede deshacer. Si hay cajas con ese tipo, la baja
            fallará.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
