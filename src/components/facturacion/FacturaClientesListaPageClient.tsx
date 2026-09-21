"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { eliminarClienteAction, eliminarEnviosDireccionAction } from "@/actions/envios";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FilterRowSearch,
  LimpiarFiltrosButton,
} from "@/components/FilterBar";
import CrearEditarClienteModal from "@/components/envios/CrearEditarClienteModal";
import CrearEditarEnviosDireccionModal from "@/components/envios/CrearEditarEnviosDireccionModal";
import FacturaClienteAsociadosDetalle from "@/components/facturacion/FacturaClienteAsociadosDetalle";
import FacturaClienteProyectosDetalle from "@/components/facturacion/FacturaClienteProyectosDetalle";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import AppModal from "@/components/shared/AppModal";
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
import {
  etiquetaClienteListado,
  etiquetaNombreProyecto,
  etiquetaTipoCliente,
  formatearCuitMascara,
  nombrePintorAsociadoCliente,
  type ClienteListaItem,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { etiquetaCondicionIvaArca, type PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const COL_SPAN = 9;

type ModalCliente = { open: false } | { open: true; modo: "crear" | "editar"; item: ClienteListaItem | null };
type ModalProyecto =
  | { open: false }
  | { open: true; modo: "crear" | "editar"; personaId: string; item: EnviosDireccionItem | null };
type ModalEliminar =
  | { open: false }
  | { open: true; kind: "cliente"; id: string; label: string }
  | { open: true; kind: "proyecto"; id: string; label: string };

interface Props {
  items: ClienteListaItem[];
  condicionesIva: PtoVentasCodArcaItem[];
}

function etiquetaCondicionIvaCliente(
  codigo: number | null,
  catalogo: readonly PtoVentasCodArcaItem[]
): string {
  if (codigo == null) return "";
  const row = catalogo.find((c) => c.codigo === codigo);
  return row ? etiquetaCondicionIvaArca(row.descripcion) : String(codigo);
}

export default function FacturaClientesListaPageClient({ items, condicionesIva }: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });
  const [expanded, setExpanded] = useState<{
    id: string;
    kind: "proyectos" | "asociados";
  } | null>(null);
  const [modalCliente, setModalCliente] = useState<ModalCliente>({ open: false });
  const [modalProyecto, setModalProyecto] = useState<ModalProyecto>({ open: false });
  const [modalEliminar, setModalEliminar] = useState<ModalEliminar>({ open: false });
  const [deleting, setDeleting] = useState(false);

  const pintores = useMemo(
    () => items.filter((item) => item.tipo === "PINTOR"),
    [items]
  );
  const direcciones = useMemo(
    () => items.flatMap((item) => item.proyectos),
    [items]
  );

  const itemsFiltrados = useMemo(() => {
    if (!qDebounced.trim()) return items;
    return items.filter((item) =>
      matchByMultiTerm(
        [
          etiquetaClienteListado(item),
          etiquetaTipoCliente(item.tipo),
          item.cuit ?? "",
          item.cuit ? formatearCuitMascara(item.cuit) : "",
          item.cel,
          nombrePintorAsociadoCliente(item) ?? "",
          item.ctaCorrientePlazo != null ? String(item.ctaCorrientePlazo) : "",
          item.ctaCorrienteMontoMax != null ? String(item.ctaCorrienteMontoMax) : "",
          etiquetaCondicionIvaCliente(item.condicionIva, condicionesIva),
          ...item.proyectos.map((p) => etiquetaNombreProyecto(p)),
        ],
        qDebounced,
        { numericAsContains: true }
      )
    );
  }, [items, qDebounced, condicionesIva]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
  }

  async function handleEliminar() {
    if (!modalEliminar.open || deleting) return;
    setDeleting(true);
    try {
      const res =
        modalEliminar.kind === "cliente"
          ? await eliminarClienteAction({ id: modalEliminar.id })
          : await eliminarEnviosDireccionAction({ id: modalEliminar.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success(modalEliminar.kind === "cliente" ? "Cliente eliminado." : "Proyecto eliminado.");
      if (modalEliminar.kind === "cliente" && expanded?.id === modalEliminar.id) {
        setExpanded(null);
      }
      setModalEliminar({ open: false });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Clientes"
        subtitle="Lista Clientes"
        contentWidth="full"
        actions={
          <ToolbarActionButton
            type="button"
            icon={<Plus />}
            label="Crear Cliente"
            onClick={() => setModalCliente({ open: true, modo: "crear", item: null })}
          />
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-clientes-lista-busqueda"
                  placeholder="BUSCAR POR NOMBRE, CUIT, CEL, TIPO O PROYECTO..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {itemsFiltrados.length.toLocaleString("es-AR")} CLIENTE
                {itemsFiltrados.length === 1 ? "" : "S"}
              </span>
            </div>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>CLIENTE</TableHead>
                <TableHead className="text-center">TIPO</TableHead>
                <TableHead className="text-center">CUIT</TableHead>
                <TableHead>COND. IVA</TableHead>
                <TableHead className="text-center">CEL</TableHead>
                <TableHead>PINTOR</TableHead>
                <TableHead className="text-center">PLAZO CTA. CTE.</TableHead>
                <TableHead className="text-right">MONTO MÁX. CTA. CTE.</TableHead>
                <TableHead className="tabla-bloque-secundario-head-divider text-center">
                  ACCIONES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsFiltrados.length === 0 ? (
                <EmptyTableRow
                  colSpan={COL_SPAN}
                  message={
                    items.length === 0
                      ? "NO HAY CLIENTES."
                      : "NO HAY CLIENTES CON LOS FILTROS APLICADOS."
                  }
                />
              ) : (
                itemsFiltrados.map((item) => {
                  const tieneVariosProyectos = item.proyectos.length > 1;
                  const esPintor = item.tipo === "PINTOR";
                  const expandidoProyectos =
                    tieneVariosProyectos &&
                    expanded?.id === item.id &&
                    expanded.kind === "proyectos";
                  const expandidoAsociados =
                    esPintor && expanded?.id === item.id && expanded.kind === "asociados";
                  const asociados = esPintor
                    ? items.filter((c) => c.pintorAsociadoId === item.id)
                    : [];
                  const nombre = etiquetaClienteListado(item);
                  return (
                    <Fragment key={item.id}>
                      <TableRow>
                        <TableCell className="celda-datos font-medium uppercase">
                          {nombre}
                        </TableCell>
                        <TableCell className="celda-datos text-center">
                          {etiquetaTipoCliente(item.tipo)}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {item.cuit ? formatearCuitMascara(item.cuit) : fmtCelda("")}
                        </TableCell>
                        <TableCell className="celda-datos">
                          {fmtCelda(etiquetaCondicionIvaCliente(item.condicionIva, condicionesIva))}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {fmtCelda(item.cel)}
                        </TableCell>
                        <TableCell className="celda-datos">
                          {fmtCelda(nombrePintorAsociadoCliente(item) ?? "")}
                        </TableCell>
                        <TableCell className="celda-datos text-center tabular-nums">
                          {item.ctaCorrientePlazo != null
                            ? String(item.ctaCorrientePlazo)
                            : fmtCelda("")}
                        </TableCell>
                        <TableCell className="celda-datos text-right tabular-nums">
                          {item.ctaCorrienteMontoMax != null
                            ? `$${fmtPrecio(item.ctaCorrienteMontoMax)}`
                            : fmtCelda("")}
                        </TableCell>
                        <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                            {esPintor ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title={
                                  expandidoAsociados
                                    ? "Ocultar clientes asociados"
                                    : "Ver clientes asociados"
                                }
                                aria-label={
                                  expandidoAsociados
                                    ? `Ocultar clientes asociados de ${nombre}`
                                    : `Ver clientes asociados de ${nombre}`
                                }
                                aria-expanded={expandidoAsociados}
                                onClick={() =>
                                  setExpanded((prev) =>
                                    prev?.id === item.id && prev.kind === "asociados"
                                      ? null
                                      : { id: item.id, kind: "asociados" }
                                  )
                                }
                              >
                                <Users className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                            ) : null}
                            {tieneVariosProyectos ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                title={
                                  expandidoProyectos ? "Ocultar proyectos" : "Ver proyectos"
                                }
                                aria-label={
                                  expandidoProyectos
                                    ? `Ocultar proyectos de ${nombre}`
                                    : `Ver proyectos de ${nombre}`
                                }
                                aria-expanded={expandidoProyectos}
                                onClick={() =>
                                  setExpanded((prev) =>
                                    prev?.id === item.id && prev.kind === "proyectos"
                                      ? null
                                      : { id: item.id, kind: "proyectos" }
                                  )
                                }
                              >
                                {expandidoProyectos ? (
                                  <ChevronUp className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                ) : (
                                  <ChevronDown className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                )}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              title="Editar"
                              aria-label={`Editar ${nombre}`}
                              onClick={() =>
                                setModalCliente({ open: true, modo: "editar", item })
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
                              aria-label={`Eliminar ${nombre}`}
                              onClick={() =>
                                setModalEliminar({
                                  open: true,
                                  kind: "cliente",
                                  id: item.id,
                                  label: nombre,
                                })
                              }
                            >
                              <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandidoAsociados ? (
                        <FacturaClienteAsociadosDetalle asociados={asociados} />
                      ) : null}
                      {expandidoProyectos ? (
                        <FacturaClienteProyectosDetalle
                          proyectos={item.proyectos}
                          onEditar={(proyecto) =>
                            setModalProyecto({
                              open: true,
                              modo: "editar",
                              personaId: item.id,
                              item: proyecto,
                            })
                          }
                          onEliminar={(proyecto) =>
                            setModalEliminar({
                              open: true,
                              kind: "proyecto",
                              id: proyecto.id,
                              label: etiquetaNombreProyecto(proyecto),
                            })
                          }
                          onCrear={() =>
                            setModalProyecto({
                              open: true,
                              modo: "crear",
                              personaId: item.id,
                              item: null,
                            })
                          }
                        />
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>
      <CrearEditarClienteModal
        open={modalCliente.open}
        onOpenChange={(open) => {
          if (!open) setModalCliente({ open: false });
        }}
        modo={modalCliente.open ? modalCliente.modo : "crear"}
        item={modalCliente.open ? modalCliente.item : null}
        pintores={pintores}
        direcciones={direcciones}
        condicionesIva={condicionesIva}
        onSuccess={() => router.refresh()}
        onCatalogoChanged={() => router.refresh()}
      />
      <CrearEditarEnviosDireccionModal
        open={modalProyecto.open}
        onOpenChange={(open) => {
          if (!open) setModalProyecto({ open: false });
        }}
        modo={modalProyecto.open ? modalProyecto.modo : "crear"}
        personaId={modalProyecto.open ? modalProyecto.personaId : ""}
        item={modalProyecto.open ? modalProyecto.item : null}
        onSuccess={() => router.refresh()}
      />
      <Dialog
        open={modalEliminar.open}
        onOpenChange={(next) => {
          if (!next && !deleting) setModalEliminar({ open: false });
        }}
      >
        <AppModal
          title={
            modalEliminar.open && modalEliminar.kind === "cliente"
              ? "Eliminar Cliente"
              : "Eliminar Proyecto"
          }
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
            ¿Eliminar {modalEliminar.open ? modalEliminar.label : ""}?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
