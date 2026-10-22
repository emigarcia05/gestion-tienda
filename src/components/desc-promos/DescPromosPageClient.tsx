"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import CrearEditarDescPromoModal, {
  type DescPromoOpcionPago,
  type DescPromoOpcionProductoUi,
} from "@/components/desc-promos/CrearEditarDescPromoModal";
import EliminarDescPromoModal from "@/components/desc-promos/EliminarDescPromoModal";
import VerDescPromoModal from "@/components/desc-promos/VerDescPromoModal";
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
import { moverPrioridadDescPromoAction } from "@/actions/descPromo";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  ALCANCES_DESC_PROMO,
  CATEGORIAS_DESC_PROMO,
  ETIQUETA_ALCANCE_DESC_PROMO,
  ETIQUETA_CATEGORIA_DESC_PROMO,
  textoDescuentosDescPromo,
  textoEstadoDescPromo,
  textoVinculosDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type { MarcaCatalogoItem, RubroCatalogoItem } from "@/lib/listaProductos";
import { fmtCelda } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";

const ALCANCE_TODOS = "todos";
const CATEGORIA_TODAS = "todas";

interface Props {
  items: DescPromoFila[];
  productos: DescPromoOpcionProductoUi[];
  pagos: DescPromoOpcionPago[];
  cuotas: CobrosCuotaItem[];
  rubros: RubroCatalogoItem[];
  marcas: MarcaCatalogoItem[];
  /** `YYYY-MM-DD` Argentina (ESTADO de DESC. POR FECHA). */
  hoyIso: string;
  esEditor: boolean;
}

