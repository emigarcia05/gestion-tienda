"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Eye, FileText, Package } from "lucide-react";
import { toast } from "sonner";
import {
  buscarClientesFacturaAction,
  obtenerCuentaCorrienteClienteAction,
} from "@/actions/factura";
import FilterBar, {
  FILTER_COUNT_CLASS,
  FILTER_SELECT_WRAPPER_CLASS,
  FilaFiltrosDesplegables,
  FilterRowSearch,
  FilterRowSelection,
  FiltroIndividualContainer,
  INPUT_FILTER_CLASS,
  LimpiarFiltrosButton,
  SELECT_TRIGGER_FILTER_CLASS,
} from "@/components/FilterBar";
import FacturaCobroDetalleModal from "@/components/facturacion/FacturaCobroDetalleModal";
import FacturaComprobanteDetalleModal from "@/components/facturacion/FacturaComprobanteDetalleModal";
import FacturaComprobantePdfAccionModal from "@/components/facturacion/FacturaComprobantePdfAccionModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import FiltroRangoFechasCalendarioModal from "@/components/shared/FiltroRangoFechasCalendarioModal";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  etiquetaClienteListado,
  nombrePintorAsociadoCliente,
  type ClienteListaItem,
} from "@/lib/envios";
import {
  CUENTA_CORRIENTE_MOVIMIENTO_LABELS,
  CUENTA_CORRIENTE_PRODUCTO_TIPO_LABELS,
  FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS,
  FACTURA_BUSQUEDA_CLIENTES_TAKE,
  filtrarMovimientosCuentaCorriente,
  resumenIndicadoresCuentaCorriente,
  type CuentaCorrienteClienteMovimiento,
  type CuentaCorrienteProductoLinea,
  type FiltroCondicionPagoCuentaCorriente,
  type FiltroPeriodoCuentaCorriente,
  type FiltroTipoCuentaCorriente,
} from "@/lib/factura";
import {
  formatHhMmArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtCelda, fmtNumero, fmtPrecio } from "@/lib/format";
import { matchByMultiTerm } from "@/lib/busqueda";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  TYPEAHEAD_LISTBOX_ANCHOR_CLASS,
  TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS,
  TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS,
  TYPEAHEAD_LISTBOX_CELL_CLASS,
  TYPEAHEAD_LISTBOX_HEADER_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ROW_CLIENTES_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS,
  TYPEAHEAD_LISTBOX_UL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const COL_SPAN = 5;
const COL_SPAN_PRODUCTOS = 4;
const FILTRO_CC_TODOS = "todos";
const PERIODO_RANGO = "rango";
type VistaCuentaCorriente = "comprobantes" | "productos";

const FILA_BUSQUEDA_CLIENTES_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem] items-center justify-items-stretch gap-1.5 px-2";

