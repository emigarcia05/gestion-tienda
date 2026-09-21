"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEnvioWizardModal from "@/components/envios/CrearEnvioWizardModal";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FiltroIndividualContainer,
  FilaFiltrosDesplegables,
  FilterRowSearch,
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
import { eliminarEnviosFinalAction, marcarEnviosFinalEntregadoAction } from "@/actions/envios";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  direccionEnvioTieneDato,
  etiquetaClienteListado,
  etiquetaDepartamentoEnvio,
  etiquetaDireccionEnvio,
  etiquetaFormaPagadoEnvio,
  etiquetaHorarioEnvio,
  etiquetaSucursalEnvio,
  nombreCompletoCliente,
  telefonoEnvio,
  type ClienteItem,
  type EnviosDireccionItem,
  type EnviosFinalListItem,
  type EnviosSucursalOption,
} from "@/lib/envios";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const FILTRO_TODOS = "__todos__";
const FILTRO_FECHA_HOY = "hoy";
const FILTRO_FECHA_MANANA = "manana";
const COLSPAN_ENVIOS_PROGRAMADOS = 11;

function CeldaTilte({
  activo,
  ariaLabelSi,
  ariaLabelNo,
}: {
  activo: boolean;
  ariaLabelSi: string;
  ariaLabelNo: string;
}) {
  return (
    <TableCell className="celda-datos text-center">
      <div className="flex w-full items-center justify-center">
        <span
          className="tabla-check-toggle"
          aria-label={activo ? ariaLabelSi : ariaLabelNo}
          role="img"
        >
          {activo ? <Check aria-hidden="true" /> : null}
        </span>
      </div>
    </TableCell>
  );
}

interface Props {
  envios: EnviosFinalListItem[];
  clientes: ClienteItem[];
  direcciones: EnviosDireccionItem[];
  sucursales: EnviosSucursalOption[];
}

