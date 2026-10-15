"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  crearEstPorProdPresentacionAction,
  editarEstPorProdPresentacionAction,
  eliminarEstPorProdPresentacionAction,
  listarEstPorProdPresentacionesAction,
} from "@/actions/estPorProdPresentacion";
import { listarEstPorProdUnPresentacionesAction } from "@/actions/estPorProdUnPresentacion";
import GestionarEstPorProdUnPresentacionModal from "@/components/estadisticas-productos/GestionarEstPorProdUnPresentacionModal";
import { matchByMultiTerm } from "@/lib/busqueda";
import type { EstPorProdPresentacionItem } from "@/lib/estPorProdPresentacion";
import {
  etiquetaPresentacionConversion,
  etiquetaPresentacionMedida,
} from "@/lib/estPorProdPresentacion";
import type { EstPorProdUnPresentacionItem } from "@/lib/estPorProdUnPresentacion";
import { formatearPresentacionConUnidad } from "@/lib/estPorProdUnPresentacion";
import type { ActionResult } from "@/lib/types";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

const SELECT_TRIGGER_CLASS = "input-filtro-unificado w-full";

const INPUT_READONLY_CLASS = "bg-muted/40 cursor-default";

/** Valor sentinel del Select para dejar conversión vacía. */
const SIN_CONVERSION = "__SIN_CONVERSION__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemsIniciales: EstPorProdPresentacionItem[];
  unidades: EstPorProdUnPresentacionItem[];
  esEditor: boolean;
  /** Tras crear/editar/eliminar: p. ej. `router.refresh()`. */
  onCatalogoChanged?: () => void;
}

function formatoNumeroInput(n: number): string {
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("es-AR", { maximumFractionDigits: 4 });
}

