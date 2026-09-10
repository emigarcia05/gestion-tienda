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
  crearFinAnaCosFinaTerminalAction,
  editarFinAnaCosFinaTerminalAction,
  eliminarFinAnaCosFinaTerminalAction,
  listarFinAnaCosFinaTerminalesAction,
} from "@/actions/finAnaCosFina";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  etiquetaTitularPtoVta,
  type FinAnaCosFinaTerminalItem,
} from "@/lib/finAnaCosFinaTerminales";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import type { GlobalPtoVtaItem } from "@/lib/globalPtoVtas";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalesIniciales: FinAnaCosFinaTerminalItem[];
  marcas: FinAnaCosFinaTerminalMarcaItem[];
  ptoVtas: GlobalPtoVtaItem[];
  esEditor: boolean;
  onCatalogoChanged?: () => void;
}

const LIST_ROW_ICON_BTN_CLASS = cn(
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  "h-9 w-9 min-h-9 max-h-9"
);

const SELECT_TRIGGER_CLASS = "input-filtro-unificado h-9 w-full text-xs font-semibold";

export default function GestionarTerminalesFinAnaCosFinaModal({
  open,
  onOpenChange,
  terminalesIniciales,
  marcas,
  ptoVtas,
  esEditor,
  onCatalogoChanged,
}: Props) {
  const [items, setItems] = useState<FinAnaCosFinaTerminalItem[]>(terminalesIniciales);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinAnaCosFinaTerminalItem | null>(null);
  const [formIdDux, setFormIdDux] = useState("");
  const [formMarcaId, setFormMarcaId] = useState("");
  const [formTitularId, setFormTitularId] = useState("");
  const [pending, setPending] = useState(false);
  const [borrarTarget, setBorrarTarget] = useState<FinAnaCosFinaTerminalItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarFinAnaCosFinaTerminalesAction();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar las terminales.");
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
    setItems(terminalesIniciales);
    setBusqueda("");
    setFormOpen(false);
    setEditingItem(null);
    setFormIdDux("");
    setFormMarcaId("");
    setFormTitularId("");
    setBorrarTarget(null);
    void cargar();
  }, [open, cargar, terminalesIniciales]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [
          item.idDux,
          item.marcaNombre,
          etiquetaTitularPtoVta(item.titularPtoVenta, item.titularNombre),
        ],
        q
      )
    );
  }, [items, busqueda]);

  function resetForm() {
    setEditingItem(null);
    setFormIdDux("");
    setFormMarcaId("");
    setFormTitularId("");
  }

  function abrirCrear() {
    if (!esEditor || pending) return;
    resetForm();
    setFormOpen(true);
  }

  function abrirEditar(item: FinAnaCosFinaTerminalItem) {
    if (!esEditor || pending) return;
    setEditingItem(item);
    setFormIdDux(item.idDux);
    setFormMarcaId(item.marcaId);
    setFormTitularId(item.titularId);
    setFormOpen(true);
  }

  const formValido =
    formIdDux.trim().length > 0 && formMarcaId.length > 0 && formTitularId.length > 0;

  async function handleGuardarForm() {
    if (!esEditor || !formValido || pending) return;
    setPending(true);
    try {
      const payload = {
        idDux: formIdDux,
        marcaId: formMarcaId,
        titularId: formTitularId,
      };
      if (editingItem) {
        const res = await editarFinAnaCosFinaTerminalAction({
          id: editingItem.id,
          ...payload,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Terminal actualizada.");
      } else {
        const res = await crearFinAnaCosFinaTerminalAction(payload);
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear la terminal.");
          return;
        }
        toast.success("Terminal creada.");
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
      const res = await eliminarFinAnaCosFinaTerminalAction({ id: borrarTarget.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Terminal eliminada.");
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
          title="GESTIONAR TERMINALES"
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
                  placeholder="BUSCAR TERMINAL..."
                  className="h-10 pl-9"
                  aria-label="Buscar terminal"
                />
              </div>
              {esEditor ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Agregar terminal"
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
                  No hay terminales. Usá el botón + para agregar la primera.
                </p>
              ) : listaFiltrada.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguna terminal coincide con la búsqueda.</p>
              ) : (
                <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                  {listaFiltrada.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-medium tabular-nums text-foreground">{item.idDux}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {item.marcaNombre} ·{" "}
                          {etiquetaTitularPtoVta(item.titularPtoVenta, item.titularNombre)}
                        </p>
                      </div>
                      {esEditor ? (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={LIST_ROW_ICON_BTN_CLASS}
                            aria-label={`Editar terminal ${item.idDux}`}
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
                            aria-label={`Eliminar terminal ${item.idDux}`}
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
          title={editingItem ? "EDITAR TERMINAL" : "NUEVA TERMINAL"}
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
              <ModalMicroLabel>ID DUX</ModalMicroLabel>
              <Input
                value={formIdDux}
                onChange={(e) => setFormIdDux(e.target.value.replace(/\D/g, ""))}
                placeholder="ID DUX"
                inputMode="numeric"
                disabled={pending}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Marca</ModalMicroLabel>
              <Select
                value={formMarcaId || undefined}
                onValueChange={setFormMarcaId}
                disabled={pending || marcas.length === 0}
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Marca">
                  <SelectValue placeholder="MARCA" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {marcas.map((marca) => (
                    <SelectItem key={marca.id} value={marca.id}>
                      {marca.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <ModalMicroLabel>Titular</ModalMicroLabel>
              <Select
                value={formTitularId || undefined}
                onValueChange={setFormTitularId}
                disabled={pending || ptoVtas.length === 0}
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Titular">
                  <SelectValue placeholder="TITULAR" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {ptoVtas.map((pto) => (
                    <SelectItem key={pto.id} value={pto.id}>
                      {etiquetaTitularPtoVta(pto.ptoVenta, pto.nombreTitular)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </AppModal>
      </Dialog>

      <Dialog open={Boolean(borrarTarget)} onOpenChange={(o) => !o && !borrando && setBorrarTarget(null)}>
        <AppModal
          title="ELIMINAR TERMINAL"
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
            ¿Eliminar la terminal{" "}
            <span className="font-semibold text-foreground">{borrarTarget?.idDux}</span>? Esta acción no se
            puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
