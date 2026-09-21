"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, FileText, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  consultarFacturaComprobanteArcaAction,
  emitirNotaCreditoFacturaAction,
  obtenerFacturaComprobantePdfAction,
} from "@/actions/factura";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_DATE_RANGE_TRIGGER_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FiltroIndividualContainer,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import FiltroRangoFechasCalendarioModal from "@/components/shared/FiltroRangoFechasCalendarioModal";
import { Button } from "@/components/ui/button";
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
  FACTURA_TIPO_LABELS,
  esFacturaTipoFiscal,
  type FacturaComprobanteListItem,
  type FacturaSucursalFiltroOption,
} from "@/lib/factura";
import { imprimirPdfFacturaComprobante } from "@/lib/facturaComprobantePdfClient";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
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

const FILTRO_SUCURSAL_TODAS = "todas";
const PERIODO_TODOS = "todos";

type PeriodoFiltro = "hoy" | "mes" | "todos" | "rango";

function esPeriodoFiltro(value: string): value is PeriodoFiltro {
  return value === "hoy" || value === "mes" || value === "todos" || value === "rango";
}

type Props = {
  items: FacturaComprobanteListItem[];
  sucursales: FacturaSucursalFiltroOption[];
  variant: "facturas" | "presupuestos";
};

export default function FacturaListadoPageClient({
  items,
  sucursales,
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
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(PERIODO_TODOS);
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroPendiente, setFiltroPendiente] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [openRangoFechas, setOpenRangoFechas] = useState(false);

  const sucursalCodigos = useMemo(
    () => new Set(sucursales.map((s) => s.codigo)),
    [sucursales]
  );
  useAplicarSucursalPreferidaSiVacia(
    filtroSucursal === FILTRO_SUCURSAL_TODAS ? FILTRO_SUCURSAL_TODAS : filtroSucursal,
    setFiltroSucursal,
    (codigo) => sucursalCodigos.has(codigo)
  );

  const hoyIso = dateToIsoYmdArgentina(new Date());
  const rangoFechasLabel = (() => {
    if (filtroFechaDesde && filtroFechaHasta) {
      return `${formatIsoYmdDdMmYyyyArgentina(filtroFechaDesde)} — ${formatIsoYmdDdMmYyyyArgentina(filtroFechaHasta)}`;
    }
    if (filtroFechaDesde) {
      return `Desde ${formatIsoYmdDdMmYyyyArgentina(filtroFechaDesde)}`;
    }
    if (filtroFechaHasta) {
      return `Hasta ${formatIsoYmdDdMmYyyyArgentina(filtroFechaHasta)}`;
    }
    return "RANGO PERSONALIZADO";
  })();

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (periodo === "hoy" && item.fechaIso !== hoyIso) return false;
      if (periodo === "mes" && item.fechaIso.slice(0, 7) !== hoyIso.slice(0, 7)) {
        return false;
      }
      if (periodo === "rango") {
        if (filtroFechaDesde && item.fechaIso < filtroFechaDesde) return false;
        if (filtroFechaHasta && item.fechaIso > filtroFechaHasta) return false;
      }
      if (
        filtroSucursal &&
        filtroSucursal !== FILTRO_SUCURSAL_TODAS &&
        !item.sucursalCodigos.includes(filtroSucursal)
      ) {
        return false;
      }
      if (filtroPendiente === "si" && item.saldoPendiente == null) return false;
      if (filtroPendiente === "no" && item.saldoPendiente != null) return false;
      if (!qDebounced.trim()) return true;
      return matchByMultiTerm(
        [
          item.cliente,
          item.nroComprobante,
          item.cae ?? "",
          FACTURA_TIPO_LABELS[item.tipo],
          item.letra ?? "",
          item.saldoPendiente != null ? String(item.saldoPendiente) : "",
          item.diasParaVencer != null ? String(item.diasParaVencer) : "",
        ],
        qDebounced
      );
    });
  }, [
    items,
    qDebounced,
    periodo,
    hoyIso,
    filtroFechaDesde,
    filtroFechaHasta,
    filtroSucursal,
    filtroPendiente,
  ]);

  function onPeriodoChange(value: string) {
    if (!esPeriodoFiltro(value)) return;
    setPeriodo(value);
    if (value !== "rango") {
      setFiltroFechaDesde("");
      setFiltroFechaHasta("");
      return;
    }
    setOpenRangoFechas(true);
  }

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
    setPeriodo(PERIODO_TODOS);
    setFiltroSucursal("");
    setFiltroPendiente("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
  }

  async function handlePdf(id: string) {
    setBusyId(id);
    try {
      const res = await obtenerFacturaComprobantePdfAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await imprimirPdfFacturaComprobante(res.data);
    } finally {
      setBusyId(null);
    }
  }

  async function handleNc(id: string) {
    setBusyId(id);
    try {
      const res = await emitirNotaCreditoFacturaAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.cae ? `NC CAE ${res.data.cae}` : "Nota de crédito emitida.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleConsultar(id: string) {
    setBusyId(id);
    try {
      const res = await consultarFacturaComprobanteArcaAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.cae ? `CAE ${res.data.cae}` : "Consulta ARCA ok.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const esFacturas = variant === "facturas";
  const colSpan = esFacturas ? 10 : 5;

  return (
    <ClassicFilteredTableLayout
      title="COMPROBANTES"
      subtitle={esFacturas ? "Lista Comprobantes" : "Presupuestos"}
      contentWidth="full"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilaFiltrosDesplegables>
              <FiltroIndividualContainer
                activo={periodo !== PERIODO_TODOS}
                onLimpiar={() => {
                  setPeriodo(PERIODO_TODOS);
                  setFiltroFechaDesde("");
                  setFiltroFechaHasta("");
                }}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={periodo} onValueChange={onPeriodoChange}>
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                    <SelectValue placeholder="PERIODO DE TIEMPO" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value="hoy">HOY</SelectItem>
                    <SelectItem value="mes">ESTE MES</SelectItem>
                    <SelectItem value="todos">TODO</SelectItem>
                    <SelectItem value="rango">RANGO PERSONALIZADO</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              {periodo === "rango" ? (
                <FiltroIndividualContainer
                  activo={Boolean(filtroFechaDesde || filtroFechaHasta)}
                  onLimpiar={() => {
                    setFiltroFechaDesde("");
                    setFiltroFechaHasta("");
                  }}
                  className={FILTER_SELECT_WRAPPER_CLASS}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(FILTER_DATE_RANGE_TRIGGER_CLASS, "h-10")}
                    onClick={() => setOpenRangoFechas(true)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 truncate">
                      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{rangoFechasLabel}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  </Button>
                </FiltroIndividualContainer>
              ) : null}
              <FiltroIndividualContainer
                activo={Boolean(filtroSucursal) && filtroSucursal !== FILTRO_SUCURSAL_TODAS}
                onLimpiar={() => setFiltroSucursal("")}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
                  <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
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
              {esFacturas ? (
                <FiltroIndividualContainer
                  activo={filtroPendiente !== ""}
                  onLimpiar={() => setFiltroPendiente("")}
                  className={FILTER_SELECT_WRAPPER_CLASS}
                >
                  <Select
                    value={filtroPendiente}
                    onValueChange={setFiltroPendiente}
                  >
                    <SelectTrigger className={SELECT_TRIGGER_FILTER_CLASS}>
                      <SelectValue placeholder="PENDIENTE PAGO" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      <SelectItem value="si">SI</SelectItem>
                      <SelectItem value="no">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
              ) : null}
            </FilaFiltrosDesplegables>
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <FiltroBusquedaInput
                  id={
                    esFacturas
                      ? "filtro-facturas-busqueda"
                      : "filtro-presupuestos-busqueda"
                  }
                  placeholder="BUSCAR POR CLIENTE, N°, CAE…"
                  value={q}
                  onChange={handleQChange}
                  isDebouncing={isDebouncing}
                  inputRef={searchRef}
                />
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {itemsFiltrados.length.toLocaleString("es-AR")} REGISTRO
                {itemsFiltrados.length === 1 ? "" : "S"}
              </span>
            </div>
            <FiltroRangoFechasCalendarioModal
              open={openRangoFechas}
              onOpenChange={setOpenRangoFechas}
              fechaDesde={filtroFechaDesde}
              fechaHasta={filtroFechaHasta}
              onAplicarRango={(desde, hasta) => {
                setFiltroFechaDesde(desde);
                setFiltroFechaHasta(hasta);
                setPeriodo("rango");
              }}
              onLimpiar={() => {
                setFiltroFechaDesde("");
                setFiltroFechaHasta("");
                setPeriodo(PERIODO_TODOS);
              }}
            />
          </FilterBar>
        }
    >
      <div className="contenedor-tabla-gestion min-h-0 flex-1">
        <Table variant="compact" className="tabla-gestion-compacta w-full">
          <TableHeader>
            <TableRow>
              <TableHead>FECHA</TableHead>
              {esFacturas ? <TableHead>TIPO</TableHead> : null}
              {esFacturas ? <TableHead className="text-center">LETRA</TableHead> : null}
              <TableHead>N°</TableHead>
              <TableHead>CLIENTE</TableHead>
              <TableHead className="text-right">TOTAL</TableHead>
              {esFacturas ? <TableHead>CAE</TableHead> : null}
              {esFacturas ? (
                <TableHead className="tabla-bloque-secundario-head-divider text-right">
                  SALDO PEND.
                </TableHead>
              ) : null}
              {esFacturas ? (
                <TableHead className="tabla-bloque-secundario-head text-center">
                  DÍAS P/ VENC.
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
                  <TableCell className="tabular-nums">
                    {formatIsoYmdDdMmYyyyArgentina(item.fechaIso)}
                  </TableCell>
                  {esFacturas ? (
                    <TableCell>{FACTURA_TIPO_LABELS[item.tipo]}</TableCell>
                  ) : null}
                  {esFacturas ? (
                    <TableCell className="text-center">{item.letra ?? "—"}</TableCell>
                  ) : null}
                  <TableCell className="tabular-nums">
                    {item.nroComprobante || "—"}
                  </TableCell>
                  <TableCell className="uppercase">{item.cliente}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtPrecio(item.impTotal)}
                  </TableCell>
                  {esFacturas ? (
                    <TableCell className="tabular-nums">{item.cae ?? "—"}</TableCell>
                  ) : null}
                  {esFacturas ? (
                    <TableCell className="celda-datos text-right tabular-nums tabla-bloque-secundario-cell-divider">
                      {item.saldoPendiente != null
                        ? `$${fmtPrecio(item.saldoPendiente)}`
                        : fmtCelda("")}
                    </TableCell>
                  ) : null}
                  {esFacturas ? (
                    <TableCell
                      className={cn(
                        "celda-datos text-center tabular-nums tabla-bloque-secundario-cell",
                        item.diasParaVencer != null &&
                          item.diasParaVencer < 0 &&
                          "text-destructive"
                      )}
                    >
                      {item.diasParaVencer != null
                        ? String(item.diasParaVencer)
                        : fmtCelda("")}
                    </TableCell>
                  ) : null}
                  <TableCell className="tabla-bloque-secundario-cell-divider">
                    <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                        title="PDF"
                        aria-label={`PDF ${item.nroComprobante}`}
                        disabled={busyId === item.id}
                        onClick={() => void handlePdf(item.id)}
                      >
                        <FileText className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      {esFacturas && item.puedeNc ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Nota de crédito"
                          aria-label={`Nota de crédito ${item.nroComprobante}`}
                          disabled={busyId === item.id}
                          onClick={() => void handleNc(item.id)}
                        >
                          <Undo2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      ) : null}
                      {esFacturas &&
                      esFacturaTipoFiscal(item.tipo) &&
                      !item.cae ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Consultar ARCA"
                          aria-label={`Consultar ARCA ${item.nroComprobante}`}
                          disabled={busyId === item.id}
                          onClick={() => void handleConsultar(item.id)}
                        >
                          <RefreshCw className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
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
    </ClassicFilteredTableLayout>
  );
}
