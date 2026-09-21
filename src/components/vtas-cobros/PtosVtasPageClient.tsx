"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListOrdered, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { eliminarGlobalPtoVtaAction } from "@/actions/globalPtoVtas";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FilterRowSearch,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import GestionarGlobalPtoVtasModal from "@/components/finanzas/GestionarGlobalPtoVtasModal";
import GestionarTesoreriaTitularesModal from "@/components/vtas-cobros/GestionarTesoreriaTitularesModal";
import ReglasPtosVtasModal from "@/components/vtas-cobros/ReglasPtosVtasModal";
import AppModal from "@/components/shared/AppModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  EmptyTableRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { matchByMultiTerm } from "@/lib/busqueda";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtCelda } from "@/lib/format";
import {
  etiquetaConvMultilateral,
  etiquetaSucursalesPtoVta,
  type GlobalPtoVtaItem,
  type GlobalPtoVtaSucursalOption,
  type PtoVentasCodArcaItem,
} from "@/lib/globalPtoVtas";
import type { TesoreriaTitularItem } from "@/lib/cajasTesoreriaTitulares";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type Props = {
  ptoVtas: GlobalPtoVtaItem[];
  sucursales: GlobalPtoVtaSucursalOption[];
  condicionesArca: PtoVentasCodArcaItem[];
  titulares: TesoreriaTitularItem[];
  esEditor: boolean;
};

export default function PtosVtasPageClient({
  ptoVtas,
  sucursales,
  condicionesArca,
  titulares,
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
  const [formOpen, setFormOpen] = useState(false);
  const [reglasOpen, setReglasOpen] = useState(false);
  const [titularesOpen, setTitularesOpen] = useState(false);
  const [itemEditar, setItemEditar] = useState<GlobalPtoVtaItem | null>(null);
  const [itemBorrar, setItemBorrar] = useState<GlobalPtoVtaItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const itemsFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return ptoVtas;
    return ptoVtas.filter((item) =>
      matchByMultiTerm(
        [
          item.ptoVenta,
          item.titular,
          etiquetaSucursalesPtoVta(item),
          item.cuit ?? "",
          item.iiBb ?? "",
          etiquetaConvMultilateral(item.iiBbMultilateral),
          item.domicilioComercial ?? "",
          item.inicioActividades
            ? formatIsoYmdDdMmYyyyArgentina(item.inicioActividades)
            : "",
        ],
        qDebounced
      )
    );
  }, [ptoVtas, qDebounced]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
  }

  function abrirCrear() {
    setItemEditar(null);
    setFormOpen(true);
  }

  function abrirEditar(item: GlobalPtoVtaItem) {
    setItemEditar(item);
    setFormOpen(true);
  }

  async function confirmarBorrar() {
    if (!itemBorrar || borrando) return;
    setBorrando(true);
    try {
      const res = await eliminarGlobalPtoVtaAction({ id: itemBorrar.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Punto de venta eliminado.");
      setItemBorrar(null);
      router.refresh();
    } finally {
      setBorrando(false);
    }
  }

  const colSpan = esEditor ? 9 : 8;

  return (
    <>
      <ClassicFilteredTableLayout
        title="VTAS. & COBROS"
        subtitle="Ptos. Vtas."
        contentWidth="full"
        actions={
          <div className="flex items-center gap-2">
            <ToolbarActionButton
              type="button"
              icon={<ListOrdered aria-hidden />}
              label="Reglas Ptos. Vtas."
              onClick={() => setReglasOpen(true)}
            />
            {esEditor ? (
              <>
                <ToolbarActionButton
                  type="button"
                  icon={<Users aria-hidden />}
                  label="Gestionar Titulares"
                  onClick={() => setTitularesOpen(true)}
                />
                <ToolbarActionButton
                  type="button"
                  icon={<Plus />}
                  label="Crear Punto De Venta"
                  onClick={abrirCrear}
                />
              </>
            ) : null}
          </div>
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-ptos-vtas-busqueda"
                  placeholder="BUSCAR POR N°, TITULAR, SUC., CUIT, IIBB O DOMICILIO..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {itemsFiltrados.length.toLocaleString("es-AR")} PTO. VTA.
                {itemsFiltrados.length === 1 ? "" : "S"}
              </span>
            </div>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className={esEditor ? "w-[17%]" : "w-[23%]"} />
              <col className="w-[10%]" />
              {esEditor ? <col className="w-[8%]" /> : null}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">N° PUNTO</TableHead>
                <TableHead>TITULAR</TableHead>
                <TableHead>SUC. ASOCIADAS</TableHead>
                <TableHead className="text-center">CUIT</TableHead>
                <TableHead className="text-center">IIBB</TableHead>
                <TableHead className="text-center">CONV. MULT.</TableHead>
                <TableHead>DOM. COMERCIAL</TableHead>
                <TableHead className="text-center">INICIO ACT.</TableHead>
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
                    ptoVtas.length === 0
                      ? "NO HAY PUNTOS DE VENTA."
                      : "NO HAY PUNTOS DE VENTA CON LOS FILTROS APLICADOS."
                  }
                />
              ) : (
                itemsFiltrados.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="celda-datos text-center tabular-nums font-medium">
                      {item.ptoVenta}
                    </TableCell>
                    <TableCell className="celda-datos uppercase">
                      {item.titular}
                    </TableCell>
                    <TableCell className="celda-datos uppercase">
                      {fmtCelda(etiquetaSucursalesPtoVta(item))}
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {fmtCelda(item.cuit)}
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {fmtCelda(item.iiBb)}
                    </TableCell>
                    <TableCell className="celda-datos text-center">
                      {etiquetaConvMultilateral(item.iiBbMultilateral)}
                    </TableCell>
                    <TableCell className="celda-datos uppercase">
                      {fmtCelda(item.domicilioComercial)}
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {item.inicioActividades
                        ? formatIsoYmdDdMmYyyyArgentina(item.inicioActividades)
                        : ""}
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
                            aria-label={`Editar ${item.ptoVenta} ${item.titular}`}
                            onClick={() => abrirEditar(item)}
                          >
                            <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            title="Eliminar"
                            aria-label={`Eliminar ${item.ptoVenta} ${item.titular}`}
                            onClick={() => setItemBorrar(item)}
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

      <GestionarGlobalPtoVtasModal
        open={formOpen}
        onOpenChange={setFormOpen}
        itemEditar={itemEditar}
        sucursales={sucursales}
        condicionesArca={condicionesArca}
        titulares={titulares}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />

      <ReglasPtosVtasModal open={reglasOpen} onOpenChange={setReglasOpen} />

      <GestionarTesoreriaTitularesModal
        open={titularesOpen}
        onOpenChange={setTitularesOpen}
        esEditor={esEditor}
        onCatalogoChanged={() => router.refresh()}
      />

      <Dialog
        open={Boolean(itemBorrar)}
        onOpenChange={(o) => !o && !borrando && setItemBorrar(null)}
      >
        <AppModal
          title="ELIMINAR PUNTO DE VENTA"
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={borrando}
                onClick={() => setItemBorrar(null)}
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
            ¿Eliminar el punto de venta{" "}
            <span className="font-semibold text-foreground">
              {itemBorrar?.ptoVenta} · {itemBorrar?.titular}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
