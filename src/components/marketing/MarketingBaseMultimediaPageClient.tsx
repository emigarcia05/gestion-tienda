"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEditarMktContenidoUrlDriveModal from "@/components/marketing/CrearEditarMktContenidoUrlDriveModal";
import GestionarMktContenidoDriveTipoModal from "@/components/marketing/GestionarMktContenidoDriveTipoModal";
import ExportarMktSeccionesGoogleSheetsButton from "@/components/shared/ExportarMktSeccionesGoogleSheetsButton";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { eliminarMktContenidoUrlDriveAction } from "@/actions/mktContenidoUrlDrive";
import type {
  MktContenidoDriveTipoItem,
  MktContenidoUrlDriveItem,
} from "@/lib/mktContenidoUrlDrive";
import { matchByMultiTerm } from "@/lib/busqueda";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
const FILTRO_TODOS = "__todos__";

interface Props {
  items: MktContenidoUrlDriveItem[];
  tipos: MktContenidoDriveTipoItem[];
  esEditor: boolean;
}

export default function MarketingBaseMultimediaPageClient({
  items,
  tipos,
  esEditor,
}: Props) {
  const router = useRouter();
  const [filtroTipoId, setFiltroTipoId] = useState(FILTRO_TODOS);
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });
  const [modalForm, setModalForm] = useState<
    | { open: false }
    | { open: true; modo: "crear" | "editar"; item?: MktContenidoUrlDriveItem }
  >({ open: false });
  const [modalTipos, setModalTipos] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<
    { open: false } | { open: true; id: string; label: string }
  >({ open: false });
  const [deleting, setDeleting] = useState(false);

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (filtroTipoId !== FILTRO_TODOS && item.tipoId !== filtroTipoId) return false;
      if (qDebounced.trim() && !matchByMultiTerm([item.descripcion], qDebounced)) {
        return false;
      }
      return true;
    });
  }, [items, filtroTipoId, qDebounced]);

  function limpiarFiltros() {
    setFiltroTipoId(FILTRO_TODOS);
    setQ("");
    setQDebounced("");
  }

  function refresh() {
    router.refresh();
  }

  async function handleEliminar() {
    if (!modalEliminar.open || deleting) return;
    setDeleting(true);
    try {
      const res = await eliminarMktContenidoUrlDriveAction({ id: modalEliminar.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Registro eliminado.");
      setModalEliminar({ open: false });
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Marketing"
        subtitle="Base Multimedia"
        contentWidth="full"
        actions={
          esEditor ? (
            <div className="flex flex-wrap items-center gap-2">
              <ExportarMktSeccionesGoogleSheetsButton />
              <Button
                type="button"
                variant="default"
                className="h-10 gap-2 px-4"
                onClick={() => setModalTipos(true)}
              >
                <Settings2 className="size-4 shrink-0" aria-hidden />
                Gestionar Tipos
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 gap-2 px-4"
                onClick={() => setModalForm({ open: true, modo: "crear" })}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                Nuevo
              </Button>
            </div>
          ) : undefined
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection className="w-full min-w-0">
              <FilaFiltrosDesplegables>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={filtroTipoId !== FILTRO_TODOS}
                  onLimpiar={() => setFiltroTipoId(FILTRO_TODOS)}
                >
                  <Select value={filtroTipoId} onValueChange={setFiltroTipoId}>
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Tipo"
                    >
                      <SelectValue placeholder="TIPO" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      align="start"
                      className="select-content-filtro max-h-60"
                    >
                      <SelectItem value={FILTRO_TODOS}>TIPO</SelectItem>
                      {tipos.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.tipo.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <div className={FILTER_SELECT_WRAPPER_CLASS} />
                <div className={FILTER_SELECT_WRAPPER_CLASS} />
                <div className={FILTER_SELECT_WRAPPER_CLASS} />
                <div className={FILTER_SELECT_WRAPPER_CLASS} />
              </FilaFiltrosDesplegables>
            </FilterRowSelection>

            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-base-multimedia-descripcion"
                  placeholder="BUSCAR POR DESCRIPCIÓN..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
            </div>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
            <Table variant="compact" className="tabla-gestion-compacta w-full">
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>NOMBRE</TableHead>
                  <TableHead>TIPO</TableHead>
                  <TableHead>DESCRIPCIÓN</TableHead>
                  <TableHead className="tabla-bloque-secundario-head-divider text-center">
                    ACCIONES
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsFiltrados.length === 0 ? (
                  <EmptyTableRow
                    colSpan={4}
                    message={
                      items.length === 0
                        ? "No hay registros. Usá Nuevo para crear el primero."
                        : "No hay registros con los filtros aplicados."
                    }
                  />
                ) : (
                  itemsFiltrados.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium uppercase">{item.nombre}</TableCell>
                      <TableCell className="uppercase">{item.tipoNombre}</TableCell>
                      <TableCell>
                        <span className="line-clamp-2 whitespace-pre-wrap break-words text-sm">
                          {item.descripcion || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="tabla-bloque-secundario-cell-divider">
                        <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            title="Ver"
                            aria-label={`Ver ${item.nombre}`}
                            onClick={() =>
                              window.open(item.url, "_blank", "noopener,noreferrer")
                            }
                          >
                            <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                          {esEditor ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title="Editar"
                                aria-label={`Editar ${item.nombre}`}
                                onClick={() =>
                                  setModalForm({ open: true, modo: "editar", item })
                                }
                              >
                                <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title="Eliminar"
                                aria-label={`Eliminar ${item.nombre}`}
                                onClick={() =>
                                  setModalEliminar({
                                    open: true,
                                    id: item.id,
                                    label: item.nombre,
                                  })
                                }
                              >
                                <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
      </ClassicFilteredTableLayout>

      <CrearEditarMktContenidoUrlDriveModal
        open={modalForm.open}
        onOpenChange={(o) => !o && setModalForm({ open: false })}
        modo={modalForm.open ? modalForm.modo : "crear"}
        item={modalForm.open ? modalForm.item ?? null : null}
        tipos={tipos}
        onSuccess={refresh}
      />

      <GestionarMktContenidoDriveTipoModal
        open={modalTipos}
        onOpenChange={setModalTipos}
        itemsIniciales={tipos}
        esEditor={esEditor}
        onCatalogoChanged={refresh}
      />

      <Dialog
        open={modalEliminar.open}
        onOpenChange={(o) => {
          if (deleting && !o) return;
          if (!o) setModalEliminar({ open: false });
        }}
      >
        <AppModal
          title="Eliminar Contenido"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setModalEliminar({ open: false })}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={deleting} onClick={() => void handleEliminar()}>
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-foreground">
            ¿Eliminar <span className="font-semibold">{modalEliminar.open ? modalEliminar.label : ""}</span>?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
