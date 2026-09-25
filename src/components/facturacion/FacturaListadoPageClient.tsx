"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, CircleDollarSign, Eye, FilePlus2, FileText, Loader2, Stamp, Trash2, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  convertirComprobanteNoFiscalEnFiscalAction,
  eliminarComprobanteNoFiscalAction,
  obtenerFacturaComprobantePdfAction,
} from "@/actions/factura";
import { listarCatalogoWizardEnvioAction } from "@/actions/envios";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FiltroIndividualContainer,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FacturaComprobanteCobrosModal from "@/components/facturacion/FacturaComprobanteCobrosModal";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import FacturaComprobantePdfAccionModal from "@/components/facturacion/FacturaComprobantePdfAccionModal";
import CrearEnvioWizardModal from "@/components/envios/CrearEnvioWizardModal";
import AppModal from "@/components/shared/AppModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import FiltroRangoFechasCalendarioModal from "@/components/shared/FiltroRangoFechasCalendarioModal";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
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
import {
  etiquetaTipoListaComprobantes,
  MENSAJE_PERSONAL_SESION_REQUERIDO,
  esFacturaTipoNotaCredito,
  esFacturaTipoVenta,
  puedeEliminarComprobante,
  resumenIndicadoresListaComprobantes,
  type FacturaClienteFiltroOption,
  type FacturaComprobanteListItem,
  type FacturaSucursalFiltroOption,
  type FacturaUsuarioFiltroOption,
} from "@/lib/factura";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  formatHhMmArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { ultimosDigitosNroComprobante } from "@/lib/facturaFiscal";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { matchByMultiTerm } from "@/lib/busqueda";
import { useAplicarSucursalPreferidaSiVacia } from "@/lib/hooks/useAplicarSucursalPreferidaSiVacia";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { hrefFacturaCrear } from "@/lib/facturacionRoutes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import {
  bytesPdfAAdjuntoEnvio,
  generarBytesPdfFacturaComprobante,
  nombreArchivoComprobanteFactura,
} from "@/lib/facturaComprobantePdfClient";
import type {
  EnviosWizardBorradorFactura,
  EnviosWizardCatalogo,
} from "@/lib/envios";

const FILTRO_SUCURSAL_TODAS = "todas";
const FILTRO_USUARIO_TODOS = "todos";
const FILTRO_TIPO_TODOS = "todos";
const FILTRO_TIPO_FACTURA = "factura";
const FILTRO_SALDO_CON = "con_saldo";
const FILTRO_SALDO_VENCIDO = "con_saldo_vencido";
const PERIODO_HOY = "hoy";
const PERIODO_RANGO = "rango";
/** Ancho fijo de BUSCAR POR CLIENTE y PROYECTO. El hueco de proyecto se reserva aunque no se muestre. */
const FILTRO_CLIENTE_PROYECTO_ANCHO_CLASS = "w-[20rem] shrink-0 flex-none";
/** Texto de celda alineado al `th` (`.table-head-inner` centra en 100% del ancho). */
const CELDA_TEXTO_CLASS = "text-center whitespace-normal";
const PILA_CELDA_CLASS =
  "flex w-full flex-col items-center justify-center text-center leading-tight";

/** Anchos `%` Lista Comprobantes (`colgroup`; suman 100). */
const LISTADO_FACTURAS_COLGROUP = (
  <>
    <col className="w-[12%]" />
    <col className="w-[6%]" />
    <col className="w-[20%]" />
    <col className="w-[5%]" />
    <col className="w-[10%]" />
    <col className="w-[10%]" />
    <col className="w-[8%]" />
    <col className="w-[8%]" />
    <col className="w-[5%]" />
    <col className="w-[16%]" />
  </>
);

/** Anchos `%` Lista Presupuestos (`colgroup`; suman 100). */
const LISTADO_PRESUPUESTOS_COLGROUP = (
  <>
    <col className="w-[12%]" />
    <col className="w-[24%]" />
    <col className="w-[10%]" />
    <col className="w-[12%]" />
    <col className="w-[14%]" />
    <col className="w-[10%]" />
    <col className="w-[18%]" />
  </>
);

