"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Eye, FileText, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  consultarFacturaComprobanteArcaAction,
  emitirNotaCreditoFacturaAction,
  obtenerFacturaComprobantePdfAction,
} from "@/actions/factura";
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
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
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
  MENSAJE_PERSONAL_SESION_REQUERIDO,
  esFacturaTipoFiscal,
  esFacturaTipoVenta,
  resumenIndicadoresListaComprobantes,
  type FacturaComprobanteListItem,
  type FacturaSucursalFiltroOption,
  type FacturaUsuarioFiltroOption,
} from "@/lib/factura";
import { imprimirPdfFacturaComprobante } from "@/lib/facturaComprobantePdfClient";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  formatHhMmArgentina,
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
import { leerUsuarioSesion } from "@/lib/usuarioSesion";

const FILTRO_SUCURSAL_TODAS = "todas";
const FILTRO_USUARIO_TODOS = "todos";
const PERIODO_HOY = "hoy";
const PERIODO_TODOS = "todos";

type PeriodoFiltro = "hoy" | "ayer" | "mes" | "todos";

function esPeriodoFiltro(value: string): value is PeriodoFiltro {
  return value === "hoy" || value === "ayer" || value === "mes" || value === "todos";
}

type Props = {
  items: FacturaComprobanteListItem[];
  sucursales: FacturaSucursalFiltroOption[];
  usuarios: FacturaUsuarioFiltroOption[];
  variant: "facturas" | "presupuestos";
};

export default function FacturaListadoPageClient({
  items,
  sucursales,
  usuarios,
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
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroPendiente, setFiltroPendiente] = useState("");
  const [cobrosId, setCobrosId] = useState<string | null>(null);
  const [cobrosNro, setCobrosNro] = useState("");
  const [detalleId, setDetalleId] = useState<string | null>(null);

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
  const ayerIso = addDaysToIsoYmdArgentina(hoyIso, -1);

  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (periodo === "hoy" && item.fechaIso !== hoyIso) return false;
      if (periodo === "ayer" && item.fechaIso !== ayerIso) return false;
      if (periodo === "mes" && item.fechaIso.slice(0, 7) !== hoyIso.slice(0, 7)) {
        return false;
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
          item.sucursalNombres.join(" "),
          item.usuarioNombre,
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
    ayerIso,
    filtroSucursal,
    filtroUsuario,
    filtroPendiente,
  ]);

  function onPeriodoChange(value: string) {
    if (!esPeriodoFiltro(value)) return;
    setPeriodo(value);
  }

  function limpiarFiltros() {
    setQ("");
    setQDebounced("");
    setPeriodo(PERIODO_HOY);
    setFiltroSucursal("");
    setFiltroUsuario("");
    setFiltroPendiente("");
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
    const personalId = leerUsuarioSesion()?.idPersonal;
    if (personalId == null) {
      toast.error(MENSAJE_PERSONAL_SESION_REQUERIDO);
      return;
    }
    setBusyId(id);
    try {
      const res = await emitirNotaCreditoFacturaAction({ id, personalId });
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
  const colSpan = esFacturas ? 10 : 7;
  const indicadores = useMemo(
    () => resumenIndicadoresListaComprobantes(itemsFiltrados),
    [itemsFiltrados]
  );

  return (
    <ClassicFilteredTableLayout
      title="COMPROBANTES"
      subtitle={esFacturas ? "Lista Comprobantes" : "Presupuestos"}
      contentWidth="full"
      filters={
        <FilterBar className="filtros-contenedor-tienda bg-card">
            <FilaFiltrosDesplegables columnas={4}>
              <FiltroIndividualContainer
                activo={periodo !== PERIODO_HOY}
                onLimpiar={() => setPeriodo(PERIODO_HOY)}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select value={periodo} onValueChange={onPeriodoChange}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="PERIODO DE TIEMPO" />
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
                  activo={filtroPendiente !== ""}
                  onLimpiar={() => setFiltroPendiente("")}
                  className={FILTER_SELECT_WRAPPER_CLASS}
                >
                  <Select
                    value={filtroPendiente}
                    onValueChange={setFiltroPendiente}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
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
          </FilterBar>
        }
    >
      <div className="contenedor-tabla-gestion contenedor-tabla-gestion--pie-fijo min-h-0 flex-1">
        <div className="contenedor-tabla-gestion--pie-fijo-scroll">
        <Table variant="compact" className="tabla-gestion-compacta w-full">
          <TableHeader>
            <TableRow>
              <TableHead>FECHA</TableHead>
              {esFacturas ? <TableHead>TIPO</TableHead> : null}
              <TableHead>N°</TableHead>
              <TableHead>CLIENTE</TableHead>
              <TableHead>SUCURSAL</TableHead>
              <TableHead>PERSONAL</TableHead>
              <TableHead className="tabla-bloque-secundario-head-divider text-right">
                TOTAL
              </TableHead>
              {esFacturas ? (
                <TableHead className="tabla-bloque-secundario-head text-right">
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
                    <span className="flex flex-col items-start leading-tight">
                      <span>{formatIsoYmdDdMmYyyyArgentina(item.fechaIso)}</span>
                      <span className="pl-4">
                        {formatHhMmArgentina(new Date(item.createdAtIso))}
                      </span>
                    </span>
                  </TableCell>
                  {esFacturas ? (
                    <TableCell>{FACTURA_TIPO_LABELS[item.tipo]}</TableCell>
                  ) : null}
                  <TableCell className="tabular-nums">
                    {item.nroComprobante || "—"}
                  </TableCell>
                  <TableCell className="uppercase">{item.cliente}</TableCell>
                  <TableCell className="uppercase">
                    {fmtCelda(item.sucursalNombres.join(" · "))}
                  </TableCell>
                  <TableCell className="uppercase">
                    {fmtCelda(item.usuarioNombre)}
                  </TableCell>
                  <TableCell className="celda-datos text-right tabular-nums tabla-bloque-secundario-cell-divider">
                    ${fmtPrecio(item.impTotal)}
                  </TableCell>
                  {esFacturas ? (
                    <TableCell className="celda-datos text-right tabular-nums tabla-bloque-secundario-cell">
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
                        title="Ver"
                        aria-label={`Ver ${item.nroComprobante}`}
                        onClick={() => setDetalleId(item.id)}
                      >
                        <Eye className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      </Button>
                      {esFacturas && esFacturaTipoVenta(item.tipo) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Cobros"
                          aria-label={`Cobros ${item.nroComprobante}`}
                          onClick={() => {
                            setCobrosId(item.id);
                            setCobrosNro(item.nroComprobante);
                          }}
                        >
                          <CircleDollarSign
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
          }
        }}
        comprobanteId={cobrosId}
        nroComprobante={cobrosNro}
      />
    </ClassicFilteredTableLayout>
  );
}
