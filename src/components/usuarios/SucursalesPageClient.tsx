"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FilterBar, { FilterRowSearch, LimpiarFiltrosButton } from "@/components/FilterBar";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import EditarSucursalModal from "@/components/usuarios/EditarSucursalModal";
import EliminarSucursalModal from "@/components/usuarios/EliminarSucursalModal";
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
import type { SucursalCatalogoItem } from "@/services/sucursalesCatalogo.service";
import { matchByMultiTerm } from "@/lib/busqueda";
import { fmtCelda } from "@/lib/format";
import { textoHorarioSucursal } from "@/lib/horarioSucursal";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";

interface Props {
  items: SucursalCatalogoItem[];
  esEditor: boolean;
}

export default function SucursalesPageClient({ items, esEditor }: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });
  const [itemEditar, setItemEditar] = useState<SucursalCatalogoItem | null>(null);
  const [itemEliminar, setItemEliminar] = useState<SucursalCatalogoItem | null>(null);

  const itemsFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [item.nombre, item.direccion ?? "", item.telefono ?? "", textoHorarioSucursal(item.horario)],
        qDebounced
      )
    );
  }, [items, qDebounced]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
  }

  const colSpan = esEditor ? 5 : 4;

  return (
    <>
      <ClassicFilteredTableLayout
        title="Administrador"
        subtitle="Sucursales"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-sucursales-busqueda"
                  placeholder="BUSCAR POR NOMBRE, DIRECCIÓN, TELÉFONO O HORARIO..."
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
              <col className="w-[18%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col />
              {esEditor ? <col className="w-[12%]" /> : null}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>NOMBRE</TableHead>
                <TableHead>DIRECCIÓN</TableHead>
                <TableHead>TELÉFONO</TableHead>
                <TableHead>HORARIO</TableHead>
                {esEditor ? (
                  <TableHead className="tabla-bloque-secundario-head-divider text-center">
                    ACCIONES
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsFiltrados.length === 0 ? (
                <EmptyTableRow
                  colSpan={colSpan}
                  message={
                    items.length === 0
                      ? "NO HAY SUCURSALES."
                      : "NO HAY SUCURSALES CON LOS FILTROS APLICADOS."
                  }
                />
              ) : (
                itemsFiltrados.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="celda-datos font-medium uppercase">
                      {item.nombre}
                    </TableCell>
                    <TableCell className="celda-datos">{fmtCelda(item.direccion)}</TableCell>
                    <TableCell className="celda-datos">{fmtCelda(item.telefono)}</TableCell>
                    <TableCell className="celda-datos celda-datos--crece">
                      {textoHorarioSucursal(item.horario)}
                    </TableCell>
                    {esEditor ? (
                      <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                        <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            title="Editar"
                            aria-label={`Editar ${item.nombre}`}
                            onClick={() => setItemEditar(item)}
                          >
                            <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            title="Borrar"
                            aria-label={`Borrar ${item.nombre}`}
                            onClick={() => setItemEliminar(item)}
                          >
                            <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>
      <EditarSucursalModal
        open={itemEditar != null}
        item={itemEditar}
        onOpenChange={(open) => {
          if (!open) setItemEditar(null);
        }}
        onSuccess={() => router.refresh()}
      />
      <EliminarSucursalModal
        open={itemEliminar != null}
        item={itemEliminar}
        onOpenChange={(open) => {
          if (!open) setItemEliminar(null);
        }}
        onDeleted={() => router.refresh()}
      />
    </>
  );
}
