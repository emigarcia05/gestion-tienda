"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import {
  crearRubroAction,
  crearSubRubroAction,
  editarRubroAction,
  editarSubRubroAction,
  eliminarRubroAction,
  eliminarSubRubroAction,
  listarRubrosCatalogoAction,
} from "@/actions/listaProductos";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { RubroCatalogoItem } from "@/lib/listaProductos";
import type { ActionResult } from "@/lib/types";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-9 w-9 min-h-9 max-h-9");
const SUB_ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-8 w-8 min-h-8 max-h-8");

type TipoCatalogo = "rubro" | "subRubro";

/** Alta / edición de rubro o sub-rubro (`id` null = alta; `idRubro` = rubro padre del sub-rubro). */
type FormCatalogo = {
  tipo: TipoCatalogo;
  id: string | null;
  idRubro: string | null;
  rubroNombre: string | null;
  nombre: string;
  productos: number;
};

type BorrarCatalogo = { tipo: TipoCatalogo; id: string; nombre: string; productos: number };

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
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<FormCatalogo | null>(null);
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<BorrarCatalogo | null>(null);
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
    setExpandidos(new Set());
    setForm(null);
    setBorrarTarget(null);
    void cargar();
  }, [open, cargar]);

  const q = busqueda.trim();
  const listaFiltrada = useMemo(() => {
    if (!q) return items;
    return items.filter(
      (r) => matchByMultiTerm([r.nombre], q) || r.subRubros.some((s) => matchByMultiTerm([s.nombre], q))
    );
  }, [items, q]);

  function alternarExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrirFormRubro(rubro: RubroCatalogoItem | null) {
    if (!esEditor || pending) return;
    setForm({
      tipo: "rubro",
      id: rubro?.id ?? null,
      idRubro: null,
      rubroNombre: null,
      nombre: rubro?.nombre ?? "",
      productos: rubro?.productos ?? 0,
    });
  }

  function abrirFormSubRubro(rubro: RubroCatalogoItem, sub: RubroCatalogoItem["subRubros"][number] | null) {
    if (!esEditor || pending) return;
    setForm({
      tipo: "subRubro",
      id: sub?.id ?? null,
      idRubro: rubro.id,
      rubroNombre: rubro.nombre,
      nombre: sub?.nombre ?? "",
      productos: sub?.productos ?? 0,
    });
  }

  async function guardar() {
    if (!esEditor || !form || !form.nombre.trim() || pending) return;
    setPending(true);
    try {
      let res: ActionResult<{ id: string }>;
      if (form.tipo === "rubro") {
        res = form.id
          ? await editarRubroAction({ id: form.id, nombre: form.nombre })
          : await crearRubroAction({ nombre: form.nombre });
      } else {
        res = form.id
          ? await editarSubRubroAction({ id: form.id, nombre: form.nombre })
          : await crearSubRubroAction({ idRubro: form.idRubro, nombre: form.nombre });
      }
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const entidad = form.tipo === "rubro" ? "Rubro" : "Sub-rubro";
      toast.success(form.id ? `${entidad} actualizado.` : `${entidad} creado.`);
      if (form.tipo === "subRubro" && form.idRubro) {
        const idRubro = form.idRubro;
        setExpandidos((prev) => new Set(prev).add(idRubro));
      }
      setForm(null);
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
      const res =
        borrarTarget.tipo === "rubro"
          ? await eliminarRubroAction({ id: borrarTarget.id })
          : await eliminarSubRubroAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(borrarTarget.tipo === "rubro" ? "Rubro eliminado." : "Sub-rubro eliminado.");
      setBorrarTarget(null);
      await cargar();
      onCatalogoChanged?.();
    } finally {
      setBorrando(false);
    }
  }

  const tituloForm = form
    ? `${form.id ? "EDITAR" : "NUEVO"} ${form.tipo === "rubro" ? "RUBRO" : "SUB-RUBRO"}`
    : "";
  const entidadBorrar = borrarTarget?.tipo === "subRubro" ? "sub-rubro" : "rubro";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => !pending && !borrando && !form && !borrarTarget && onOpenChange(next)}
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
                  placeholder="BUSCAR RUBRO O SUB-RUBRO..."
                  className="h-10 pl-9"
                  aria-label="Buscar rubro o sub-rubro"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar rubro"
                  disabled={pending}
                  onClick={() => abrirFormRubro(null)}
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
                  {listaFiltrada.map((r) => {
                    const expandido = Boolean(q) || expandidos.has(r.id);
                    const Chevron = expandido ? ChevronDown : ChevronRight;
                    return (
                      <li key={r.id} className="rounded-md border border-border bg-card">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-primary"
                            aria-label={expandido ? `Contraer ${r.nombre}` : `Ver sub-rubros de ${r.nombre}`}
                            aria-expanded={expandido}
                            onClick={() => alternarExpandido(r.id)}
                          >
                            <Chevron className="h-4 w-4" />
                          </Button>
                          <p className="min-w-0 flex-1 truncate font-medium text-foreground">
                            {r.nombre}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {r.subRubros.length} SUB-RUBRO(S)
                            </span>
                          </p>
                          {esEditor ? (
                            <div className="ml-2 flex shrink-0 items-center gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={LIST_ROW_ICON_BTN_CLASS}
                                aria-label={`Editar ${r.nombre}`}
                                disabled={pending}
                                onClick={() => abrirFormRubro(r)}
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
                                onClick={() =>
                                  setBorrarTarget({ tipo: "rubro", id: r.id, nombre: r.nombre, productos: r.productos })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        {expandido ? (
                          <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2 pl-12">
                            {r.subRubros.length === 0 ? (
                              <p className="text-xs text-muted-foreground">SIN SUB-RUBROS.</p>
                            ) : (
                              r.subRubros.map((s) => (
                                <div key={s.id} className="flex items-center gap-2">
                                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">{s.nombre}</p>
                                  {esEditor ? (
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={SUB_ROW_ICON_BTN_CLASS}
                                        aria-label={`Editar ${s.nombre}`}
                                        disabled={pending}
                                        onClick={() => abrirFormSubRubro(r, s)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={SUB_ROW_ICON_BTN_CLASS}
                                        aria-label={`Eliminar ${s.nombre}`}
                                        disabled={pending}
                                        onClick={() =>
                                          setBorrarTarget({
                                            tipo: "subRubro",
                                            id: s.id,
                                            nombre: s.nombre,
                                            productos: s.productos,
                                          })
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))
                            )}
                            {esEditor ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-1 w-fit gap-1.5"
                                disabled={pending}
                                onClick={() => abrirFormSubRubro(r, null)}
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                                Sub-rubro
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(form)} onOpenChange={(next) => !next && !pending && setForm(null)}>
        <AppModal
          title={tituloForm}
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button type="button" disabled={pending || !form?.nombre.trim()} onClick={() => void guardar()}>
                Guardar
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-1">
            {form?.tipo === "subRubro" ? (
              <p className="text-xs text-muted-foreground">
                RUBRO: <span className="font-semibold text-foreground">{form.rubroNombre}</span>
              </p>
            ) : null}
            <ModalMicroLabel>NOMBRE</ModalMicroLabel>
            <Input
              value={form?.nombre ?? ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, nombre: e.target.value } : prev))}
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
            {form?.tipo === "rubro" && form.id && form.productos > 0 ? (
              <p className="text-xs text-muted-foreground">
                Al renombrar también se actualiza la lista de precios de proveedores.
              </p>
            ) : null}
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title={borrarTarget?.tipo === "subRubro" ? "ELIMINAR SUB-RUBRO" : "ELIMINAR RUBRO"}
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
            ¿Eliminar el {entidadBorrar}{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.nombre}</span>?
            {borrarTarget && borrarTarget.productos > 0
              ? ` Tiene ${borrarTarget.productos} producto(s): no se podrá eliminar.`
              : borrarTarget?.tipo === "rubro"
                ? " También se eliminan sus sub-rubros. Esta acción no se puede deshacer."
                : " Esta acción no se puede deshacer."}
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
