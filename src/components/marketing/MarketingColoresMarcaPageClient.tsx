"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEditarMktColorMarcaModal from "@/components/marketing/CrearEditarMktColorMarcaModal";
import ExportarMktSeccionesGoogleSheetsButton from "@/components/shared/ExportarMktSeccionesGoogleSheetsButton";
import FilterBar, {
  FilterRowSearch,
  LimpiarFiltrosButton,
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
import { Dialog } from "@/components/ui/dialog";
import AppModal from "@/components/shared/AppModal";
import { eliminarMktColorMarcaAction } from "@/actions/mktColoresMarca";
import type { MktColorMarcaItem } from "@/lib/mktColoresMarca";
import { matchByMultiTerm } from "@/lib/busqueda";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
interface Props {
  items: MktColorMarcaItem[];
  esEditor: boolean;
}

function MktColorMarcaSwatches({ codes }: { codes: string[] }) {
  if (codes.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {codes.map((hex) => (
        <span
          key={hex}
          className="inline-flex min-w-0 items-center gap-1.5 rounded border border-border bg-card px-1.5 py-0.5 text-xs font-mono tabular-nums"
          title={hex}
        >
          <span
            className="size-4 shrink-0 rounded-sm border border-border"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
          {hex}
        </span>
      ))}
    </div>
  );
}

export default function MarketingColoresMarcaPageClient({ items, esEditor }: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });
  const [modalForm, setModalForm] = useState<
    | { open: false }
    | { open: true; modo: "crear" | "editar"; item?: MktColorMarcaItem }
  >({ open: false });
  const [modalEliminar, setModalEliminar] = useState<
    { open: false } | { open: true; id: string; label: string }
  >({ open: false });
  const [deleting, setDeleting] = useState(false);

  const itemsFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return items;
    return items.filter(
      (item) =>
        matchByMultiTerm(
          [item.nombre, item.descripcion, item.codHexadecimales.join(" ")],
          qDebounced
        )
    );
  }, [items, qDebounced]);

  function limpiarFiltros() {
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
      const res = await eliminarMktColorMarcaAction({ id: modalEliminar.id });
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
        subtitle="Colores Marca"
        contentWidth="full"
        actions={
          esEditor ? (
            <div className="flex flex-wrap items-center gap-2">
              <ExportarMktSeccionesGoogleSheetsButton />
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
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-colores-marca-busqueda"
                  placeholder="BUSCAR POR NOMBRE, DESCRIPCIÓN O CÓD. HEX..."
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
                <TableHead className="text-center">CÓD. HEX.</TableHead>
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
                      <TableCell className="text-center">
                        <MktColorMarcaSwatches codes={item.codHexadecimales} />
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-2 whitespace-pre-wrap break-words text-sm">
                          {item.descripcion || "—"}
                        </span>
                      </TableCell>
                    <TableCell className="tabla-bloque-secundario-cell-divider">
                      {esEditor ? (
                        <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
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
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>

      <CrearEditarMktColorMarcaModal
        open={modalForm.open}
        onOpenChange={(o) => !o && setModalForm({ open: false })}
        modo={modalForm.open ? modalForm.modo : "crear"}
        item={modalForm.open ? modalForm.item ?? null : null}
        onSuccess={refresh}
      />

      <Dialog
        open={modalEliminar.open}
        onOpenChange={(o) => {
          if (deleting && !o) return;
          if (!o) setModalEliminar({ open: false });
        }}
      >
        <AppModal
          title="Eliminar Color Marca"
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
            ¿Eliminar{" "}
            <span className="font-semibold">
              {modalEliminar.open ? modalEliminar.label : ""}
            </span>
            ?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