/** Parseo liviano para previsualizar unidad completa (coma/punto). */
function parseNumeroPreview(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function previewUnidadCompleta(
  numericaRaw: string,
  unidad: EstPorProdUnPresentacionItem | undefined
): string {
  if (!unidad) return "";
  if (parseNumeroPreview(numericaRaw) === null) return "";
  return formatearPresentacionConUnidad(numericaRaw, unidad).toLocaleUpperCase("es-AR");
}

export default function GestionarEstPorProdPresentacionModal({
  open,
  onOpenChange,
  itemsIniciales,
  unidades: unidadesProp,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<EstPorProdPresentacionItem[]>(itemsIniciales);
  /** Unidades recargadas tras gestionar el catálogo; `null` = usar las del padre. */
  const [unidadesRecargadas, setUnidadesRecargadas] = useState<
    EstPorProdUnPresentacionItem[] | null
  >(null);
  const unidades = unidadesRecargadas ?? unidadesProp;
  const [modalUnidadesOpen, setModalUnidadesOpen] = useState(false);
  const [unidadesCambiaron, setUnidadesCambiaron] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstPorProdPresentacionItem | null>(
    null
  );
  const [formUnidadMedidaId, setFormUnidadMedidaId] = useState("");
  const [formPresentacionNumerica, setFormPresentacionNumerica] = useState("");
  const [formConversionAUnidadId, setFormConversionAUnidadId] = useState("");
  const [formConversionAUnidadPresentacion, setFormConversionAUnidadPresentacion] =
    useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<EstPorProdPresentacionItem | null>(
    null
  );
  const [borrando, setBorrando] = useState(false);

  const sinUnidades = unidades.length === 0;
  /** Destinos de conversión: `suma = true` y distintas de la unidad medida. */
  const unidadesConversion = useMemo(
    () =>
      unidades.filter(
        (u) =>
          u.id !== formUnidadMedidaId &&
          (u.suma || u.id === formConversionAUnidadId)
      ),
    [unidades, formUnidadMedidaId, formConversionAUnidadId]
  );

  const unidadMedida = useMemo(
    () => unidades.find((u) => u.id === formUnidadMedidaId),
    [unidades, formUnidadMedidaId]
  );
  const unidadConversion = useMemo(
    () => unidades.find((u) => u.id === formConversionAUnidadId),
    [unidades, formConversionAUnidadId]
  );

  const unidadCompletaPreview = useMemo(
    () => previewUnidadCompleta(formPresentacionNumerica, unidadMedida),
    [formPresentacionNumerica, unidadMedida]
  );
  const unidadConvertidaCompletaPreview = useMemo(
    () =>
      previewUnidadCompleta(formConversionAUnidadPresentacion, unidadConversion),
    [formConversionAUnidadPresentacion, unidadConversion]
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res: ActionResult<EstPorProdPresentacionItem[]> =
        await listarEstPorProdPresentacionesAction();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar las presentaciones.");
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
    setFormUnidadMedidaId("");
    setFormPresentacionNumerica("");
    setFormConversionAUnidadId("");
    setFormConversionAUnidadPresentacion("");
    setBorrarTarget(null);
    setUnidadesRecargadas(null);
    setModalUnidadesOpen(false);
    setUnidadesCambiaron(false);
    void cargar();
  }, [open, cargar, itemsIniciales]);

  async function recargarUnidades() {
    const res = await listarEstPorProdUnPresentacionesAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar las unidades.");
      return;
    }
    const ids = new Set(res.data.map((u) => u.id));
    setUnidadesRecargadas(res.data);
    if (!ids.has(formUnidadMedidaId)) setFormUnidadMedidaId("");
    if (!ids.has(formConversionAUnidadId)) setFormConversionAUnidadId("");
  }

  function onChangeModalUnidades(next: boolean) {
    setModalUnidadesOpen(next);
    if (next || !unidadesCambiaron) return;
    setUnidadesCambiaron(false);
    void recargarUnidades();
    void cargar();
    onCatalogoChanged?.();
  }

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [
          item.texto,
          etiquetaPresentacionMedida(item),
          etiquetaPresentacionConversion(item),
        ],
        q
      )
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormUnidadMedidaId("");
    setFormPresentacionNumerica("");
    setFormConversionAUnidadId("");
    setFormConversionAUnidadPresentacion("");
  }

  function abrirCrear() {
    if (!esEditor || pending || sinUnidades) return;
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: EstPorProdPresentacionItem) {
    if (!esEditor || pending || sinUnidades) return;
    setEditingItem(item);
    setFormUnidadMedidaId(item.unidadMedidaId);
    setFormPresentacionNumerica(item.presentacionNumericaTexto);
    setFormConversionAUnidadId(item.conversionAUnidadId ?? "");
    setFormConversionAUnidadPresentacion(
      item.conversionAUnidadPresentacion == null
        ? ""
        : formatoNumeroInput(item.conversionAUnidadPresentacion)
    );
    setFormOpen(true);
  }

  const conversionParcial =
    (formConversionAUnidadId.length > 0) !==
    (formConversionAUnidadPresentacion.trim().length > 0);

  const formValido =
    formUnidadMedidaId.length > 0 &&
    formPresentacionNumerica.trim().length > 0 &&
    !conversionParcial &&
    (formConversionAUnidadId.length === 0 ||
      formConversionAUnidadId !== formUnidadMedidaId);

  function onChangeUnidadMedida(nextId: string) {
    setFormUnidadMedidaId(nextId);
    if (formConversionAUnidadId === nextId) {
      setFormConversionAUnidadId("");
      setFormConversionAUnidadPresentacion("");
    }
  }

  function onChangeConversionUnidad(nextId: string) {
    if (nextId === SIN_CONVERSION) {
      setFormConversionAUnidadId("");
      setFormConversionAUnidadPresentacion("");
      return;
    }
    setFormConversionAUnidadId(nextId);
  }

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    try {
      const conConversion = formConversionAUnidadId.length > 0;
      const payload = {
        unidadMedidaId: formUnidadMedidaId,
        presentacionNumerica: formPresentacionNumerica,
        conversionAUnidadId: conConversion ? formConversionAUnidadId : null,
        conversionAUnidadPresentacion: conConversion
          ? formConversionAUnidadPresentacion
          : null,
      };
      if (editingItem) {
        const res = await editarEstPorProdPresentacionAction({
          id: editingItem.id,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Presentación actualizada.");
      } else {
        const res = await crearEstPorProdPresentacionAction(payload);
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear.");
          return;
        }
        toast.success("Presentación creada.");
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
      const res = await eliminarEstPorProdPresentacionAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Presentación eliminada.");
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
          title="Gestion Presentacion"
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
            {sinUnidades ? (
              <p className="text-xs text-muted-foreground">
                Primero creá al menos una unidad en «Gestion Unidades» para poder agregar
                presentaciones.
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="BUSCAR PRESENTACIÓN..."
                  className="h-10 pl-9"
                  aria-label="Buscar presentación"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar presentación"
                  disabled={pending || sinUnidades}
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
                  {sinUnidades
                    ? "No hay presentaciones. Creá unidades primero y luego usá el botón +."
                    : "No hay presentaciones. Usá el botón + para agregar la primera."}
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguna presentación coincide con la búsqueda.
                </p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium text-foreground">{item.texto}</p>
                        {item.conversionAUnidad ? (
                          <p className="text-xs text-muted-foreground">
                            {`= ${etiquetaPresentacionConversion(item)}`}
                          </p>
                        ) : null}
                      </div>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar ${item.texto}`}
                            disabled={pending || sinUnidades}
                            onClick={() => abrirEditar(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Eliminar ${item.texto}`}
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
          title={editingItem ? "Editar Presentacion" : "Nueva Presentacion"}
          size="sm"
          scrollBody
          hideBodyScrollbars
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
            <section className="flex flex-col gap-3" aria-labelledby="presentacion-form-seccion">
              <ModalMicroLabel
                id="presentacion-form-seccion"
                align="center"
                className="font-bold"
              >
                Presentacion
              </ModalMicroLabel>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Unidad medida</ModalMicroLabel>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={formUnidadMedidaId ?? ""}
                      onValueChange={onChangeUnidadMedida}
                      disabled={pending}
                    >
                      <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Unidad medida">
                        <SelectValue placeholder="SELECCIONAR UNIDAD" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        className="select-content-filtro max-h-60"
                      >
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.unidad}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {esEditor ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={LIST_ROW_ICON_BTN_CLASS}
                      aria-label="Gestionar unidades de medida"
                      title="Gestionar unidades de medida"
                      disabled={pending}
                      onClick={() => setModalUnidadesOpen(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Presentacion numerica</ModalMicroLabel>
                <Input
                  value={formPresentacionNumerica}
                  onChange={(e) => setFormPresentacionNumerica(e.target.value)}
                  placeholder="Ej. 0,44"
                  inputMode="decimal"
                  disabled={pending}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Unidad completa</ModalMicroLabel>
                <Input
                  value={unidadCompletaPreview}
                  readOnly
                  tabIndex={-1}
                  placeholder="Se forma con unidad + número"
                  className={INPUT_READONLY_CLASS}
                  aria-label="Unidad completa"
                />
              </div>
            </section>

            <section
              className="flex flex-col gap-3 border-t border-border pt-4"
              aria-labelledby="conversion-form-seccion"
            >
              <ModalMicroLabel
                id="conversion-form-seccion"
                align="center"
                className="font-bold"
              >
                Conversion
              </ModalMicroLabel>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Convertir a un.</ModalMicroLabel>
                <Select
                  value={formConversionAUnidadId || SIN_CONVERSION}
                  onValueChange={onChangeConversionUnidad}
                  disabled={pending || !formUnidadMedidaId}
                >
                  <SelectTrigger
                    className={SELECT_TRIGGER_CLASS}
                    aria-label="Convertir a un."
                  >
                    <SelectValue placeholder="SIN CONVERSIÓN" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    className="select-content-filtro max-h-60"
                  >
                    <SelectItem value={SIN_CONVERSION}>SIN CONVERSION</SelectItem>
                    {unidadesConversion.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.unidad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Convertir a presentacion.</ModalMicroLabel>
                <Input
                  value={formConversionAUnidadPresentacion}
                  onChange={(e) => setFormConversionAUnidadPresentacion(e.target.value)}
                  placeholder="Ej. 0,44"
                  inputMode="decimal"
                  disabled={pending || !formConversionAUnidadId}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleGuardarForm();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <ModalMicroLabel>Unidad convertida completa</ModalMicroLabel>
                <Input
                  value={unidadConvertidaCompletaPreview}
                  readOnly
                  tabIndex={-1}
                  placeholder="Se forma con unidad + número"
                  className={INPUT_READONLY_CLASS}
                  aria-label="Unidad convertida completa"
                />
              </div>
            </section>
          </div>
        </AppModal>
      </Dialog>

      <Dialog
        open={Boolean(borrarTarget)}
        onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}
      >
        <AppModal
          title="Eliminar Presentacion"
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
            ¿Eliminar la presentación{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.texto}</span>
            {borrarTarget?.conversionAUnidad
              ? ` (= ${etiquetaPresentacionConversion(borrarTarget)})`
              : ""}
            ? Esta acción no se puede deshacer.
          </p>
        </AppModal>
      </Dialog>

      {esEditor ? (
        <GestionarEstPorProdUnPresentacionModal
          open={modalUnidadesOpen}
          onOpenChange={onChangeModalUnidades}
          itemsIniciales={unidades}
          esEditor={esEditor}
          onCatalogoChanged={() => setUnidadesCambiaron(true)}
        />
      ) : null}
    </>
  );
}
