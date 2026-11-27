"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FiltroIndividualContainer } from "@/components/FilterBar";
import { leerPdfComprobante } from "@/components/envios/leerPdfComprobante";
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
  /** Desde el «+» del producto: abre solo NUEVA FAMILIA. */
  soloCrear?: boolean;
  onCreado?: (id: string) => void;
}

export default function GestionarFamiliasModal({
  open,
  onOpenChange,
  esEditor,
  onCatalogoChanged,
  soloCrear = false,
  onCreado,
}: Props) {
  const [items, setItems] = useState<FamiliaCatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FamiliaCatalogoItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [pdfAdjunto, setPdfAdjunto] = useState<{ nombre: string; base64: string } | null>(null);
  const [quitarPdf, setQuitarPdf] = useState(false);
  const [fichaFiltro, setFichaFiltro] = useState<"" | "si" | "no">("");
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
    setFichaFiltro("");
    setEditing(null);
    setFormNombre("");
    setFormUrl("");
    setPdfAdjunto(null);
    setQuitarPdf(false);
    setBorrarTarget(null);
    if (soloCrear) return;
    setFormOpen(false);
    void cargar();
  }, [open, cargar, soloCrear]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return items;
    return items.filter((familia) => {
      if (fichaFiltro === "si" && !familia.tieneFicha) return false;
      if (fichaFiltro === "no" && familia.tieneFicha) return false;
      if (!q) return true;
      return matchByMultiTerm([familia.nombre, ...familia.descripciones], q);
    });
  }, [items, busqueda, fichaFiltro]);

  const puedeGuardar = esEditor && formNombre.trim().length > 0 && !pending;

  function abrirForm(item: FamiliaCatalogoItem | null) {
    if (!esEditor || pending) return;
    setEditing(item);
    setFormNombre(item?.nombre ?? "");
    setFormUrl(item?.url ?? "");
    setPdfAdjunto(null);
    setQuitarPdf(false);
    setFormOpen(true);
  }

  async function guardar() {
    if (!puedeGuardar) return;
    setPending(true);
    try {
      const res = editing
        ? await editarFamiliaAction({
            id: editing.id,
            nombre: formNombre,
            url: formUrl,
            quitarPdf,
            ...(pdfAdjunto ? { pdf: pdfAdjunto } : {}),
          })
        : await crearFamiliaAction({ nombre: formNombre });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Familia actualizada." : "Familia creada.");
      if (soloCrear && !editing) {
        onCreado?.(res.data.id);
        onOpenChange(false);
        return;
      }
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
        open={soloCrear ? false : open}
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
              <FiltroIndividualContainer
                className="w-44 max-w-44 shrink-0 flex-none"
                activo={Boolean(fichaFiltro)}
                onLimpiar={() => setFichaFiltro("")}
              >
                <Select
                  value={fichaFiltro}
                  onValueChange={(valor) => setFichaFiltro(valor === "si" || valor === "no" ? valor : "")}
                >
                  <SelectTrigger id="filtro-familia-ficha" className="input-filtro-unificado">
                    <SelectValue placeholder="FICHA TECNICA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">NO</SelectItem>
                    <SelectItem value="si">SI</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
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
        open={soloCrear ? open : formOpen}
        onOpenChange={(next) => {
          if (pending || itemsAbiertos) return;
          if (!next) setItemsAbiertos(false);
          setFormOpen(next);
          if (!next && soloCrear) onOpenChange(false);
        }}
      >
        <AppModal
          title={editing ? "EDITAR FAMILIA" : "NUEVA FAMILIA"}
          size="md"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setFormOpen(false);
                  if (soloCrear) onOpenChange(false);
                }}
              >
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
              <>
                <div className="flex flex-col gap-1">
                  <ModalMicroLabel>URL</ModalMicroLabel>
                  <Input
                    value={formUrl}
                    maxLength={2048}
                    disabled={pending}
                    placeholder="https://"
                    aria-label="URL de la ficha técnica"
                    onChange={(e) => setFormUrl(e.target.value.trimStart())}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <ModalMicroLabel>PDF</ModalMicroLabel>
                  {pdfAdjunto ? (
                    <p className="text-sm text-foreground">{pdfAdjunto.nombre}</p>
                  ) : editing.pdfNombre && !quitarPdf ? (
                    <a
                      href={`/api/familias/${editing.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      {editing.pdfNombre}
                    </a>
                  ) : null}
                  <label
                    className={cn(
                      "border-input bg-transparent text-foreground shadow-xs",
                      "hover:bg-muted/40 flex h-9 w-full min-w-0 cursor-pointer items-center justify-center rounded-md border px-3 py-1 text-sm font-medium",
                      "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                      pending && "pointer-events-none cursor-not-allowed opacity-50"
                    )}
                  >
                    <Input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={pending}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void leerPdfComprobante(file).then((pdf) => {
                          if (!pdf) return;
                          setPdfAdjunto(pdf);
                          setQuitarPdf(false);
                        });
                      }}
                    />
                    Adjuntar PDF
                  </label>
                  {editing.pdfNombre && !quitarPdf && !pdfAdjunto ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setQuitarPdf(true);
                        setPdfAdjunto(null);
                      }}
                    >
                      Quitar PDF
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
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
