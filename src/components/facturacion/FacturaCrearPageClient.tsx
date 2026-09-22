"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, FileText, Loader2, MessageSquare, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  buscarClientesFacturaAction,
  emitirFacturaComprobanteAction,
} from "@/actions/factura";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEditarClienteModal from "@/components/envios/CrearEditarClienteModal";
import CrearEditarEnviosDireccionModal from "@/components/envios/CrearEditarEnviosDireccionModal";
import FacturaCrearLineasBlock, {
  type FacturaRemitoSnapshot,
} from "@/components/facturacion/FacturaCrearLineasBlock";
import FacturaGenerarComprobanteModal from "@/components/facturacion/FacturaGenerarComprobanteModal";
import FacturaLineaComentarioModal from "@/components/facturacion/FacturaLineaComentarioModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS,
  FACTURA_BUSQUEDA_CLIENTES_TAKE,
  FACTURA_BOTON_CLIENTE_CONSUMIDOR_FINAL,
  FACTURA_CLASES,
  FACTURA_CLASE_LABELS,
  FACTURA_CLIENTE_CONSUMIDOR_FINAL,
  FACTURA_CONDICIONES_FISCALES,
  FACTURA_CONDICION_FISCAL_LABELS,
  FACTURA_TIPO_DEFAULT,
  MENSAJE_CLIENTE_FACTURA_NO_SELECCIONADO,
  MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE,
  claseDesdeFacturaTipo,
  condicionFiscalDesdeFacturaTipo,
  clienteSuperaTopeCtaCorriente,
  esClienteConsumidorFinalCargado,
  esFacturaTipoNotaCredito,
  esFacturaTipoVenta,
  etiquetaFacturaTipoVisor,
  facturaTipoDesdeClaseYFiscal,
  mensajeClienteFacturaNoSeleccionado,
  nombreClienteFactura,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  type FacturaClase,
  type FacturaCondicionFiscal,
  type FacturaPtoVtaOpcion,
  type FacturaTipo,
} from "@/lib/factura";
import {
  etiquetaNombreProyecto,
  etiquetaClienteListado,
  nombrePintorAsociadoCliente,
  type ClienteItem,
  type ClienteListaItem,
  type EnviosDireccionItem,
} from "@/lib/envios";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import type { PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtPrecio } from "@/lib/format";
import {
  TYPEAHEAD_LISTBOX_ANCHOR_CLASS,
  TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS,
  TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS,
  TYPEAHEAD_LISTBOX_CELL_CLASS,
  TYPEAHEAD_LISTBOX_HEADER_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS,
  TYPEAHEAD_LISTBOX_UL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const FILA_BUSQUEDA_CLIENTES_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)] items-center justify-items-stretch gap-1.5 px-2";

const CABECERA_EDITOR_FILA1_CLASS =
  "grid w-full min-w-0 grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-end gap-3";

const CABECERA_EDITOR_FILA2_CLASS =
  "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10.5rem] items-end gap-3";

const CABECERA_EDITOR_SLOT_CLASS = "flex min-w-0 flex-col gap-1";

function abrirSelectorFechaNativo(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    void el.showPicker?.();
  } catch {
    el.click();
  }
}

type Props = {
  ptoVtas: FacturaPtoVtaOpcion[];
  condicionesIva: PtoVentasCodArcaItem[];
  originalesNc: { id: string; label: string }[];
};

/**
 * Pantalla Crear (Facturación · Factura): cabecera + líneas.
 * Persiste; `factura_fiscal` / `nota_credito_fiscal` autorizan CAE vía ARCA.
 */