type PeriodoFiltro = "hoy" | "ayer" | "mes" | "rango" | "todos";

function esPeriodoFiltroPreset(value: string): value is Exclude<PeriodoFiltro, "rango"> {
  return value === "hoy" || value === "ayer" || value === "mes" || value === "todos";
}

type Props = {
  items: FacturaComprobanteListItem[];
  sucursales: FacturaSucursalFiltroOption[];
  usuarios: FacturaUsuarioFiltroOption[];
  /** Catálogo para el filtro de Lista Comprobantes. Presupuestos no lo usa. */
  clientesFiltro?: FacturaClienteFiltroOption[];
  variant: "facturas" | "presupuestos";
};

export default function FacturaListadoPageClient({
  items,
  sucursales,
  usuarios,
  clientesFiltro = [],
  variant,
}: Props) {
  const router = useRouter();
  const [qDebounced, setQDebounced] = useState("");
  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } =
    useFiltrosConBusqueda({
      qActual: qDebounced,
      debounceMs: 300,
      onDebouncedSearch: setQDebounced,
    });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(PERIODO_HOY);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [rangoModalOpen, setRangoModalOpen] = useState(false);
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPendiente, setFiltroPendiente] = useState("");
  const [filtroClienteId, setFiltroClienteId] = useState("");
  const [filtroProyectoId, setFiltroProyectoId] = useState("");
  const [cobrosId, setCobrosId] = useState<string | null>(null);
  const [cobrosNro, setCobrosNro] = useState("");
  const [cobrosEsNc, setCobrosEsNc] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [pdfNro, setPdfNro] = useState("");
  const [envioWizardOpen, setEnvioWizardOpen] = useState(false);
  const [envioCatalogo, setEnvioCatalogo] = useState<EnviosWizardCatalogo>({
    clientes: [],
    direcciones: [],
    sucursales: [],
  });
  const [envioBorrador, setEnvioBorrador] = useState<EnviosWizardBorradorFactura | null>(
    null
  );
  const [modalAccion, setModalAccion] = useState<
    | { open: false }
    | { open: true; kind: "borrar" | "convertir"; item: FacturaComprobanteListItem }
  >({ open: false });

  const sucursalCodigos = useMemo(
    () => new Set(sucursales.map((s) => s.codigo)),
    [sucursales]
  );
  useAplicarSucursalPreferidaSiVacia(
    filtroSucursal === FILTRO_SUCURSAL_TODAS ? FILTRO_SUCURSAL_TODAS : filtroSucursal,
    setFiltroSucursal,
    (codigo) => sucursalCodigos.has(codigo)
  );

  const proyectosCliente = useMemo(() => {
    if (!filtroClienteId) return [];
    return (
      clientesFiltro.find((cliente) => cliente.id === filtroClienteId)?.proyectos ??
      []
    );
  }, [clientesFiltro, filtroClienteId]);
  const muestraProyecto = proyectosCliente.length > 1;

  const hoyIso = dateToIsoYmdArgentina(new Date());
  const ayerIso = addDaysToIsoYmdArgentina(hoyIso, -1);

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (periodo === "hoy" && item.fechaIso !== hoyIso) return false;
      if (periodo === "ayer" && item.fechaIso !== ayerIso) return false;
      if (periodo === "mes" && item.fechaIso.slice(0, 7) !== hoyIso.slice(0, 7)) {
        return false;
      }
      if (periodo === "rango") {
        if (!rangoDesde || !rangoHasta) return false;
        if (item.fechaIso < rangoDesde || item.fechaIso > rangoHasta) return false;
      }
      if (
        filtroSucursal &&
        filtroSucursal !== FILTRO_SUCURSAL_TODAS &&
        !item.sucursalCodigos.includes(filtroSucursal)
      ) {
        return false;
      }
      if (
        filtroUsuario &&
        filtroUsuario !== FILTRO_USUARIO_TODOS &&
        item.personalId !== Number(filtroUsuario)
      ) {
        return false;
      }
      if (
        filtroTipo &&
        filtroTipo !== FILTRO_TIPO_TODOS
      ) {
        if (filtroTipo === FILTRO_TIPO_FACTURA) {
          if (!esFacturaTipoVenta(item.tipo)) return false;
        } else if (item.tipo !== filtroTipo) {
          return false;
        }
      }
      if (filtroPendiente === FILTRO_SALDO_CON) {
        if (item.saldoPendiente == null || item.saldoPendiente <= 0) return false;
      }
      if (filtroPendiente === FILTRO_SALDO_VENCIDO) {
        if (
          item.saldoPendiente == null ||
          item.saldoPendiente <= 0 ||
          item.diasVencido == null ||
          item.diasVencido <= 0
        ) {
          return false;
        }
      }
      if (variant === "facturas") {
        if (filtroClienteId && item.clienteId !== filtroClienteId) return false;
        if (
          filtroProyectoId &&
          muestraProyecto &&
          item.proyectoId !== filtroProyectoId
        ) {
          return false;
        }
        return true;
      }
      if (!qDebounced.trim()) return true;
      return matchByMultiTerm(
        [
          item.cliente,
          item.nroComprobante,
          item.cae ?? "",
          etiquetaTipoListaComprobantes(item.tipo),
          item.letra ?? "",
          item.sucursalNombres.join(" "),
          item.usuarioNombre,
          item.saldoPendiente != null ? String(item.saldoPendiente) : "",
          item.diasVencido != null ? String(item.diasVencido) : "",
        ],
        qDebounced
      );
    });
  }, [
    items,
    qDebounced,
    periodo,
    rangoDesde,
    rangoHasta,
    hoyIso,
    ayerIso,
    filtroSucursal,
    filtroUsuario,
    filtroTipo,
    filtroPendiente,
    filtroClienteId,
    filtroProyectoId,
    muestraProyecto,
    variant,
  ]);

  function onPeriodoChange(value: string) {
    if (value === PERIODO_RANGO) {
      setRangoModalOpen(true);
      return;
    }
    if (!esPeriodoFiltroPreset(value)) return;
    setRangoDesde("");
    setRangoHasta("");
    setPeriodo(value);
  }

  function limpiarPeriodo() {
    setPeriodo(PERIODO_HOY);
    setRangoDesde("");
    setRangoHasta("");
  }

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
    limpiarPeriodo();
    setFiltroSucursal("");
    setFiltroUsuario("");
    setFiltroTipo("");
    setFiltroPendiente("");
    setFiltroClienteId("");
    setFiltroProyectoId("");
  }

  function onFiltroClienteChange(value: string) {
    setFiltroClienteId(value);
    setFiltroProyectoId("");
  }

  function irDuplicar(id: string) {
    router.push(
      hrefFacturaCrear({
        duplicar: id,
        clase: variant === "facturas" ? "venta" : "presupuesto",
      })
    );
  }

  function irNotaCredito(id: string) {
    router.push(hrefFacturaCrear({ nc: id, clase: "nota_credito" }));
  }

  async function recargarCatalogoEnvio() {
    const res = await listarCatalogoWizardEnvioAction();
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cargar el catálogo de envíos.");
      return;
    }
    setEnvioCatalogo(res.data);
  }

  async function irEnvioDesdeFactura(item: FacturaComprobanteListItem) {
    if (!esFacturaTipoVenta(item.tipo) || item.estado === "rechazado") return;
    setBusyId(item.id);
    try {
      const [catRes, pdfRes] = await Promise.all([
        listarCatalogoWizardEnvioAction(),
        obtenerFacturaComprobantePdfAction({ id: item.id }),
      ]);
      if (!catRes.ok) {
        toast.error(catRes.error ?? "No se pudo cargar el catálogo de envíos.");
        return;
      }
      setEnvioCatalogo(catRes.data);
      let pdfAdjunto: EnviosWizardBorradorFactura["pdfAdjunto"] = null;
      if (pdfRes.ok) {
        const bytes = await generarBytesPdfFacturaComprobante(pdfRes.data);
        const nombre = nombreArchivoComprobanteFactura({
          cliente: pdfRes.data.cliente,
          fechaIso: pdfRes.data.fechaIso,
          nroComprobante: pdfRes.data.nroComprobante,
          comentarios: pdfRes.data.comentarios,
        });
        pdfAdjunto = bytesPdfAAdjuntoEnvio(nombre, bytes);
        if (!pdfAdjunto) {
          toast.error("El PDF supera el tamaño máximo (5 MB).");
        }
      } else {
        toast.error(pdfRes.error ?? "No se pudo generar el PDF del comprobante.");
      }
      let direccionId = item.proyectoId;
      if (!direccionId && item.clienteId) {
        const dirs = catRes.data.direcciones.filter((d) => d.personaId === item.clienteId);
        if (dirs.length === 1) direccionId = dirs[0]?.id ?? null;
      }
      const pagadoCompleto = item.saldoPendiente == null || item.saldoPendiente <= 0;
      setEnvioBorrador({
        clienteId: item.clienteId,
        direccionId,
        pdfAdjunto,
        formaPagado: pagadoCompleto ? "PAGADO" : "",
        formaPagadoFijada: pagadoCompleto,
      });
      setEnvioWizardOpen(true);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmarModalAccion() {
    if (!modalAccion.open) return;
    const item = modalAccion.item;
    if (modalAccion.kind === "borrar") {
      setBusyId(item.id);
      try {
        const res = await eliminarComprobanteNoFiscalAction({ id: item.id });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo eliminar.");
          return;
        }
        toast.success("Comprobante eliminado.");
        setModalAccion({ open: false });
        router.refresh();
      } finally {
        setBusyId(null);
      }
      return;
    }
    const personalId = leerUsuarioSesion()?.idPersonal;
    if (personalId == null) {
      toast.error(MENSAJE_PERSONAL_SESION_REQUERIDO);
      return;
    }
    setBusyId(item.id);
    try {
      const res = await convertirComprobanteNoFiscalEnFiscalAction({
        id: item.id,
        personalId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo convertir.");
        return;
      }
      toast.success(
        res.data.cae
          ? `Fiscal CAE ${res.data.cae}`
          : "Comprobante convertido en fiscal."
      );
      setModalAccion({ open: false });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const esFacturas = variant === "facturas";
  const colSpan = esFacturas ? 10 : 7;
  const indicadores = useMemo(
    () => resumenIndicadoresListaComprobantes(itemsFiltrados),
    [itemsFiltrados]
  );

  return (
    <ClassicFilteredTableLayout
      title="COMPROBANTES"
      subtitle={esFacturas ? "Comprobante" : "Presupuesto"}
      contentWidth="full"
      actions={
        <ToolbarActionButton
          label={esFacturas ? "Nuevo Comprobante" : "NUEVO PRESUPUESTO"}
          icon={<FilePlus2 />}
          onClick={() =>
            router.push(
              hrefFacturaCrear({
                clase: esFacturas ? "venta" : "presupuesto",
              })
            )
          }
        />
      }
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilaFiltrosDesplegables columnas={esFacturas ? 5 : 4}>
              <FiltroIndividualContainer
                activo={periodo !== PERIODO_HOY}
                onLimpiar={limpiarPeriodo}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={periodo} onValueChange={onPeriodoChange}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    {periodo === PERIODO_RANGO && rangoDesde && rangoHasta ? (
                      <span data-slot="select-value" className="truncate">
                        {`${formatIsoYmdDdMmYyyyArgentina(rangoDesde)} - ${formatIsoYmdDdMmYyyyArgentina(rangoHasta)}`}
                      </span>
                    ) : (
                      <SelectValue placeholder="PERIODO DE TIEMPO" />
                    )}
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value="hoy">HOY</SelectItem>
                    <SelectItem value="ayer">AYER</SelectItem>
                    <SelectItem value="mes">ESTE MES</SelectItem>
                    <SelectItem
                      value={PERIODO_RANGO}
                      onPointerDown={() => {
                        queueMicrotask(() => setRangoModalOpen(true));
                      }}
                    >
                      RANGO PERSONALIZADO
                    </SelectItem>
                    <SelectItem value="todos">TODO</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={Boolean(filtroSucursal) && filtroSucursal !== FILTRO_SUCURSAL_TODAS}
                onLimpiar={() => setFiltroSucursal("")}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="SUCURSAL" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_SUCURSAL_TODAS}>TODAS</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.codigo} value={s.codigo}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={Boolean(filtroUsuario) && filtroUsuario !== FILTRO_USUARIO_TODOS}
                onLimpiar={() => setFiltroUsuario("")}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="PERSONAL" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_USUARIO_TODOS}>TODOS</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.idPersonal} value={String(u.idPersonal)}>
                        {u.nombrePersonal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              {esFacturas ? (
                <FiltroIndividualContainer
                  activo={Boolean(filtroTipo) && filtroTipo !== FILTRO_TIPO_TODOS}
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
                      <SelectItem value={FILTRO_TIPO_TODOS}>TODO</SelectItem>
                      <SelectItem value={FILTRO_TIPO_FACTURA}>FACTURA</SelectItem>
                      <SelectItem value="nota_credito_fiscal">
                        NOTA CRÉDITO FISCAL
                      </SelectItem>
                      <SelectItem value="nota_credito_no_fiscal">
                        NOTA CRÉDITO NO FISCAL
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              ) : null}
              {esFacturas ? (
                <FiltroIndividualContainer
                  activo={Boolean(filtroPendiente)}
                  onLimpiar={() => setFiltroPendiente("")}
                  className={FILTER_SELECT_WRAPPER_CLASS}
                >
                  <Select
                    value={filtroPendiente}
                    onValueChange={setFiltroPendiente}
                  >
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
                      <SelectItem value={FILTRO_SALDO_VENCIDO}>
                        CON SALDO VENCIDO
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              ) : null}
            </FilaFiltrosDesplegables>
            <div className="flex items-center gap-3">
              {esFacturas ? (
                <>
                  <FiltroIndividualContainer
                    activo={Boolean(filtroClienteId)}
                    onLimpiar={() => onFiltroClienteChange("")}
                    className={FILTRO_CLIENTE_PROYECTO_ANCHO_CLASS}
                  >
                    <Select value={filtroClienteId} onValueChange={onFiltroClienteChange}>
                      <SelectTrigger
                        id="filtro-facturas-busqueda"
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                      >
                        <SelectValue placeholder="BUSCAR POR CLIENTE" />
                      </SelectTrigger>
                      <SelectContent
                        className="select-content-filtro"
                        position="popper"
                        side="bottom"
                        align="start"
                      >
                        {clientesFiltro.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                  <FiltroIndividualContainer
                    activo={muestraProyecto && Boolean(filtroProyectoId)}
                    onLimpiar={() => setFiltroProyectoId("")}
                    className={cn(
                      FILTRO_CLIENTE_PROYECTO_ANCHO_CLASS,
                      !muestraProyecto && "invisible pointer-events-none"
                    )}
                  >
                    <Select
                      value={filtroProyectoId}
                      onValueChange={setFiltroProyectoId}
                      disabled={!muestraProyecto}
                    >
                      <SelectTrigger
                        id="filtro-facturas-proyecto"
                        className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                        aria-hidden={!muestraProyecto}
                      >
                        <SelectValue placeholder="PROYECTO" />
                      </SelectTrigger>
                      <SelectContent
                        className="select-content-filtro"
                        position="popper"
                        side="bottom"
                        align="start"
                      >
                        {proyectosCliente.map((proyecto) => (
                          <SelectItem key={proyecto.id} value={proyecto.id}>
                            {proyecto.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FiltroIndividualContainer>
                </>
              ) : (
                <FilterRowSearch className="flex-1">
                  <FiltroBusquedaInput
                    id="filtro-presupuestos-busqueda"
                    placeholder="BUSCAR POR CLIENTE, N°, CAE…"
                    value={q}
                    onChange={handleQChange}
                    isDebouncing={isDebouncing}
                    inputRef={searchRef}
                  />
                </FilterRowSearch>
              )}
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {itemsFiltrados.length.toLocaleString("es-AR")} REGISTRO
                {itemsFiltrados.length === 1 ? "" : "S"}
              </span>
            </div>
          </FilterBar>
        }
    >
      <div className="contenedor-tabla-gestion contenedor-tabla-gestion--pie-fijo min-h-0 flex-1">
        <div className="contenedor-tabla-gestion--pie-fijo-scroll">
        <Table
          variant="compact"
          className="tabla-gestion-compacta w-full table-fixed text-center"
        >
          <colgroup>
            {esFacturas ? LISTADO_FACTURAS_COLGROUP : LISTADO_PRESUPUESTOS_COLGROUP}
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">FECHA</TableHead>
              {esFacturas ? (
                <TableHead className="text-center">TIPO</TableHead>
              ) : null}
              <TableHead className="text-center">CLIENTE</TableHead>
              <TableHead className="text-center">N°</TableHead>
              <TableHead className="text-center">SUCURSAL</TableHead>
              <TableHead className="text-center">PERSONAL</TableHead>
              <TableHead className="tabla-bloque-secundario-head-divider text-center">
                TOTAL
              </TableHead>
              {esFacturas ? (
                <TableHead className="tabla-bloque-secundario-head text-center">
                  SALDO
                </TableHead>
              ) : null}
              {esFacturas ? (
                <TableHead className="tabla-bloque-secundario-head text-center">
                  DÍAS VENC.
                </TableHead>
              ) : null}
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
                    ? "No hay comprobantes."
                    : "No hay registros con los filtros aplicados."
                }
              />
            ) : (
              itemsFiltrados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className={cn(CELDA_TEXTO_CLASS, "tabular-nums")}>
                    <span className={PILA_CELDA_CLASS}>
                      <span>{formatIsoYmdDdMmYyyyArgentina(item.fechaIso)}</span>
                      <span>
                        {formatHhMmArgentina(new Date(item.createdAtIso))}
                      </span>
                    </span>
                  </TableCell>
                  {esFacturas ? (
                    <TableCell className={cn(CELDA_TEXTO_CLASS, "uppercase")}>
                      {etiquetaTipoListaComprobantes(item.tipo)}
                    </TableCell>
                  ) : null}
                  <TableCell className={cn(CELDA_TEXTO_CLASS, "uppercase")}>
                    {item.cliente}
                  </TableCell>
                  <TableCell
                    className={cn(CELDA_TEXTO_CLASS, "tabular-nums")}
                    title={item.nroComprobante || undefined}
                  >
                    {fmtCelda(ultimosDigitosNroComprobante(item.nroComprobante, 5))}
                  </TableCell>
                  <TableCell className={cn(CELDA_TEXTO_CLASS, "uppercase")}>
                    {fmtCelda(item.sucursalNombres.join(" · "))}
                  </TableCell>
                  <TableCell className={cn(CELDA_TEXTO_CLASS, "uppercase")}>
                    {fmtCelda(item.usuarioNombre)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "celda-datos tabular-nums tabla-bloque-secundario-cell-divider",
                      CELDA_TEXTO_CLASS
                    )}
                  >
                    ${fmtPrecio(item.impTotal)}
                  </TableCell>
                  {esFacturas ? (
                    <TableCell
                      className={cn(
                        "celda-datos tabular-nums tabla-bloque-secundario-cell",
                        CELDA_TEXTO_CLASS
                      )}
                    >
                      {item.saldoPendiente != null
                        ? `$${fmtPrecio(item.saldoPendiente)}`
                        : fmtCelda("")}
                    </TableCell>
                  ) : null}
                  {esFacturas ? (
                    <TableCell
                      className={cn(
                        "celda-datos tabular-nums tabla-bloque-secundario-cell",
                        CELDA_TEXTO_CLASS,
                        item.diasVencido != null && "text-destructive"
                      )}
                    >
                      {item.diasVencido != null
                        ? String(item.diasVencido)
                        : fmtCelda("")}
                    </TableCell>
                  ) : null}
                  <TableCell
                    className={cn(
                      "tabla-bloque-secundario-cell-divider",
                      CELDA_TEXTO_CLASS
                    )}
                  >
                    <div
                      className={cn(
                        TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                        "flex-nowrap justify-center"
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="Ver"
                        aria-label={`Ver ${item.nroComprobante}`}
                        onClick={() => setDetalleId(item.id)}
                      >
                        <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="REIMPRESION"
                        aria-label={`Reimpresión ${item.nroComprobante}`}
                        disabled={busyId === item.id}
                        onClick={() => {
                          setPdfId(item.id);
                          setPdfNro(item.nroComprobante);
                        }}
                      >
                        <FileText className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="Duplicar"
                        aria-label={`Duplicar ${item.nroComprobante}`}
                        disabled={busyId === item.id}
                        onClick={() => irDuplicar(item.id)}
                      >
                        <Copy className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      {esFacturas ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Cobro"
                          aria-label={`Cobro ${item.nroComprobante}`}
                          disabled={
                            busyId === item.id ||
                            (!esFacturaTipoVenta(item.tipo) &&
                              !esFacturaTipoNotaCredito(item.tipo))
                          }
                          onClick={() => {
                            setCobrosId(item.id);
                            setCobrosNro(item.nroComprobante);
                            setCobrosEsNc(esFacturaTipoNotaCredito(item.tipo));
                          }}
                        >
                          <CircleDollarSign
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      ) : null}
                      {esFacturas ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="ENVIO"
                          aria-label={`Envío ${item.nroComprobante}`}
                          disabled={
                            busyId === item.id ||
                            !esFacturaTipoVenta(item.tipo) ||
                            item.estado === "rechazado"
                          }
                          onClick={() => void irEnvioDesdeFactura(item)}
                        >
                          <Truck
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      ) : null}
                      {esFacturas ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Nota de crédito"
                          aria-label={`Nota de crédito ${item.nroComprobante}`}
                          disabled={
                            busyId === item.id || !esFacturaTipoVenta(item.tipo)
                          }
                          onClick={() => irNotaCredito(item.id)}
                        >
                          <Undo2
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="Borrar"
                        aria-label={`Borrar ${item.nroComprobante}`}
                        disabled={
                          busyId === item.id || !puedeEliminarComprobante(item.tipo)
                        }
                        onClick={() =>
                          setModalAccion({ open: true, kind: "borrar", item })
                        }
                      >
                        <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      {esFacturas ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Convertir en fiscal"
                          aria-label={`Convertir en fiscal ${item.nroComprobante}`}
                          disabled={
                            busyId === item.id || item.tipo !== "factura_no_fiscal"
                          }
                          onClick={() =>
                            setModalAccion({
                              open: true,
                              kind: "convertir",
                              item,
                            })
                          }
                        >
                          <Stamp
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        {esFacturas ? (
          <div
            className="w-full shrink-0 border-t border-border px-2 py-2"
            role="region"
            aria-label="Indicadores del listado visible"
          >
            <div className="grid w-full grid-cols-3 gap-2">
              <div className={cn("finanzas-resumen-tarjeta", "min-w-0 w-full")}>
                <span className="w-full text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
                  CANT. COMPROBANTES
                </span>
                <span className="w-full text-sm font-medium tabular-nums leading-tight">
                  {indicadores.cantComprobantes.toLocaleString("es-AR")}
                </span>
              </div>
              <div
                className={cn("finanzas-resumen-tarjeta", "min-w-0 w-full")}
                title="Ventas menos notas de crédito (sin rechazados)"
              >
                <span className="w-full text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
                  TOTAL VENDIDO
                </span>
                <span className="w-full text-sm font-medium tabular-nums leading-tight">
                  ${fmtPrecio(indicadores.totalVendido)}
                </span>
              </div>
              <div className={cn("finanzas-resumen-tarjeta", "min-w-0 w-full")}>
                <span className="w-full text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
                  PENDIENTE DE COBRO
                </span>
                <span className="w-full text-sm font-medium tabular-nums leading-tight">
                  ${fmtPrecio(indicadores.pendienteDeCobro)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <FacturaComprobanteDetalleModal
        open={detalleId != null}
        onOpenChange={(open) => {
          if (!open) setDetalleId(null);
        }}
        comprobanteId={detalleId}
      />
      <FacturaComprobanteCobrosModal
        open={cobrosId != null}
        onOpenChange={(open) => {
          if (!open) {
            setCobrosId(null);
            setCobrosNro("");
            setCobrosEsNc(false);
          }
        }}
        comprobanteId={cobrosId}
        nroComprobante={cobrosNro}
        esNotaCredito={cobrosEsNc}
      />
      <FacturaComprobantePdfAccionModal
        open={pdfId != null}
        onOpenChange={(open) => {
          if (!open) {
            setPdfId(null);
            setPdfNro("");
          }
        }}
        comprobanteId={pdfId}
        nroComprobante={pdfNro}
      />
      {esFacturas ? (
        <CrearEnvioWizardModal
          open={envioWizardOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEnvioWizardOpen(false);
              setEnvioBorrador(null);
            }
          }}
          borrador={envioBorrador}
          clientesCatalogo={envioCatalogo.clientes}
          direcciones={envioCatalogo.direcciones}
          sucursales={envioCatalogo.sucursales}
          onCatalogoChanged={() => {
            void recargarCatalogoEnvio();
          }}
          onSuccess={() => {
            setEnvioWizardOpen(false);
            setEnvioBorrador(null);
            router.refresh();
          }}
        />
      ) : null}
      <FiltroRangoFechasCalendarioModal
        open={rangoModalOpen}
        onOpenChange={setRangoModalOpen}
        fechaDesde={rangoDesde}
        fechaHasta={rangoHasta}
        onAplicarRango={(desde, hasta) => {
          setRangoDesde(desde);
          setRangoHasta(hasta);
          setPeriodo(PERIODO_RANGO);
        }}
        onLimpiar={limpiarPeriodo}
      />
      <Dialog
        open={modalAccion.open}
        onOpenChange={(next) => {
          if (!next && busyId == null) setModalAccion({ open: false });
        }}
      >
        <AppModal
          title={
            modalAccion.open && modalAccion.kind === "convertir"
              ? "CONVERTIR EN FISCAL"
              : "BORRAR COMPROBANTE"
          }
          size="sm"
          actions={
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busyId != null}
                onClick={() => setModalAccion({ open: false })}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={busyId != null}
                onClick={() => void confirmarModalAccion()}
              >
                {busyId != null ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                {busyId != null
                  ? modalAccion.open && modalAccion.kind === "convertir"
                    ? "Emitiendo…"
                    : "Borrando…"
                  : modalAccion.open && modalAccion.kind === "convertir"
                    ? "Convertir"
                    : "Borrar"}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-foreground">
            {modalAccion.open && modalAccion.kind === "convertir"
              ? busyId != null
                ? "Consultando ARCA para obtener el CAE. Puede tardar hasta un minuto."
                : `Se emitirá un comprobante fiscal con fecha de hoy y se eliminará el no fiscal ${modalAccion.item.nroComprobante || ""}.`
              : `Se eliminará el comprobante ${modalAccion.open ? modalAccion.item.nroComprobante : ""}.`}
          </p>
        </AppModal>
      </Dialog>
    </ClassicFilteredTableLayout>
  );
}
