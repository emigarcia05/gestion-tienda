"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import EditarUsuarioModal from "@/components/usuarios/EditarUsuarioModal";
import FilterBar, {
  FILTER_COUNT_CLASS,
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
import type { GlobalPersonalItem } from "@/services/globalPersonal.service";
import { matchByMultiTerm } from "@/lib/busqueda";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  etiquetaModulosPermitidos,
  etiquetaSucursalPorDefecto,
} from "@/lib/usuarios";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface Props {
  items: GlobalPersonalItem[];
  esEditor: boolean;
}

export default function UsuariosPageClient({ items, esEditor }: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } =
    useFiltrosConBusqueda({
      qActual: qDebounced,
      debounceMs: 300,
      onDebouncedSearch: setQDebounced,
    });
  const [itemEditar, setItemEditar] = useState<GlobalPersonalItem | null>(null);

  const itemsFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [
          item.nombrePersonal,
          etiquetaSucursalPorDefecto(item.sucursalPorDefecto),
          etiquetaModulosPermitidos(item.modulosPermitidos),
          item.titularFinanciero ? "TITULAR FINANCIERO SI" : "NO",
        ],
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
        title="Administración"
        subtitle="Usuarios"
        contentWidth="full"
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-usuarios-busqueda"
                  placeholder="BUSCAR POR NOMBRE, SUCURSAL, MÓDULO O TITULAR..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {itemsFiltrados.length.toLocaleString("es-AR")} USUARIO
                {itemsFiltrados.length === 1 ? "" : "S"}
              </span>
            </div>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className={esEditor ? "w-[28%]" : "w-[36%]"} />
              <col className="w-[16%]" />
              {esEditor ? <col className="w-[10%]" /> : null}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>NOMBRE</TableHead>
                <TableHead className="text-center">SUCURSAL POR DEFECTO</TableHead>
                <TableHead>MÓDULOS PERMITIDOS</TableHead>
                <TableHead className="text-center">TITULAR FINANCIERO</TableHead>
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
                      ? "NO HAY USUARIOS."
                      : "NO HAY USUARIOS CON LOS FILTROS APLICADOS."
                  }
                />
              ) : (
                itemsFiltrados.map((item) => (
                  <TableRow key={item.idPersonal}>
                    <TableCell className="celda-datos font-medium uppercase">
                      {item.nombrePersonal}
                    </TableCell>
                    <TableCell className="celda-datos text-center">
                      {etiquetaSucursalPorDefecto(item.sucursalPorDefecto)}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {etiquetaModulosPermitidos(item.modulosPermitidos)}
                    </TableCell>
                    <TableCell className="celda-datos text-center">
                      {item.titularFinanciero ? "SI" : "NO"}
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
                            aria-label={`Editar ${item.nombrePersonal}`}
                            onClick={() => setItemEditar(item)}
                          >
                            <Pencil
                              className={TABLE_ROW_ACTION_ICON_CLASS}
                              aria-hidden
                            />
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
      <EditarUsuarioModal
        open={itemEditar != null}
        item={itemEditar}
        onOpenChange={(open) => {
          if (!open) setItemEditar(null);
        }}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