export default function FacturaCrearPageClient({
  ptoVtas,
  condicionesIva,
  originalesNc,
}: Props) {
  const listboxClientesId = useId();
  const clienteWrapRef = useRef<HTMLDivElement>(null);
  const hiddenFechaRef = useRef<HTMLInputElement>(null);
  const remitoRef = useRef<FacturaRemitoSnapshot>({
    lineas: [],
    descuento: null,
  });
  const [fechaIso, setFechaIso] = useState(() => dateToIsoYmdArgentina(new Date()));
  const [tipo, setTipo] = useState<FacturaTipo>(FACTURA_TIPO_DEFAULT);
  const [cabeceraModo, setCabeceraModo] = useState<"editor" | "visor">("editor");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [plazoCuentaCorrienteCliente, setPlazoCuentaCorrienteCliente] = useState<
    number | null
  >(null);
  const [ctaCorrienteMontoMaxCliente, setCtaCorrienteMontoMaxCliente] = useState<
    number | null
  >(null);
  const [saldoCuentaCorrienteCliente, setSaldoCuentaCorrienteCliente] = useState<
    number | null
  >(null);
  /** Cliente elegido o CF explícito: `qActual` del typeahead. */
  const [clienteQActual, setClienteQActual] = useState("");
  const [, setNroComprobante] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [comentarioCabeceraOpen, setComentarioCabeceraOpen] = useState(false);
  const [ptoVtaId] = useState(ptoVtas[0]?.id ?? "");
  const [cbteAsocId, setCbteAsocId] = useState("");
  const [pending, setPending] = useState(false);
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [crearProyectoOpen, setCrearProyectoOpen] = useState(false);
  const [comprobanteModalOpen, setComprobanteModalOpen] = useState(false);
  const [comprobantePdf, setComprobantePdf] =
    useState<FacturaComprobantePdfInput | null>(null);
  const [comprobanteId, setComprobanteId] = useState<string | null>(null);
  const [sugerenciasClientes, setSugerenciasClientes] = useState<ClienteListaItem[]>([]);
  const [clienteProyectos, setClienteProyectos] = useState<EnviosDireccionItem[]>(
    []
  );
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clientesAbierto, setClientesAbierto] = useState(false);
  const [clienteHighlight, setClienteHighlight] = useState(0);

  const handleRemitoChange = useCallback((snapshot: FacturaRemitoSnapshot) => {
    remitoRef.current = snapshot;
  }, []);

  const fetchSugerenciasClientes = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS) {
      setSugerenciasClientes([]);
      setLoadingClientes(false);
      return;
    }
    setLoadingClientes(true);
    const res = await buscarClientesFacturaAction({
      q,
      take: FACTURA_BUSQUEDA_CLIENTES_TAKE,
    });
    setLoadingClientes(false);
    if (!res.ok) {
      setSugerenciasClientes([]);
      toast.error(res.error);
      return;
    }
    setSugerenciasClientes(res.data.items);
    setClienteHighlight(0);
  }, []);

  const {
    q: cliente,
    setQ: setCliente,
    ref: clienteInputRef,
    handleQChange: handleClienteQChange,
    isDebouncing: isDebouncingClientes,
  } = useFiltrosConBusqueda({
    qActual: clienteQActual,
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      void fetchSugerenciasClientes(value);
    },
  });

  const clienteTrim = cliente.trim();
  const puedeBuscarClientes =
    clienteTrim.length >= FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS;

  function vaciarInputClienteParaBusqueda() {
    setClienteId(null);
    setPlazoCuentaCorrienteCliente(null);
    setCtaCorrienteMontoMaxCliente(null);
    setSaldoCuentaCorrienteCliente(null);
    setClienteQActual("");
    setCliente("");
    setClienteProyectos([]);
    setProyectoId(null);
    setClientesAbierto(false);
    setSugerenciasClientes([]);
    setLoadingClientes(false);
  }

  function cargarConsumidorFinal() {
    setClienteQActual(FACTURA_CLIENTE_CONSUMIDOR_FINAL);
    setCliente(FACTURA_CLIENTE_CONSUMIDOR_FINAL);
    setClienteId(null);
    setPlazoCuentaCorrienteCliente(null);
    setCtaCorrienteMontoMaxCliente(null);
    setSaldoCuentaCorrienteCliente(null);
    setClienteProyectos([]);
    setProyectoId(null);
    setClientesAbierto(false);
    setSugerenciasClientes([]);
    setLoadingClientes(false);
  }

  function aplicarClienteSeleccionado(item: ClienteItem | ClienteListaItem) {
    const nombre = etiquetaClienteListado(item);
    const proyectos =
      "proyectos" in item ? item.proyectos : [];
    setClienteQActual(nombre);
    setCliente(nombre);
    setClienteId(item.id);
    setPlazoCuentaCorrienteCliente(item.ctaCorrientePlazo);
    setCtaCorrienteMontoMaxCliente(item.ctaCorrienteMontoMax);
    setSaldoCuentaCorrienteCliente(
      "saldoCuentaCorriente" in item ? item.saldoCuentaCorriente : 0
    );
    setClienteProyectos(proyectos);
    setProyectoId(proyectos[0]?.id ?? null);
    setSugerenciasClientes([]);
    setClientesAbierto(false);
    setClienteHighlight(0);
  }

  const claseActual = claseDesdeFacturaTipo(tipo);
  const fiscalActual = condicionFiscalDesdeFacturaTipo(tipo);
  const mostrarFiscal = claseActual !== "presupuesto";
  const mostrarProyecto = clienteProyectos.length > 1;
  const proyectoElegido =
    clienteProyectos.find((p) => p.id === proyectoId) ?? null;
  const etiquetaClienteVisor = (() => {
    const nombre = cliente.trim();
    if (!nombre) return "";
    const display = nombreClienteFactura(nombre);
    if (!proyectoElegido) return display;
    return `${display} - ${etiquetaNombreProyecto(proyectoElegido)}`;
  })();
  const mostrarBotonConsumidorFinal =
    !esClienteConsumidorFinalCargado(cliente) && clienteId == null;

  function aplicarClase(clase: FacturaClase) {
    if (clase === "presupuesto") {
      setTipo("presupuesto");
      return;
    }
    setTipo(
      facturaTipoDesdeClaseYFiscal(clase, fiscalActual ?? "no_fiscal")
    );
  }

  function aplicarFiscal(fiscal: FacturaCondicionFiscal) {
    if (claseActual === "presupuesto") return;
    setTipo(facturaTipoDesdeClaseYFiscal(claseActual, fiscal));
  }

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const el = clienteWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setClientesAbierto(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  const hayComentarioCabecera = comentarios.trim().length > 0;

  const botonComentariosCabecera = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 shrink-0 hover:bg-muted",
        hayComentarioCabecera
          ? "text-primary hover:text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={() => setComentarioCabeceraOpen(true)}
      aria-label={
        hayComentarioCabecera
          ? "Editar comentarios del comprobante"
          : "Agregar comentarios del comprobante"
      }
      title="Comentarios"
    >
      <MessageSquare
        className={cn(
          "h-4 w-4 shrink-0",
          hayComentarioCabecera ? "fill-primary" : "fill-none"
        )}
        aria-hidden
      />
    </Button>
  );

  async function abrirGenerarComprobante() {
    const { lineas, descuento } = remitoRef.current;
    if (lineas.length === 0) {
      toast.error("Agregá al menos un ítem antes de generar el comprobante.");
      return;
    }
    if (!ptoVtaId) {
      toast.error("Seleccioná un punto de venta.");
      return;
    }
    const clienteNoSel = mensajeClienteFacturaNoSeleccionado(cliente, clienteId);
    if (clienteNoSel) {
      toast.error(clienteNoSel);
      return;
    }
    if (
      esFacturaTipoVenta(tipo) &&
      clienteSuperaTopeCtaCorriente(
        saldoCuentaCorrienteCliente ?? 0,
        ctaCorrienteMontoMaxCliente
      )
    ) {
      toast.error(MENSAJE_CLIENTE_TOPE_CTA_CORRIENTE);
      return;
    }
    const clienteEmitir = nombreClienteFactura(cliente);
    setPending(true);
    try {
      const pctGlobal = porcentajeDescuentoGlobal(lineas, descuento);
      const res = await emitirFacturaComprobanteAction({
        fechaIso,
        tipo,
        cliente: clienteEmitir,
        clienteId,
        proyectoId,
        comentarios,
        ptoVtaId,
        cbteAsocId:
          esFacturaTipoNotaCredito(tipo) && cbteAsocId ? cbteAsocId : undefined,
        lineas: lineas.map((l) => ({
          codTienda: l.codTienda,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          pxLista: l.pxLista,
          descuentoPct: porcentajeDescuentoLinea(l, pctGlobal),
          comentario: l.comentario,
        })),
        descuento,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNroComprobante(res.data.nroComprobante);
      if (res.data.cae) {
        toast.success(`CAE ${res.data.cae}`);
      } else {
        toast.success("Comprobante guardado.");
      }
      setComprobantePdf({
        tipo,
        fechaIso,
        cliente: clienteEmitir,
        nroComprobante: res.data.nroComprobante,
        comentarios,
        lineas,
        descuento,
        cae: res.data.cae,
        caeVtoIso: res.data.caeVtoIso,
        letra: res.data.letra,
      });
      setComprobanteId(res.data.id);
      setComprobanteModalOpen(true);
      vaciarInputClienteParaBusqueda();
    } finally {
      setPending(false);
    }
  }

  return (
    <ClassicFilteredTableLayout
      title="COMPROBANTES"
      subtitle="Crear"
      contentWidth="full"
      actions={
        <ToolbarActionButton
          type="button"
          variant="default"
          label="Generar Comprobante"
          loadingLabel="Emitiendo…"
          loading={pending}
          icon={<FileText className="h-4 w-4 shrink-0" aria-hidden />}
          onClick={() => void abrirGenerarComprobante()}
        />
      }
    >
      <CrearEditarClienteModal
        open={crearClienteOpen}
        onOpenChange={setCrearClienteOpen}
        modo="crear"
        condicionesIva={condicionesIva}
        onSuccess={aplicarClienteSeleccionado}
      />
      <CrearEditarEnviosDireccionModal
        open={crearProyectoOpen}
        onOpenChange={setCrearProyectoOpen}
        modo="crear"
        personaId={clienteId ?? ""}
        onSuccess={(proyecto) => {
          setClienteProyectos((prev) => [...prev, proyecto]);
          setProyectoId(proyecto.id);
        }}
      />
      <FacturaLineaComentarioModal
        key={comentarioCabeceraOpen ? "cabecera-comentario-open" : "cabecera-comentario-closed"}
        open={comentarioCabeceraOpen}
        onOpenChange={setComentarioCabeceraOpen}
        comentarioInicial={comentarios}
        onGuardar={setComentarios}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div
          className={cn(
            "shrink-0 rounded-lg border border-border bg-card p-4",
            clientesAbierto && TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS
          )}
        >
          {cabeceraModo === "visor" ? (
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="boton-encubierto min-w-0 flex-1"
                onClick={() => setCabeceraModo("editor")}
                aria-label="Editar cabecera del comprobante"
                title="Editar cabecera"
              >
                <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="shrink-0 tabular-nums">
                  {formatIsoYmdDdMmYyyyArgentina(fechaIso)}
                </span>
                <Separator orientation="vertical" className="h-6" />
                <span className="shrink-0">
                  {etiquetaFacturaTipoVisor(tipo)}
                </span>
                <Separator orientation="vertical" className="h-6" />
                <span className="min-w-0 truncate">{etiquetaClienteVisor}</span>
              </button>
              {botonComentariosCabecera}
            </div>
          ) : (
          <div className="flex flex-col gap-3">
          <div className={CABECERA_EDITOR_FILA1_CLASS}>
            <label className={cn(CABECERA_EDITOR_SLOT_CLASS, "w-full")}>
              <ModalMicroLabel>FECHA</ModalMicroLabel>
              <div className="relative w-full">
                <Input
                  type="text"
                  readOnly
                  value={formatIsoYmdDdMmYyyyArgentina(fechaIso)}
                  className={cn("tabular-nums", "pr-10", "cursor-pointer")}
                  onClick={() => abrirSelectorFechaNativo(hiddenFechaRef.current)}
                  title="Clic para abrir el calendario"
                  aria-label="Fecha del comprobante. Clic para abrir el calendario."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-0 top-0 h-9 w-9 shrink-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => abrirSelectorFechaNativo(hiddenFechaRef.current)}
                  aria-label="Abrir calendario"
                  title="Abrir calendario"
                >
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </div>
              <input
                ref={hiddenFechaRef}
                type="date"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                value={fechaIso}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setFechaIso(v);
                }}
              />
            </label>

            <label className={CABECERA_EDITOR_SLOT_CLASS}>
              <ModalMicroLabel>TIPO COMPROBANTE</ModalMicroLabel>
              <Select
                value={claseActual}
                onValueChange={(value) => {
                  if (
                    value === "presupuesto" ||
                    value === "venta" ||
                    value === "nota_credito"
                  ) {
                    aplicarClase(value);
                  }
                }}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACTURA_CLASES.map((id) => (
                    <SelectItem key={id} value={id}>
                      {FACTURA_CLASE_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div
              className={cn(!mostrarFiscal && "invisible pointer-events-none")}
              aria-hidden={!mostrarFiscal}
              inert={mostrarFiscal ? undefined : true}
            >
              <label className={CABECERA_EDITOR_SLOT_CLASS}>
                <ModalMicroLabel>CONDICIÓN FISCAL</ModalMicroLabel>
                <Select
                  value={fiscalActual ?? "no_fiscal"}
                  onValueChange={(value) => {
                    if (value === "fiscal" || value === "no_fiscal") {
                      aplicarFiscal(value);
                    }
                  }}
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACTURA_CONDICIONES_FISCALES.map((id) => (
                      <SelectItem key={id} value={id}>
                        {FACTURA_CONDICION_FISCAL_LABELS[id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            {botonComentariosCabecera}
          </div>

          <div className={CABECERA_EDITOR_FILA2_CLASS}>
            <label className={CABECERA_EDITOR_SLOT_CLASS}>
              <ModalMicroLabel>CLIENTE</ModalMicroLabel>
              <div
                ref={clienteWrapRef}
                className={cn(
                  "filtro-individual-container w-full",
                  TYPEAHEAD_LISTBOX_ANCHOR_CLASS,
                  clientesAbierto && TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS
                )}
              >
                <Input
                  ref={clienteInputRef}
                  id="factura-crear-buscar-cliente"
                  type="text"
                  value={cliente}
                  onChange={(e) => {
                    const next = e.target.value.toLocaleUpperCase("es-AR");
                    setClienteId(null);
                    setPlazoCuentaCorrienteCliente(null);
                    setClienteProyectos([]);
                    setProyectoId(null);
                    handleClienteQChange(next);
                    if (next.trim().length < FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS) {
                      setClientesAbierto(false);
                      setSugerenciasClientes([]);
                      setLoadingClientes(false);
                      return;
                    }
                    setClientesAbierto(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && sugerenciasClientes.length > 0) {
                      e.preventDefault();
                      setClientesAbierto(true);
                      setClienteHighlight((h) => (h + 1) % sugerenciasClientes.length);
                      return;
                    }
                    if (e.key === "ArrowUp" && sugerenciasClientes.length > 0) {
                      e.preventDefault();
                      setClientesAbierto(true);
                      setClienteHighlight(
                        (h) =>
                          (h - 1 + sugerenciasClientes.length) %
                          sugerenciasClientes.length
                      );
                      return;
                    }
                    if (e.key === "Enter" && sugerenciasClientes[clienteHighlight]) {
                      e.preventDefault();
                      aplicarClienteSeleccionado(
                        sugerenciasClientes[clienteHighlight]!
                      );
                      return;
                    }
                    if (e.key === "Escape") {
                      setClientesAbierto(false);
                    }
                  }}
                  onFocus={(e) => {
                    if (
                      e.currentTarget.value.trim() ===
                      FACTURA_CLIENTE_CONSUMIDOR_FINAL
                    ) {
                      vaciarInputClienteParaBusqueda();
                      return;
                    }
                    if (puedeBuscarClientes) {
                      setClientesAbierto(true);
                    }
                  }}
                  onBlur={(e) => {
                    const wrap = clienteWrapRef.current;
                    if (
                      wrap &&
                      e.relatedTarget instanceof Node &&
                      wrap.contains(e.relatedTarget)
                    ) {
                      return;
                    }
                    setClientesAbierto(false);
                  }}
                  placeholder="BUSCAR CLIENTE..."
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={clientesAbierto}
                  aria-controls={listboxClientesId}
                  aria-autocomplete="list"
                  aria-label="Cliente"
                  className={cn(
                    "w-full pr-10",
                    (isDebouncingClientes || loadingClientes) && "pr-16"
                  )}
                />
                {(isDebouncingClientes || loadingClientes) && (
                  <Loader2
                    className="pointer-events-none absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                )}
                <Button
                  type="button"
                  variant="primaryIcon"
                  size="icon-lg"
                  className="filtro-individual-clear-btn"
                  onClick={() => {
                    setCrearProyectoOpen(false);
                    setCrearClienteOpen(true);
                  }}
                  aria-label="Crear cliente"
                  title="Crear cliente"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
                {clientesAbierto && puedeBuscarClientes ? (
                  <div
                    id={listboxClientesId}
                    role="listbox"
                    className={cn(
                      TYPEAHEAD_LISTBOX_PANEL_CLASS,
                      TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS,
                      TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS
                    )}
                  >
                    {loadingClientes || isDebouncingClientes ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        Buscando…
                      </p>
                    ) : sugerenciasClientes.length === 0 ? (
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
                            SALDO
                          </span>
                          <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                            PINTOR
                          </span>
                        </div>
                        <ul
                          className={cn(
                            TYPEAHEAD_LISTBOX_UL_CLASS,
                            "flex-none overflow-visible"
                          )}
                        >
                          {sugerenciasClientes.map((item, idx) => {
                            const activo = idx === clienteHighlight;
                            const nombre = etiquetaClienteListado(item);
                            const pintor = nombrePintorAsociadoCliente(item) ?? "";
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
                                    "min-h-5",
                                    activo && TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS
                                  )}
                                  onMouseEnter={() => setClienteHighlight(idx)}
                                  onPointerDown={(e) => e.preventDefault()}
                                  onClick={() => aplicarClienteSeleccionado(item)}
                                >
                                  <span
                                    className={cn(
                                      TYPEAHEAD_LISTBOX_CELL_CLASS,
                                      "text-foreground"
                                    )}
                                  >
                                    {nombre}
                                  </span>
                                  <span
                                    className={cn(
                                      TYPEAHEAD_LISTBOX_CELL_CLASS,
                                      "tabular-nums text-foreground"
                                    )}
                                  >
                                    {`$${fmtPrecio(item.saldoCuentaCorriente)}`}
                                  </span>
                                  <span
                                    className={cn(
                                      TYPEAHEAD_LISTBOX_CELL_CLASS,
                                      "text-foreground"
                                    )}
                                  >
                                    {pintor}
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
            </label>

            {mostrarBotonConsumidorFinal ? (
              <div className={CABECERA_EDITOR_SLOT_CLASS}>
                <ModalMicroLabel className="invisible" aria-hidden>
                  PROYECTO CLIENTE
                </ModalMicroLabel>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full"
                  onClick={cargarConsumidorFinal}
                >
                  {FACTURA_BOTON_CLIENTE_CONSUMIDOR_FINAL}
                </Button>
              </div>
            ) : (
            <div
              className={cn(!mostrarProyecto && "invisible pointer-events-none")}
              aria-hidden={!mostrarProyecto}
              inert={mostrarProyecto ? undefined : true}
            >
              <label className={CABECERA_EDITOR_SLOT_CLASS}>
                <ModalMicroLabel>PROYECTO CLIENTE</ModalMicroLabel>
                <div className="filtro-individual-container relative w-full">
                  <Select
                    value={proyectoId ?? "none"}
                    onValueChange={(value) => {
                      setProyectoId(value === "none" ? null : value);
                    }}
                  >
                    <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                      <SelectValue placeholder="PROYECTO" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">PROYECTO</SelectItem>
                      {clienteProyectos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {etiquetaNombreProyecto(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="primaryIcon"
                    size="icon-lg"
                    className="filtro-individual-clear-btn"
                    onClick={() => {
                      if (!clienteId) {
                        toast.error(MENSAJE_CLIENTE_FACTURA_NO_SELECCIONADO);
                        return;
                      }
                      setCrearClienteOpen(false);
                      setCrearProyectoOpen(true);
                    }}
                    aria-label="Crear proyecto"
                    title="Crear proyecto"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </label>
            </div>
            )}

            <div className={CABECERA_EDITOR_SLOT_CLASS}>
              <ModalMicroLabel>SALDO CLIENTE</ModalMicroLabel>
              <p
                className="flex h-9 items-center truncate text-sm tabular-nums text-foreground"
                aria-label="Saldo cliente"
              >
                {clienteId != null && saldoCuentaCorrienteCliente != null
                  ? `$${fmtPrecio(saldoCuentaCorrienteCliente)}`
                  : ""}
              </p>
            </div>
          </div>

          {esFacturaTipoNotaCredito(tipo) ? (
            <div className="w-[min(100%,20rem)]">
              <label className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>CBTE. ASOC.</ModalMicroLabel>
                <Select value={cbteAsocId} onValueChange={setCbteAsocId}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="Original con CAE" />
                  </SelectTrigger>
                  <SelectContent>
                    {originalesNc.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          ) : null}
          </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <FacturaCrearLineasBlock
            onRemitoChange={handleRemitoChange}
            onBusquedaProductoFocus={() => {
              setClientesAbierto(false);
              setCabeceraModo("visor");
            }}
          />
        </div>
      </div>

      <FacturaGenerarComprobanteModal
        open={comprobanteModalOpen}
        onOpenChange={(open) => {
          setComprobanteModalOpen(open);
          if (!open) {
            setComprobantePdf(null);
            setComprobanteId(null);
          }
        }}
        comprobante={comprobantePdf}
        comprobanteId={comprobanteId}
        plazoCuentaCorrienteCliente={plazoCuentaCorrienteCliente}
      />
    </ClassicFilteredTableLayout>
  );
}
