"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import CrearEditarDescPromoModal, {
  type DescPromoOpcionPago,
  type DescPromoOpcionProductoUi,
} from "@/components/desc-promos/CrearEditarDescPromoModal";
import EliminarDescPromoModal from "@/components/desc-promos/EliminarDescPromoModal";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  ETIQUETA_TIPO_DESC_PROMO,
  TIPOS_DESC_PROMO,
  textoDescuentosDescPromo,
  textoVinculosDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";
import { fmtCelda } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";

const TIPO_TODOS = "todos";

interface Props {
  items: DescPromoFila[];
  productos: DescPromoOpcionProductoUi[];
  pagos: DescPromoOpcionPago[];
  rubros: RubroCatalogoItem[];
  marcas: MarcaCatalogoItem[];
  esEditor: boolean;
}

export default function DescPromosPageClient({
  items,
  productos,
  pagos,
  rubros,
  marcas,
  esEditor,
}: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } =
    useFiltrosConBusqueda({
      qActual: qDebounced,
      debounceMs: 300,
      onDebouncedSearch: setQDebounced,
    });
  const [filtroTipo, setFiltroTipo] = useState("");
  const [itemEditar, setItemEditar] = useState<DescPromoFila | null>(null);
  const [itemEliminar, setItemEliminar] = useState<DescPromoFila | null>(null);
  const [openCrear, setOpenCrear] = useState(false);

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (filtroTipo && item.tipo !== filtroTipo) return false;
      if (!qDebounced.trim()) return true;
      return matchByMultiTerm(
        [
          item.nombre,
          item.tipoEtiqueta,
          textoDescuentosDescPromo(item),
          textoVinculosDescPromo(item),
        ],
        qDebounced
      );
    });
  }, [items, filtroTipo, qDebounced]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
    setFiltroTipo("");
  }

  const colSpan = esEditor ? 5 : 4;

  return (
    <>
      <ClassicFilteredTableLayout
        title="Administrador"
        subtitle="Descuentos"
        contentWidth="full"
        actions={
          esEditor ? (
            <ToolbarActionButton
              type="button"
              icon={<Plus />}
              label="Nuevo Descuento"
              onClick={() => {
                setItemEditar(null);
                setOpenCrear(true);
              }}
            />
          ) : null
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilterRowSelection>
              <FilaFiltrosDesplegables columnas={5}>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroTipo)}
                  onLimpiar={() => setFiltroTipo("")}
                >
                  <Select
                    value={filtroTipo || TIPO_TODOS}
                    onValueChange={(v) =>
                      setFiltroTipo(v === TIPO_TODOS ? "" : v)
                    }
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Tipo"
                    >
                      <SelectValue placeholder="TIPO" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      <SelectItem value={TIPO_TODOS}>TIPO</SelectItem>
                      {TIPOS_DESC_PROMO.map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          {ETIQUETA_TIPO_DESC_PROMO[valor]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              </FilaFiltrosDesplegables>
            </FilterRowSelection>
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-desc-promos-busqueda"
                  placeholder="BUSCAR POR NOMBRE, TIPO, DESC. O VÍNCULOS..."
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
              <col className="w-[28%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className={esEditor ? "w-[34%]" : "w-[46%]"} />
              {esEditor ? <col className="w-[12%]" /> : null}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>NOMBRE</TableHead>
                <TableHead className="text-center">TIPO</TableHead>
                <TableHead className="text-center">DESC.</TableHead>
                <TableHead>VÍNCULOS</TableHead>
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
                      ? "NO HAY DESCUENTOS."
                      : "NO HAY DESCUENTOS CON LOS FILTROS APLICADOS."
                  }
                />
              ) : (
                itemsFiltrados.map((item) => {
                  const vinculos = textoVinculosDescPromo(item);
                  const descuentos = textoDescuentosDescPromo(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="celda-datos font-medium uppercase">
                        {item.nombre}
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        {item.tipoEtiqueta}
                      </TableCell>
                      <TableCell
                        className="celda-datos truncate text-center tabular-nums"
                        title={descuentos}
                      >
                        {fmtCelda(descuentos)}
                      </TableCell>
                      <TableCell className="celda-datos truncate" title={vinculos}>
                        {fmtCelda(vinculos)}
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
                              <Pencil
                                className={TABLE_ROW_ACTION_ICON_CLASS}
                                aria-hidden
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              title="Eliminar"
                              aria-label={`Eliminar ${item.nombre}`}
                              onClick={() => setItemEliminar(item)}
                            >
                              <Trash2
                                className={TABLE_ROW_ACTION_ICON_CLASS}
                                aria-hidden
                              />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>
      <CrearEditarDescPromoModal
        open={openCrear || itemEditar != null}
        item={openCrear ? null : itemEditar}
        productos={productos}
        pagos={pagos}
        rubros={rubros}
        marcas={marcas}
        onOpenChange={(open) => {
          if (!open) {
            setItemEditar(null);
            setOpenCrear(false);
          }
        }}
        onSuccess={() => router.refresh()}
      />
      <EliminarDescPromoModal
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
