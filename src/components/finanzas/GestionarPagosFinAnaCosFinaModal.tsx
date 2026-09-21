"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  crearFinAnaCosFinaPagoAction,
  editarFinAnaCosFinaPagoAction,
  eliminarFinAnaCosFinaPagoAction,
  listarFinAnaCosFinaPagosAction,
  listarFinAnaCosFinaTerminalesMarcasAction,
} from "@/actions/finAnaCosFina";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import FiltroMultiSelect from "@/components/shared/FiltroMultiSelect";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagosIniciales: FinAnaCosFinaPagoItem[];
  entidadesIniciales: FinAnaCosFinaTerminalMarcaItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

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
  const [formAceptaCuotas, setFormAceptaCuotas] = useState(false);
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<FinAnaCosFinaPagoItem | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ignoreParentCloseRef = useRef(false);

  const bloqueado = pending || borrando;

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
    setFormAceptaCuotas(false);
    setBorrarTarget(null);
    void cargar();
    // Solo al abrir: no resetear en refresh de props.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open
  }, [open]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [
          item.nombre,
          ...item.entidadNombres,
          item.aceptaCuotas ? "cuotas" : "",
        ],
        q
      )
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormNombre("");
    setFormEntidadIds([]);
    setFormAceptaCuotas(false);
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
    setFormAceptaCuotas(item.aceptaCuotas);
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
          aceptaCuotas: formAceptaCuotas,
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
          aceptaCuotas: formAceptaCuotas,
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
                Cada forma de pago requiere al menos una entidad. Si acepta cuotas, Cx. Fin. Cobros
                genera una fila por cada cuota del catálogo.
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
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-left font-medium text-foreground">
                          {pago.nombre}
                          {pago.aceptaCuotas ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              · CUOTAS
                            </span>
                          ) : null}
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
            <ModalSiNoChoice
              label="ACEPTA CUOTAS"
              value={formAceptaCuotas}
              onChange={setFormAceptaCuotas}
              disabled={pending}
            />
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>ENTIDADES</ModalMicroLabel>
              {entidades.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay entidades. Creá una desde Gestionar Entidades.
                </p>
              ) : (
                <FiltroMultiSelect
                  opciones={entidades.map((entidad) => ({
                    value: entidad.id,
                    label: entidad.nombre,
                  }))}
                  selected={formEntidadIds}
                  onChange={setFormEntidadIds}
                  placeholder="SELECCIONAR ENTIDADES"
                  ariaLabel="Entidades"
                  disabled={pending}
                />
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