export default function DescPromosPageClient({
  items,
  productos,
  pagos,
  cuotas,
  rubros,
  marcas,
  hoyIso,
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
  const [filtroAlcance, setFiltroAlcance] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [itemEditar, setItemEditar] = useState<DescPromoFila | null>(null);
  const [itemDuplicar, setItemDuplicar] = useState<DescPromoFila | null>(null);
  const [itemVer, setItemVer] = useState<DescPromoFila | null>(null);
  const [itemEliminar, setItemEliminar] = useState<DescPromoFila | null>(null);
  const [openCrear, setOpenCrear] = useState(false);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);

  const maxPrioridad = items.reduce((m, i) => Math.max(m, i.prioridad), 0);

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (filtroCategoria && item.categoria !== filtroCategoria) return false;
      if (filtroAlcance && item.alcance !== filtroAlcance) return false;
      if (!qDebounced.trim()) return true;
      return matchByMultiTerm(
        [
          item.nombre,
          item.categoriaEtiqueta,
          item.alcanceEtiqueta,
          textoDescuentosDescPromo(item),
          textoEstadoDescPromo(item, hoyIso),
          textoVinculosDescPromo(item),
          String(item.prioridad),
        ],
        qDebounced
      );
    });
  }, [items, filtroCategoria, filtroAlcance, qDebounced, hoyIso]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
    setFiltroAlcance("");
    setFiltroCategoria("");
  }

  async function mover(item: DescPromoFila, direccion: "up" | "down") {
    if (moviendoId) return;
    setMoviendoId(item.id);
    const res = await moverPrioridadDescPromoAction({ id: item.id, direccion });
    setMoviendoId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  const colSpan = 8;

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
                setItemVer(null);
                setItemEditar(null);
                setItemDuplicar(null);
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
                  activo={Boolean(filtroCategoria)}
                  onLimpiar={() => setFiltroCategoria("")}
                >
                  <Select
                    value={filtroCategoria || CATEGORIA_TODAS}
                    onValueChange={(v) =>
                      setFiltroCategoria(v === CATEGORIA_TODAS ? "" : v)
                    }
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Categoría"
                    >
                      <SelectValue placeholder="CATEGORÍA" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      <SelectItem value={CATEGORIA_TODAS}>CATEGORÍA</SelectItem>
                      {CATEGORIAS_DESC_PROMO.map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          {ETIQUETA_CATEGORIA_DESC_PROMO[valor]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  className={FILTER_SELECT_WRAPPER_CLASS}
                  activo={Boolean(filtroAlcance)}
                  onLimpiar={() => setFiltroAlcance("")}
                >
                  <Select
                    value={filtroAlcance || ALCANCE_TODOS}
                    onValueChange={(v) =>
                      setFiltroAlcance(v === ALCANCE_TODOS ? "" : v)
                    }
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_FILTER_CLASS}
                      aria-label="Alcance"
                    >
                      <SelectValue placeholder="ALCANCE" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      <SelectItem value={ALCANCE_TODOS}>ALCANCE</SelectItem>
                      {ALCANCES_DESC_PROMO.map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          {ETIQUETA_ALCANCE_DESC_PROMO[valor]}
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
                  placeholder="BUSCAR POR NOMBRE, CATEGORÍA, ALCANCE, DESC., ESTADO O VÍNCULOS..."
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
              <col className="w-[7%]" />
              <col className="w-[17%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[12%]" />
              <col className={esEditor ? "w-[17%]" : "w-[27%]"} />
              <col className={esEditor ? "w-[20%]" : "w-[10%]"} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">PRIORIDAD</TableHead>
                <TableHead>NOMBRE</TableHead>
                <TableHead className="text-center">CATEGORÍA</TableHead>
                <TableHead className="text-center">ALCANCE</TableHead>
                <TableHead className="text-center">DESC.</TableHead>
                <TableHead className="text-center">ESTADO</TableHead>
                <TableHead>VÍNCULOS</TableHead>
                <TableHead className="tabla-bloque-secundario-head-divider text-center">
                  ACCIONES
                </TableHead>
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
                  const estado = textoEstadoDescPromo(item, hoyIso);
                  const bloqueado = moviendoId != null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="celda-datos text-center tabular-nums">
                        {item.prioridad}
                      </TableCell>
                      <TableCell className="celda-datos font-medium uppercase">
                        {item.nombre}
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        {item.categoriaEtiqueta}
                      </TableCell>
                      <TableCell className="celda-datos text-center">
                        {item.alcanceEtiqueta}
                      </TableCell>
                      <TableCell
                        className="celda-datos truncate text-center tabular-nums"
                        title={descuentos}
                      >
                        {fmtCelda(descuentos)}
                      </TableCell>
                      <TableCell
                        className="celda-datos truncate text-center tabular-nums"
                        title={estado}
                      >
                        {fmtCelda(estado)}
                      </TableCell>
                      <TableCell className="celda-datos truncate" title={vinculos}>
                        {fmtCelda(vinculos)}
                      </TableCell>
                      <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                        <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            title="Ver"
                            aria-label={`Ver ${item.nombre}`}
                            disabled={bloqueado}
                            onClick={() => setItemVer(item)}
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
                                title="Subir prioridad"
                                aria-label={`Subir prioridad de ${item.nombre}`}
                                disabled={bloqueado || item.prioridad <= 1}
                                onClick={() => void mover(item, "up")}
                              >
                                <ChevronUp
                                  className={TABLE_ROW_ACTION_ICON_CLASS}
                                  aria-hidden
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title="Bajar prioridad"
                                aria-label={`Bajar prioridad de ${item.nombre}`}
                                disabled={bloqueado || item.prioridad >= maxPrioridad}
                                onClick={() => void mover(item, "down")}
                              >
                                <ChevronDown
                                  className={TABLE_ROW_ACTION_ICON_CLASS}
                                  aria-hidden
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title="Duplicar"
                                aria-label={`Duplicar ${item.nombre}`}
                                disabled={bloqueado}
                                onClick={() => {
                                  setItemVer(null);
                                  setOpenCrear(false);
                                  setItemEditar(null);
                                  setItemDuplicar(item);
                                }}
                              >
                                <Copy
                                  className={TABLE_ROW_ACTION_ICON_CLASS}
                                  aria-hidden
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title="Editar"
                                aria-label={`Editar ${item.nombre}`}
                                disabled={bloqueado}
                                onClick={() => {
                                  setItemVer(null);
                                  setOpenCrear(false);
                                  setItemDuplicar(null);
                                  setItemEditar(item);
                                }}
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
                                disabled={bloqueado}
                                onClick={() => setItemEliminar(item)}
                              >
                                <Trash2
                                  className={TABLE_ROW_ACTION_ICON_CLASS}
                                  aria-hidden
                                />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>
      <CrearEditarDescPromoModal
        key={
          openCrear
            ? "alta"
            : itemDuplicar
              ? `dup-${itemDuplicar.id}`
              : (itemEditar?.id ?? "cerrado")
        }
        open={openCrear || itemEditar != null || itemDuplicar != null}
        item={openCrear ? null : (itemDuplicar ?? itemEditar)}
        duplicar={itemDuplicar != null}
        productos={productos}
        pagos={pagos}
        cuotas={cuotas}
        rubros={rubros}
        marcas={marcas}
        onOpenChange={(open) => {
          if (!open) {
            setItemEditar(null);
            setItemDuplicar(null);
            setOpenCrear(false);
          }
        }}
        onSuccess={() => router.refresh()}
      />
      <VerDescPromoModal
        open={itemVer != null}
        item={itemVer}
        onOpenChange={(open) => {
          if (!open) setItemVer(null);
        }}
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