export default function FacturaCuentaCorrientePageClient() {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const clienteIdRef = useRef<string | null>(null);
  const [sugerencias, setSugerencias] = useState<ClienteListaItem[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<
    CuentaCorrienteClienteMovimiento[]
  >([]);
  const [productos, setProductos] = useState<CuentaCorrienteProductoLinea[]>(
    []
  );
  const [vista, setVista] = useState<VistaCuentaCorriente>("comprobantes");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const [qDescDebounced, setQDescDebounced] = useState("");
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [cobroId, setCobroId] = useState<string | null>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [pdfNro, setPdfNro] = useState("");
  const [periodo, setPeriodo] =
    useState<FiltroPeriodoCuentaCorriente>(FILTRO_CC_TODOS);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [rangoModalOpen, setRangoModalOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] =
    useState<FiltroTipoCuentaCorriente>(FILTRO_CC_TODOS);
  const [filtroCondicionPago, setFiltroCondicionPago] =
    useState<FiltroCondicionPagoCuentaCorriente>(FILTRO_CC_TODOS);

  const fetchSugerencias = useCallback(async (value: string) => {
    if (clienteIdRef.current != null) return;
    const qTrim = value.trim();
    if (qTrim.length < FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS) {
      setSugerencias([]);
      setLoadingClientes(false);
      return;
    }
    setLoadingClientes(true);
    const res = await buscarClientesFacturaAction({
      q: qTrim,
      take: FACTURA_BUSQUEDA_CLIENTES_TAKE,
    });
    if (clienteIdRef.current != null) {
      setLoadingClientes(false);
      return;
    }
    setLoadingClientes(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron buscar clientes.");
      setSugerencias([]);
      return;
    }
    setSugerencias(res.data.items);
    setHighlight(0);
  }, []);

  const { q, setQ, handleQChange, isDebouncing, ref: searchRef } =
    useFiltrosConBusqueda({
      qActual: "",
      debounceMs: 300,
      onDebouncedSearch: (value) => {
        void fetchSugerencias(value);
      },
    });
  const {
    q: qDesc,
    setQ: setQDesc,
    handleQChange: handleQDescChange,
    isDebouncing: isDebouncingDesc,
    ref: searchDescRef,
  } = useFiltrosConBusqueda({
    qActual: qDescDebounced,
    debounceMs: 300,
    onDebouncedSearch: setQDescDebounced,
  });

  const puedeBuscar = q.trim().length >= FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS;

  const movimientosFiltrados = useMemo(
    () =>
      filtrarMovimientosCuentaCorriente(movimientos, {
        periodo,
        rangoDesde,
        rangoHasta,
        tipo: filtroTipo,
        condicionPago: filtroCondicionPago,
      }),
    [movimientos, periodo, rangoDesde, rangoHasta, filtroTipo, filtroCondicionPago]
  );

  const indicadores = useMemo(
    () => resumenIndicadoresCuentaCorriente(movimientosFiltrados),
    [movimientosFiltrados]
  );

  const marcasOpciones = useMemo(() => {
    const set = new Set<string>();
    for (const p of productos) {
      const m = p.marca.trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es-AR"));
  }, [productos]);

  const rubrosOpciones = useMemo(() => {
    const set = new Set<string>();
    for (const p of productos) {
      const r = p.rubro.trim();
      if (r) set.add(r);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es-AR"));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (filtroMarca && p.marca.trim() !== filtroMarca) return false;
      if (filtroRubro && p.rubro.trim() !== filtroRubro) return false;
      if (!qDescDebounced.trim()) return true;
      return matchByMultiTerm([p.descripcion], qDescDebounced);
    });
  }, [productos, filtroMarca, filtroRubro, qDescDebounced]);

  const esVistaProductos = vista === "productos";
  const filasVisibles = esVistaProductos
    ? productosFiltrados.length
    : movimientosFiltrados.length;

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const wrap = wrapRef.current;
      if (!wrap || !(e.target instanceof Node) || wrap.contains(e.target)) {
        return;
      }
      setAbierto(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  async function cargarLedger(id: string) {
    setLoadingLedger(true);
    const res = await obtenerCuentaCorrienteClienteAction({ clienteId: id });
    setLoadingLedger(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cargar la cuenta corriente.");
      setMovimientos([]);
      setProductos([]);
      return;
    }
    setMovimientos(res.data.movimientos);
    setProductos(res.data.productos);
  }

  function aplicarCliente(item: ClienteListaItem) {
    clienteIdRef.current = item.id;
    setClienteId(item.id);
    setQ(etiquetaClienteListado(item));
    setAbierto(false);
    setSugerencias([]);
    void cargarLedger(item.id);
  }

  function limpiarPeriodo() {
    setPeriodo(FILTRO_CC_TODOS);
    setRangoDesde("");
    setRangoHasta("");
  }

  function onPeriodoChange(value: string) {
    if (value === PERIODO_RANGO) {
      setRangoModalOpen(true);
      return;
    }
    if (value !== FILTRO_CC_TODOS) return;
    setRangoDesde("");
    setRangoHasta("");
    setPeriodo(FILTRO_CC_TODOS);
  }

  function limpiarFiltros() {
    clienteIdRef.current = null;
    setQ("");
    setClienteId(null);
    setMovimientos([]);
    setProductos([]);
    setSugerencias([]);
    setAbierto(false);
    limpiarPeriodo();
    setFiltroTipo(FILTRO_CC_TODOS);
    setFiltroCondicionPago(FILTRO_CC_TODOS);
    setFiltroMarca("");
    setFiltroRubro("");
    setQDesc("");
    setQDescDebounced("");
  }

  function onQChange(next: string) {
    const value = next.toLocaleUpperCase("es-AR");
    if (clienteId != null) {
      clienteIdRef.current = null;
      setClienteId(null);
      setMovimientos([]);
      setProductos([]);
    }
    handleQChange(value);
    if (value.trim().length < FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS) {
      setAbierto(false);
      setSugerencias([]);
      setLoadingClientes(false);
      return;
    }
    setAbierto(true);
  }

  const vacioMensaje =
    clienteId == null
      ? "BUSCÁ UN CLIENTE."
      : loadingLedger
        ? "CARGANDO…"
        : esVistaProductos
          ? "NO HAY PRODUCTOS."
          : "NO HAY MOVIMIENTOS.";

  return (
    <>
      <ClassicFilteredTableLayout
        title="Clientes"
        subtitle="Cuenta Corrientes"
        contentWidth="full"
        actions={
          <>
            <ToolbarActionButton
              label="DETALLE COMPROBANTE"
              icon={<FileText />}
              aria-pressed={!esVistaProductos}
              className="w-full justify-start"
              onClick={() => setVista("comprobantes")}
            />
            <ToolbarActionButton
              label="DETALLE PRODUCTOS"
              icon={<Package />}
              aria-pressed={esVistaProductos}
              className="w-full justify-start"
              onClick={() => setVista("productos")}
            />
          </>
        }
        filters={
          <div className="filtros-doble-bloque-compacto">
          <FilterBar className="filtros-contenedor-tienda bg-card">
            <div className="flex items-center gap-3">
              <FilterRowSearch className="flex-1">
                <div
                  ref={wrapRef}
                  className={cn(
                    TYPEAHEAD_LISTBOX_ANCHOR_CLASS,
                    abierto &&
                      puedeBuscar &&
                      TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS
                  )}
                >
                  <Input
                    ref={searchRef}
                    id="filtro-cuenta-corriente-cliente"
                    type="text"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={abierto && puedeBuscar}
                    aria-controls={listboxId}
                    placeholder="BUSCAR CLIENTE..."
                    value={q}
                    onChange={(e) => onQChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" && sugerencias.length > 0) {
                        e.preventDefault();
                        setAbierto(true);
                        setHighlight((h) => (h + 1) % sugerencias.length);
                        return;
                      }
                      if (e.key === "ArrowUp" && sugerencias.length > 0) {
                        e.preventDefault();
                        setAbierto(true);
                        setHighlight(
                          (h) =>
                            (h - 1 + sugerencias.length) % sugerencias.length
                        );
                        return;
                      }
                      if (e.key === "Enter" && sugerencias[highlight]) {
                        e.preventDefault();
                        aplicarCliente(sugerencias[highlight]!);
                        return;
                      }
                      if (e.key === "Escape") {
                        setAbierto(false);
                      }
                    }}
                    onFocus={() => {
                      if (puedeBuscar) setAbierto(true);
                    }}
                    className={cn("w-full", INPUT_FILTER_CLASS)}
                  />
                  {abierto && puedeBuscar ? (
                    <div
                      id={listboxId}
                      role="listbox"
                      className={cn(
                        TYPEAHEAD_LISTBOX_PANEL_CLASS,
                        TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS,
                        TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS
                      )}
                    >
                      {loadingClientes || isDebouncing ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          Buscando…
                        </p>
                      ) : sugerencias.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          Sin resultados.
                        </p>
                      ) : (
                        <div className={TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS}>
                          <div
                            className={cn(
                              FILA_BUSQUEDA_CLIENTES_GRID,
                              TYPEAHEAD_LISTBOX_HEADER_CLASS
                            )}
                            aria-hidden
                          >
                            <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                              CLIENTE
                            </span>
                            <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                              PINTOR
                            </span>
                            <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                              SALDO
                            </span>
                          </div>
                          <ul
                            className={cn(
                              TYPEAHEAD_LISTBOX_UL_CLASS,
                              "flex-none overflow-visible"
                            )}
                          >
                            {sugerencias.map((item, idx) => {
                              const activo = idx === highlight;
                              return (
                                <li
                                  key={item.id}
                                  role="option"
                                  aria-selected={activo}
                                >
                                  <div
                                    role="button"
                                    tabIndex={-1}
                                    className={cn(
                                      FILA_BUSQUEDA_CLIENTES_GRID,
                                      TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS,
                                      TYPEAHEAD_LISTBOX_OPTION_ROW_CLIENTES_CLASS,
                                      activo &&
                                        TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS
                                    )}
                                    onMouseEnter={() => setHighlight(idx)}
                                    onPointerDown={(e) => e.preventDefault()}
                                    onClick={() => aplicarCliente(item)}
                                  >
                                    <span
                                      className={cn(
                                        TYPEAHEAD_LISTBOX_CELL_CLASS,
                                        "text-foreground"
                                      )}
                                    >
                                      {etiquetaClienteListado(item)}
                                    </span>
                                    <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                                      {fmtCelda(
                                        nombrePintorAsociadoCliente(item) ?? ""
                                      )}
                                    </span>
                                    <span
                                      className={cn(
                                        TYPEAHEAD_LISTBOX_CELL_CLASS,
                                        "tabular-nums text-foreground"
                                      )}
                                    >
                                      {`$${fmtPrecio(item.saldoCuentaCorriente)}`}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </FilterRowSearch>
              <LimpiarFiltrosButton onClick={limpiarFiltros} />
              <span className={cn(FILTER_COUNT_CLASS, "ml-auto")}>
                {filasVisibles.toLocaleString("es-AR")}{" "}
                {esVistaProductos
                  ? filasVisibles === 1
                    ? "PRODUCTO"
                    : "PRODUCTOS"
                  : `MOVIMIENTO${filasVisibles === 1 ? "" : "S"}`}
              </span>
            </div>
          </FilterBar>
          <FilterBar className="filtros-contenedor-tienda bg-card">
            {esVistaProductos ? (
              <FilterRowSelection className="flex-nowrap">
                <FiltroIndividualContainer
                  activo={Boolean(filtroMarca)}
                  onLimpiar={() => setFiltroMarca("")}
                  className={FILTER_SELECT_WRAPPER_CLASS}
                >
                  <Select
                    value={filtroMarca || undefined}
                    onValueChange={setFiltroMarca}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                      <SelectValue placeholder="MARCA" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      {marcasOpciones.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m.toLocaleUpperCase("es-AR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FiltroIndividualContainer
                  activo={Boolean(filtroRubro)}
                  onLimpiar={() => setFiltroRubro("")}
                  className={FILTER_SELECT_WRAPPER_CLASS}
                >
                  <Select
                    value={filtroRubro || undefined}
                    onValueChange={setFiltroRubro}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                      <SelectValue placeholder="RUBRO" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content-filtro"
                      position="popper"
                      side="bottom"
                      align="start"
                    >
                      {rubrosOpciones.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.toLocaleUpperCase("es-AR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FiltroIndividualContainer>
                <FilterRowSearch className="flex-1">
                  <FiltroBusquedaInput
                    id="filtro-cuenta-corriente-descripcion"
                    placeholder="BUSCAR POR DESCRIPCIÓN…"
                    value={qDesc}
                    onChange={handleQDescChange}
                    isDebouncing={isDebouncingDesc}
                    inputRef={searchDescRef}
                  />
                </FilterRowSearch>
              </FilterRowSelection>
            ) : (
            <FilaFiltrosDesplegables columnas={4}>
              <FiltroIndividualContainer
                activo={periodo !== FILTRO_CC_TODOS}
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
                      <SelectValue placeholder="FECHA" />
                    )}
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_CC_TODOS}>TODO</SelectItem>
                    <SelectItem
                      value={PERIODO_RANGO}
                      onPointerDown={() => {
                        queueMicrotask(() => setRangoModalOpen(true));
                      }}
                    >
                      RANGO PERSONALIZADO
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={filtroTipo !== FILTRO_CC_TODOS}
                onLimpiar={() => setFiltroTipo(FILTRO_CC_TODOS)}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select
                  value={filtroTipo}
                  onValueChange={(value) => {
                    if (
                      value === FILTRO_CC_TODOS ||
                      value === "venta" ||
                      value === "nota_credito" ||
                      value === "cobro"
                    ) {
                      setFiltroTipo(value);
                    }
                  }}
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="TIPO COMPROBANTE" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_CC_TODOS}>TODO</SelectItem>
                    <SelectItem value="venta">VENTAS</SelectItem>
                    <SelectItem value="nota_credito">NOTA CRÉDITO</SelectItem>
                    <SelectItem value="cobro">COBROS</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
              <FiltroIndividualContainer
                activo={filtroCondicionPago !== FILTRO_CC_TODOS}
                onLimpiar={() => setFiltroCondicionPago(FILTRO_CC_TODOS)}
                className={FILTER_SELECT_WRAPPER_CLASS}
              >
                <Select
                  value={filtroCondicionPago}
                  onValueChange={(value) => {
                    if (
                      value === FILTRO_CC_TODOS ||
                      value === "pendiente" ||
                      value === "pagado"
                    ) {
                      setFiltroCondicionPago(value);
                    }
                  }}
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="CONDICIÓN PAGO" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content-filtro"
                    position="popper"
                    side="bottom"
                    align="start"
                  >
                    <SelectItem value={FILTRO_CC_TODOS}>TODO</SelectItem>
                    <SelectItem value="pendiente">PENDIENTE PAGO</SelectItem>
                    <SelectItem value="pagado">PAGADO</SelectItem>
                  </SelectContent>
                </Select>
              </FiltroIndividualContainer>
            </FilaFiltrosDesplegables>
            )}
          </FilterBar>
          </div>
        }
      >
        <div className="contenedor-tabla-gestion contenedor-tabla-gestion--pie-fijo min-h-0 flex-1">
          <div className="contenedor-tabla-gestion--pie-fijo-scroll">
          {esVistaProductos ? (
          <Table variant="compact" className="tabla-gestion-compacta w-full table-fixed text-center">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[50%]" />
              <col className="w-[16%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">FECHA</TableHead>
                <TableHead className="text-center">TIPO</TableHead>
                <TableHead className="text-center">DESCRIPCIÓN PRODUCTO</TableHead>
                <TableHead className="text-center">CANTIDAD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productosFiltrados.length === 0 ? (
                <EmptyTableRow
                  colSpan={COL_SPAN_PRODUCTOS}
                  message={vacioMensaje}
                />
              ) : (
                productosFiltrados.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center whitespace-normal tabular-nums">
                      <span className="flex w-full flex-col items-center justify-center text-center leading-tight">
                        <span>
                          {formatIsoYmdDdMmYyyyArgentina(item.fechaIso)}
                        </span>
                        <span>
                          {formatHhMmArgentina(new Date(item.createdAtIso))}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-center whitespace-normal">
                      {CUENTA_CORRIENTE_PRODUCTO_TIPO_LABELS[item.tipo]}
                    </TableCell>
                    <TableCell className="celda-datos text-center whitespace-normal uppercase">
                      {fmtCelda(item.descripcion)}
                    </TableCell>
                    <TableCell className="celda-datos text-center tabular-nums">
                      {fmtNumero(item.cantidad)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          ) : (
          <Table variant="compact" className="tabla-gestion-compacta w-full">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">FECHA</TableHead>
                <TableHead className="text-center">COMPROBANTE</TableHead>
                <TableHead className="text-center">MONTO</TableHead>
                <TableHead className="text-center">SALDO</TableHead>
                <TableHead className="tabla-bloque-secundario-head-divider text-center">
                  ACCIONES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientosFiltrados.length === 0 ? (
                <EmptyTableRow colSpan={COL_SPAN} message={vacioMensaje} />
              ) : (
                movimientosFiltrados.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center whitespace-normal tabular-nums">
                      <span className="flex w-full flex-col items-center justify-center text-center leading-tight">
                        <span>
                          {formatIsoYmdDdMmYyyyArgentina(item.fechaIso)}
                        </span>
                        <span>
                          {formatHhMmArgentina(new Date(item.createdAtIso))}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-center whitespace-normal">
                      <span className="flex w-full flex-col items-center justify-center text-center leading-tight">
                        <span>
                          {CUENTA_CORRIENTE_MOVIMIENTO_LABELS[item.tipo]}
                        </span>
                        <span className="text-muted-foreground">
                          {fmtCelda(item.detalle || item.nroComprobante)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="celda-datos text-center whitespace-normal tabular-nums">
                      {item.tipo === "venta"
                        ? `$${fmtPrecio(item.monto)}`
                        : `-$${fmtPrecio(item.monto)}`}
                    </TableCell>
                    <TableCell className="celda-datos text-center whitespace-normal tabular-nums">
                      ${fmtPrecio(item.saldoCc)}
                    </TableCell>
                    <TableCell className="tabla-bloque-secundario-cell-divider text-center">
                      <div
                        className={cn(
                          TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                          "justify-center"
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="Ver"
                          aria-label={
                            item.tipo === "cobro"
                              ? `Ver cobro ${item.nroComprobante}`
                              : `Ver ${item.nroComprobante || "comprobante"}`
                          }
                          onClick={() => {
                            if (item.tipo === "cobro") {
                              setCobroId(item.id);
                              return;
                            }
                            setDetalleId(item.comprobanteId);
                          }}
                        >
                          <Eye
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          title="PDF"
                          aria-label={`PDF ${item.nroComprobante || "comprobante"}`}
                          onClick={() => {
                            setPdfId(item.comprobanteId);
                            setPdfNro(item.nroComprobante);
                          }}
                        >
                          <FileText
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
          </div>
          {esVistaProductos ? null : (
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
                title="Ventas menos notas de crédito"
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
          )}
        </div>
      </ClassicFilteredTableLayout>
      <FacturaCobroDetalleModal
        open={cobroId != null}
        onOpenChange={(open) => {
          if (!open) setCobroId(null);
        }}
        cobroId={cobroId}
      />
      <FacturaComprobanteDetalleModal
        open={detalleId != null}
        onOpenChange={(open) => {
          if (!open) setDetalleId(null);
        }}
        comprobanteId={detalleId}
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
    </>
  );
}
