"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import {
  crearCobrosCuotaAction,
  editarCobrosCuotaAction,
  eliminarCobrosCuotaAction,
  listarCobrosCuotasAction,
  listarFinAnaCosFinaPagosAction,
} from "@/actions/finAnaCosFina";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuotasIniciales: CobrosCuotaItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

const VACIO = "none";

export default function GestionarCuotasFinAnaCosFinaModal({
  open,
  onOpenChange,
  cuotasIniciales,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<CobrosCuotaItem[]>(cuotasIniciales);
  const [pagos, setPagos] = useState<FinAnaCosFinaPagoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CobrosCuotaItem | null>(null);
  const [formCuotas, setFormCuotas] = useState("");
  const [formPares, setFormPares] = useState<{ pagoId: string; entidadId: string }[]>([
    { pagoId: "", entidadId: "" },
  ]);
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<CobrosCuotaItem | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ignoreParentCloseRef = useRef(false);

  function markNestedDialogClosing() {
    ignoreParentCloseRef.current = true;
    queueMicrotask(() => {
      ignoreParentCloseRef.current = false;
    });
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resCuotas, resPagos] = await Promise.all([
        listarCobrosCuotasAction(),
        listarFinAnaCosFinaPagosAction(),
      ]);
      if (!resCuotas.ok) {
        toast.error(resCuotas.error ?? "No se pudieron cargar las cuotas.");
        setItems([]);
      } else {
        setItems(resCuotas.data);
      }
      if (!resPagos.ok) {
        toast.error(resPagos.error ?? "No se pudieron cargar las formas de pago.");
        setPagos([]);
      } else {
        setPagos(resPagos.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setItems(cuotasIniciales);
    setBusqueda("");
    setFormOpen(false);
    setEditingItem(null);
    setFormCuotas("");
    setFormPares([{ pagoId: "", entidadId: "" }]);
    setBorrarTarget(null);
    void cargar();
    // Solo al abrir: no resetear en refresh de props.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open
  }, [open]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm([
        item.cuotas,
        ...item.vinculos.flatMap((vinculo) => [vinculo.pagoNombre, vinculo.entidadNombre]),
      ], q)
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormCuotas("");
    setFormPares([{ pagoId: "", entidadId: "" }]);
  }

  function abrirCrear() {
    if (!esEditor || pending) return;
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: CobrosCuotaItem) {
    if (!esEditor || pending) return;
    setEditingItem(item);
    setFormCuotas(item.cuotas);
    setFormPares(
      item.vinculos.length > 0
        ? item.vinculos.map((vinculo) => ({
            pagoId: vinculo.pagoId,
            entidadId: vinculo.entidadId,
          }))
        : [{ pagoId: "", entidadId: "" }]
    );
    setFormOpen(true);
  }

  const formasOpciones = useMemo(() => {
    const enUso = new Set(formPares.map((par) => par.pagoId).filter(Boolean));
    return pagos
      .filter((pago) => pago.entidadIds.length > 0 || enUso.has(pago.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [pagos, formPares]);

  function entidadesDe(pagoId: string, entidadId: string) {
    const pago = pagos.find((item) => item.id === pagoId);
    if (!pago) return [];
    const lista = pago.entidadIds.map((id, idx) => ({
      id,
      nombre: pago.entidadNombres[idx] ?? "",
    }));
    if (entidadId && !lista.some((entidad) => entidad.id === entidadId)) {
      const guardada = editingItem?.vinculos.find(
        (vinculo) => vinculo.pagoId === pagoId && vinculo.entidadId === entidadId
      );
      if (guardada) lista.push({ id: guardada.entidadId, nombre: guardada.entidadNombre });
    }
    return lista;
  }

  function cambiarPagoPar(indice: number, nextId: string) {
    const pagoId = nextId === VACIO ? "" : nextId;
    setFormPares((prev) =>
      prev.map((par, i) => {
        if (i !== indice) return par;
        const pago = pagos.find((item) => item.id === pagoId);
        const entidadId = pago && pago.entidadIds.includes(par.entidadId) ? par.entidadId : "";
        return { pagoId, entidadId };
      })
    );
  }

  function cambiarEntidadPar(indice: number, nextId: string) {
    const entidadId = nextId === VACIO ? "" : nextId;
    setFormPares((prev) => prev.map((par, i) => (i === indice ? { ...par, entidadId } : par)));
  }

  const formValido =
    formCuotas.trim().length > 0 &&
    formPares.length > 0 &&
    formPares.every((par) => par.pagoId.length > 0 && par.entidadId.length > 0) &&
    new Set(formPares.map((par) => `${par.pagoId}:${par.entidadId}`)).size === formPares.length;

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    const vinculos = formPares.map((par) => ({
      pagoId: par.pagoId,
      entidadId: par.entidadId,
    }));
    try {
      if (editingItem) {
        const res = await editarCobrosCuotaAction({
          id: editingItem.id,
          cuotas: formCuotas,
          vinculos,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Cuota actualizada.");
      } else {
        const res = await crearCobrosCuotaAction({
          cuotas: formCuotas,
          vinculos,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear la cuota.");
          return;
        }
        toast.success("Cuota creada.");
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
      const res = await eliminarCobrosCuotaAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Cuota eliminada.");
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
            (pending || borrando || formOpen || Boolean(borrarTarget) || ignoreParentCloseRef.current)
          ) {
            return;
          }
          onOpenChange(next);
        }}
      >
        <AppModal
          title="GESTIONAR CUOTAS"
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
                  placeholder="BUSCAR CUOTA..."
                  className="h-10 pl-9"
                  aria-label="Buscar cuota"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar cuota"
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
                  No hay cuotas. Usá el botón + para agregar la primera.
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguna cuota coincide con la búsqueda.</p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-left font-medium text-foreground">{item.cuotas}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.vinculos
                            .map((vinculo) => `${vinculo.pagoNombre} · ${vinculo.entidadNombre}`)
                            .join(" · ")}
                        </p>
                      </div>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${item.cuotas}`}
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
                            aria-label={`Eliminar ${item.cuotas}`}
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
          if (!next) markNestedDialogClosing();
          setFormOpen(next);
          if (!next) resetForm();
        }}
      >
        <AppModal
          title={editingItem ? "EDITAR CUOTA" : "NUEVA CUOTA"}
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Cuotas</ModalMicroLabel>
              <Input
                value={formCuotas}
                onChange={(e) => setFormCuotas(e.target.value.toLocaleUpperCase("es-AR"))}
                placeholder="Ej. 06 CUOTAS SIN INTERES"
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <ModalMicroLabel>Forma de pago y entidad</ModalMicroLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Agregar forma de pago y entidad"
                  disabled={pending || formasOpciones.length === 0}
                  onClick={() =>
                    setFormPares((prev) => [...prev, { pagoId: "", entidadId: "" }])
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formasOpciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay formas de pago con entidades. Vinculalas en Gestionar Formas Pago.
                </p>
              ) : (
                formPares.map((par, indice) => {
                  const entidades = entidadesDe(par.pagoId, par.entidadId);
                  return (
                    <div key={indice} className="flex items-start gap-2">
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                        <Select
                          value={par.pagoId || VACIO}
                          onValueChange={(value) => cambiarPagoPar(indice, value)}
                          disabled={pending}
                        >
                          <SelectTrigger
                            className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                            aria-label={`Forma de pago ${indice + 1}`}
                          >
                            <SelectValue placeholder="FORMA DE PAGO" />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            side="bottom"
                            align="start"
                            className="select-content-filtro"
                          >
                            <SelectItem value={VACIO}>FORMA DE PAGO</SelectItem>
                            {formasOpciones.map((pago) => (
                              <SelectItem key={pago.id} value={pago.id}>
                                {pago.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!par.pagoId ? (
                          <p className="self-center text-sm text-muted-foreground">
                            Elegí la forma de pago.
                          </p>
                        ) : entidades.length === 0 ? (
                          <p className="self-center text-sm text-muted-foreground">
                            Sin entidades vinculadas.
                          </p>
                        ) : (
                          <Select
                            value={par.entidadId || VACIO}
                            onValueChange={(value) => cambiarEntidadPar(indice, value)}
                            disabled={pending}
                          >
                            <SelectTrigger
                              className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                              aria-label={`Entidad ${indice + 1}`}
                            >
                              <SelectValue placeholder="ENTIDAD" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              side="bottom"
                              align="start"
                              className="select-content-filtro"
                            >
                              <SelectItem value={VACIO}>ENTIDAD</SelectItem>
                              {entidades.map((entidad) => (
                                <SelectItem key={entidad.id} value={entidad.id}>
                                  {entidad.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={LIST_ROW_ICON_BTN_CLASS}
                        aria-label={`Quitar vínculo ${indice + 1}`}
                        disabled={pending || formPares.length === 1}
                        onClick={() =>
                          setFormPares((prev) => prev.filter((_, i) => i !== indice))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
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
          title="ELIMINAR CUOTA"
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
            ¿Eliminar{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.cuotas}</span>?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
