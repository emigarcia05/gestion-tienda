"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Paintbrush, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { eliminarClienteAction, eliminarEnviosDireccionAction } from "@/actions/envios";
import FilterBar, {
  FILTER_SELECT_WRAPPER_CLASS,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FiltroIndividualContainer,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  etiquetaEsPintor,
  formatearCuitMascara,
  nombrePintorAsociadoCliente,
  type ClienteListaItem,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { hrefCuentaCorrienteCliente } from "@/lib/facturacionRoutes";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { etiquetaCondicionIvaArca, type PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const COL_SPAN = 7;

const FILTRO_SALDO_CON = "con_saldo";
const FILTRO_TIPO_PINTOR = "pintor";
const FILTRO_TIPO_CONS_FINAL = "cons_final";

type ModalCliente = { open: false } | { open: true; modo: "crear" | "editar"; item: ClienteListaItem | null };
type ModalProyecto =
  | { open: false }
  | { open: true; personaId: string; item: EnviosDireccionItem };
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
  const [filtroSaldo, setFiltroSaldo] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [modalCliente, setModalCliente] = useState<ModalCliente>({ open: false });
  const [modalProyecto, setModalProyecto] = useState<ModalProyecto>({ open: false });
  const [modalEliminar, setModalEliminar] = useState<ModalEliminar>({ open: false });
  const [deleting, setDeleting] = useState(false);

  const pintores = useMemo(
    () => items.filter((item) => item.esPintor),
    [items]
  );
  const direcciones = useMemo(
    () => items.flatMap((item) => item.proyectos),
    [items]
  );

  const itemsFiltrados = useMemo(() => {
    const busqueda = qDebounced.trim();
    return items.filter((item) => {
      if (filtroSaldo === FILTRO_SALDO_CON && item.saldoCuentaCorriente <= 0.009) return false;
      if (filtroTipo === FILTRO_TIPO_PINTOR && !item.esPintor) return false;
      if (filtroTipo === FILTRO_TIPO_CONS_FINAL && item.esPintor) return false;
      if (!busqueda) return true;
      return matchByMultiTerm(
        [
          etiquetaClienteListado(item),
          etiquetaEsPintor(item.esPintor),
          item.esPintor ? "PINTOR" : "",
          item.cuit ?? "",
          item.cuit ? formatearCuitMascara(item.cuit) : "",
          item.cel,
          nombrePintorAsociadoCliente(item) ?? "",
          etiquetaCondicionIvaCliente(item.condicionIva, condicionesIva),
          ...item.proyectos.map((p) => etiquetaNombreProyecto(p)),
        ],
        busqueda,
        { numericAsContains: true }
      );
    });
  }, [items, qDebounced, condicionesIva, filtroSaldo, filtroTipo]);

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
    setFiltroSaldo("");
    setFiltroTipo("");
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
        title="Ventas"
        subtitle="Clientes"
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
            <FilaFiltrosDesplegables>
              <FiltroIndividualContainer
                activo={Boolean(filtroSaldo)}
                onLimpiar={() => setFiltroSaldo("")}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={filtroSaldo} onValueChange={setFiltroSaldo}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="SALDO" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_SALDO_CON}>CON SALDO</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={Boolean(filtroTipo)}
                onLimpiar={() => setFiltroTipo("")}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="TIPO" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_TIPO_PINTOR}>PINTOR</SelectItem>
                    <SelectItem value={FILTRO_TIPO_CONS_FINAL}>CONSUMIDOR FINAL</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
            </FilaFiltrosDesplegables>
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-clientes-lista-busqueda"
                  placeholder="BUSCAR POR NOMBRE, CUIT, CEL, PINTOR O PROYECTO..."
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
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>CLIENTE</TableHead>
                <TableHead className="text-center">CUIT</TableHead>
                <TableHead>COND. IVA</TableHead>
                <TableHead className="text-center">CEL</TableHead>
                <TableHead>PINTOR</TableHead>
                <TableHead className="text-right">SALDO</TableHead>
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
                  const esPintor = item.esPintor;
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
                        <TableCell className="celda-datos text-right tabular-nums">
                          {`$${fmtPrecio(item.saldoCuentaCorriente)}`}
                        </TableCell>
                        <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                          <div
                            className={cn(
                              TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                              "flex-nowrap"
                            )}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={!esPintor}
                              title={
                                !esPintor
                                  ? "Solo pintores: ver clientes asociados"
                                  : expandidoAsociados
                                    ? "Ocultar clientes asociados"
                                    : "Ver clientes asociados"
                              }
                              aria-label={
                                !esPintor
                                  ? `${nombre} no es pintor`
                                  : expandidoAsociados
                                    ? `Ocultar clientes asociados de ${nombre}`
                                    : `Ver clientes asociados de ${nombre}`
                              }
                              aria-expanded={esPintor ? expandidoAsociados : undefined}
                              onClick={() =>
                                setExpanded((prev) =>
                                  prev?.id === item.id && prev.kind === "asociados"
                                    ? null
                                    : { id: item.id, kind: "asociados" }
                                )
                              }
                            >
                              <Paintbrush className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              disabled={!tieneVariosProyectos}
                              title={
                                !tieneVariosProyectos
                                  ? "Solo con más de un proyecto"
                                  : expandidoProyectos
                                    ? "Ocultar proyectos"
                                    : "Ver proyectos"
                              }
                              aria-label={
                                !tieneVariosProyectos
                                  ? `${nombre} no tiene varios proyectos`
                                  : expandidoProyectos
                                    ? `Ocultar proyectos de ${nombre}`
                                    : `Ver proyectos de ${nombre}`
                              }
                              aria-expanded={
                                tieneVariosProyectos ? expandidoProyectos : undefined
                              }
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
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                            >
                              <Link
                                href={hrefCuentaCorrienteCliente(item.id)}
                                title="Cuenta corriente"
                                aria-label={`Cuenta corriente de ${nombre}`}
                              >
                                <Wallet className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Link>
                            </Button>
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
        onSuccess={() => router.refresh()}
        onCatalogoChanged={() => router.refresh()}
      />
      <CrearEditarEnviosDireccionModal
        open={modalProyecto.open}
        onOpenChange={(open) => {
          if (!open) setModalProyecto({ open: false });
        }}
        modo="editar"
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