export default function EnviosPageClient({ envios, clientes, direcciones, sucursales }: Props) {
  const router = useRouter();
  const [filtroSucursal, setFiltroSucursal] = useState(FILTRO_TODOS);
  const [filtroFecha, setFiltroFecha] = useState(FILTRO_TODOS);
  const [filtroEntregado, setFiltroEntregado] = useState(FILTRO_TODOS);
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } = useFiltrosConBusqueda({
    qActual: qDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDebounced,
  });
  const [modalWizard, setModalWizard] = useState<
    { open: false } | { open: true; item: EnviosFinalListItem | null }
  >({ open: false });
  const [modalEliminar, setModalEliminar] = useState<
    { open: false } | { open: true; id: string; label: string }
  >({ open: false });
  const [deleting, setDeleting] = useState(false);
  const [entregandoId, setEntregandoId] = useState<string | null>(null);

  const itemsFiltrados = useMemo(() => {
    return envios.filter((item) => {
      if (filtroSucursal !== FILTRO_TODOS && item.sucursal.id !== filtroSucursal) return false;
      if (filtroFecha !== FILTRO_TODOS) {
        const hoyIso = dateToIsoYmdArgentina(new Date());
        if (filtroFecha === FILTRO_FECHA_HOY && item.fechaEnvioIso !== hoyIso) return false;
        if (
          filtroFecha === FILTRO_FECHA_MANANA &&
          item.fechaEnvioIso !== addDaysToIsoYmdArgentina(hoyIso, 1)
        ) {
          return false;
        }
      }
      if (filtroEntregado === "si" && !item.entregado) return false;
      if (filtroEntregado === "no" && item.entregado) return false;
      if (
        qDebounced.trim() &&
        !matchByMultiTerm(
          [
            etiquetaSucursalEnvio(item.sucursal),
            item.clienteFinal ? etiquetaClienteListado(item.clienteFinal) : "",
            item.clienteFinal?.cel ?? "",
            item.pintor ? nombreCompletoCliente(item.pintor) : "",
            item.pintor?.cel ?? "",
            telefonoEnvio(item),
            etiquetaDireccionEnvio(item.direccion),
            item.direccion.distrito,
            etiquetaDepartamentoEnvio(item.direccion.departamento),
            item.direccion.referencia,
            item.direccion.urlMaps,
            item.observacionEnvio,
            etiquetaFormaPagadoEnvio(item.formaPagado),
            formatIsoYmdDdMmYyyyArgentina(item.fechaEnvioIso),
            etiquetaHorarioEnvio(item.horaDesde, item.horaHasta),
          ],
          qDebounced
        )
      ) {
        return false;
      }
      return true;
    });
  }, [envios, filtroSucursal, filtroFecha, filtroEntregado, qDebounced]);

  function limpiarFiltros() {
    setFiltroSucursal(FILTRO_TODOS);
    setFiltroFecha(FILTRO_TODOS);
    setFiltroEntregado(FILTRO_TODOS);
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
      const res = await eliminarEnviosFinalAction({ id: modalEliminar.id });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Envío eliminado.");
      setModalEliminar({ open: false });
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleMarcarEntregado(id: string, entregadoActual: boolean) {
    if (entregandoId) return;
    setEntregandoId(id);
    try {
      const proximoEstadoEntregado = !entregadoActual;
      const res = await marcarEnviosFinalEntregadoAction({ id, entregado: proximoEstadoEntregado });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo marcar como entregado.");
        return;
      }
      toast.success(
        proximoEstadoEntregado ? "Envío marcado como entregado." : "Envío marcado como no entregado."
      );
      refresh();
    } finally {
      setEntregandoId(null);
    }
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Envios"
        subtitle="Programados"
        contentWidth="full"
        actions={
          <Button
            type="button"
            className="h-10 gap-2 px-4"
            onClick={() => setModalWizard({ open: true, item: null })}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Crear Envío
          </Button>
        }
        filters={
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilaFiltrosDesplegables>
              <FiltroIndividualContainer
                activo={filtroSucursal !== FILTRO_TODOS}
                onLimpiar={() => setFiltroSucursal(FILTRO_TODOS)}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select
                  value={filtroSucursal === FILTRO_TODOS ? "" : filtroSucursal}
                  onValueChange={setFiltroSucursal}
                >
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                    <SelectValue placeholder="SUCURSAL" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {etiquetaSucursalEnvio(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={filtroFecha !== FILTRO_TODOS}
                onLimpiar={() => setFiltroFecha(FILTRO_TODOS)}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select
                  value={filtroFecha === FILTRO_TODOS ? "" : filtroFecha}
                  onValueChange={setFiltroFecha}
                >
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                    <SelectValue placeholder="FECHA" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                    <SelectItem value={FILTRO_FECHA_HOY}>HOY</SelectItem>
                    <SelectItem value={FILTRO_FECHA_MANANA}>MAÑANA</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={filtroEntregado !== FILTRO_TODOS}
                onLimpiar={() => setFiltroEntregado(FILTRO_TODOS)}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select
                  value={filtroEntregado === FILTRO_TODOS ? "" : filtroEntregado}
                  onValueChange={setFiltroEntregado}
                >
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                    <SelectValue placeholder="ENTREGADO" />
                  </SelectTrigger>
                  <SelectContent className="select-content-filtro" position="popper" side="bottom" align="start">
                    <SelectItem value="si">SÍ</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
            </FilaFiltrosDesplegables>
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id="filtro-envios-busqueda"
                  placeholder="BUSCAR POR SUCURSAL, PERSONA O DIRECCIÓN..."
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {itemsFiltrados.length.toLocaleString("es-AR")} ENVÍO
                {itemsFiltrados.length === 1 ? "" : "S"}
              </span>
            </div>
          </FilterBar>
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>SUCURSAL</TableHead>
                <TableHead>CLIENTE</TableHead>
                <TableHead>PINTOR</TableHead>
                <TableHead>FECHA</TableHead>
                <TableHead>HORARIO</TableHead>
                <TableHead className="text-center">DIRECCIÓN</TableHead>
                <TableHead className="text-center">TELEFONO</TableHead>
                <TableHead className="text-center">UBI</TableHead>
                <TableHead className="text-center">PDF</TableHead>
                <TableHead className="text-center">ENTREGADO</TableHead>
                <TableHead className="tabla-bloque-secundario-head-divider text-center">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsFiltrados.length === 0 ? (
                <EmptyTableRow
                  colSpan={COLSPAN_ENVIOS_PROGRAMADOS}
                  message={
                    envios.length === 0
                      ? "NO HAY ENVÍOS."
                      : "NO HAY ENVÍOS CON LOS FILTROS APLICADOS."
                  }
                />
              ) : (
                itemsFiltrados.map((item) => (
                  <TableRow
                    key={item.id}
                    className={cn(item.entregado && "opacity-60 saturate-50")}
                  >
                    <TableCell className="celda-datos">
                      {etiquetaSucursalEnvio(item.sucursal)}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {item.clienteFinal
                        ? etiquetaClienteListado(item.clienteFinal)
                        : fmtCelda("")}
                    </TableCell>
                    <TableCell className="celda-datos">
                      {item.pintor ? nombreCompletoCliente(item.pintor) : fmtCelda("")}
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums">
                      {formatIsoYmdDdMmYyyyArgentina(item.fechaEnvioIso)}
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums">
                      {etiquetaHorarioEnvio(item.horaDesde, item.horaHasta)}
                    </TableCell>
                    <CeldaTilte
                      activo={direccionEnvioTieneDato(item.direccion)}
                      ariaLabelSi="Tiene dirección"
                      ariaLabelNo="Sin dirección"
                    />
                    <CeldaTilte
                      activo={telefonoEnvio(item) !== ""}
                      ariaLabelSi="Tiene teléfono"
                      ariaLabelNo="Sin teléfono"
                    />
                    <CeldaTilte
                      activo={item.direccion.urlMaps.trim() !== ""}
                      ariaLabelSi="Tiene ubicación"
                      ariaLabelNo="Sin ubicación"
                    />
                    <CeldaTilte
                      activo={item.tienePdf}
                      ariaLabelSi="Tiene PDF"
                      ariaLabelNo="Sin PDF"
                    />
                    <CeldaTilte
                      activo={item.entregado}
                      ariaLabelSi="Entregado"
                      ariaLabelNo="No entregado"
                    />
                    <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                            item.entregado && "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                          title={item.entregado ? "Marcar como no entregado" : "Marcar entregado"}
                          aria-label={
                            item.entregado
                              ? "Marcar envío como no entregado"
                              : "Marcar envío como entregado"
                          }
                          disabled={entregandoId === item.id}
                          onClick={() => void handleMarcarEntregado(item.id, item.entregado)}
                        >
                          <CheckCheck className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Editar"
                          aria-label="Editar envío"
                          onClick={() => setModalWizard({ open: true, item })}
                        >
                          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Eliminar"
                          aria-label="Eliminar envío"
                          onClick={() =>
                            setModalEliminar({
                              open: true,
                              id: item.id,
                              label: etiquetaDireccionEnvio(item.direccion),
                            })
                          }
                        >
                          <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>

      <CrearEnvioWizardModal
        open={modalWizard.open}
        onOpenChange={(open) => {
          if (!open) setModalWizard({ open: false });
        }}
        item={modalWizard.open ? modalWizard.item : null}
        clientesCatalogo={clientes}
        direcciones={direcciones}
        sucursales={sucursales}
        onCatalogoChanged={refresh}
        onSuccess={() => {
          setModalWizard({ open: false });
          refresh();
        }}
      />
      <Dialog
        open={modalEliminar.open}
        onOpenChange={(open) => {
          if (!open && !deleting) setModalEliminar({ open: false });
        }}
      >
        <AppModal
          title="Eliminar Envío"
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
            ¿Eliminar el envío a {modalEliminar.open ? modalEliminar.label : ""}?
          </p>
        </AppModal>
      </Dialog>
    </>
  );
}
