"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  buscarClientesFacturaAction,
  emitirFacturaComprobanteAction,
  listarPintoresFacturaAction,
  listarStockSucursalesFacturaAction,
  obtenerClienteFacturaAction,
  obtenerFacturaComprobantePdfAction,
} from "@/actions/factura";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEditarClienteModal from "@/components/envios/CrearEditarClienteModal";
import CrearEditarEnviosDireccionModal from "@/components/envios/CrearEditarEnviosDireccionModal";
import FacturaCrearLineasBlock, {
  type FacturaRemitoSnapshot,
} from "@/components/facturacion/FacturaCrearLineasBlock";
import FacturaGenerarComprobanteModal from "@/components/facturacion/FacturaGenerarComprobanteModal";
import FacturaLineaComentarioModal from "@/components/facturacion/FacturaLineaComentarioModal";
import FacturaMovimientosVentaModal from "@/components/facturacion/FacturaMovimientosVentaModal";
import FacturaSaldoClienteModal from "@/components/facturacion/FacturaSaldoClienteModal";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
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
  MENSAJE_PERSONAL_SESION_REQUERIDO,
  MENSAJE_PTO_VTA_SUCURSAL_USUARIO,
  claseDesdeFacturaTipo,
  condicionFiscalDesdeFacturaTipo,
  clienteSuperaTopeCtaCorriente,
  esClienteConsumidorFinalCargado,
  etiquetaClienteVisorFactura,
  esFacturaTipoNotaCredito,
  esFacturaTipoFiscal,
  esFacturaTipoVenta,
  facturaTipoDesdeClaseYFiscal,
  mensajeClienteFacturaNoSeleccionado,
  nombreClienteFactura,
  ptoVtaIdParaSucursal,
  descuentoEstadoParaEmitir,
  textoFormasPagoRestringidasDescPromo,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  type FacturaClase,
  type FacturaComprobanteDuplicarBorrador,
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
import { etiquetaCondicionIvaArca, type PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import {
  emisorPdfDesdePtoVta,
  type FacturaComprobantePdfEmisor,
} from "@/lib/facturaComprobantePdfEmisor";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";
import type { CobroFacturaEmitirInput } from "@/lib/validations/factura";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { fmtPrecio } from "@/lib/format";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
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
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { sucursalPorDefectoSchema } from "@/lib/validations/globalPersonal";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import {
  armarPlanMovimientosVenta,
  planMovimientosVentaVacio,
  type PlanMovimientosVenta,
} from "@/lib/ventaMovimientosStock";

/** Espera al cierre animado del modal Generar antes de abrir MOVIMIENTOS (no apilar dialogs). */
const MS_ENTRE_MODALES = 300;

const FILA_BUSQUEDA_CLIENTES_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem_2.25rem] items-center justify-items-stretch gap-1.5 px-2";

const CABECERA_EDITOR_FILA1_CLASS =
  "grid w-full min-w-0 grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-end gap-3";

const CABECERA_EDITOR_FILA2_CLASS =
  "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10.5rem] items-end gap-3";

const CABECERA_EDITOR_SLOT_CLASS = "flex min-w-0 flex-col gap-1";

/** Misma altura que el input CLIENTE. Gana a `main button` (2.5rem) y a `.input-filtro-unificado`. */
const CABECERA_CAMPO_ALTO_CLASS = "!h-9 !min-h-9 !max-h-9";

/** Fila CLIENTE / PROYECTO / SALDO: mismo alto que el Select PROYECTO (`.input-filtro-unificado`, 2.5rem). */
const CABECERA_FILA2_ALTO_CLASS = "!h-10 !min-h-10 !max-h-10";

/** Lápiz + fecha · tipo · fiscal, tres columnas iguales centradas. */
const CABECERA_VISOR_TIPO_GRID_CLASS =
  "grid min-w-0 w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2";

const CABECERA_VISOR_SEP_CLASS = "h-6 w-0.5 shrink-0 self-center bg-primary";

/** Punto azul a media altura entre fecha, tipo y fiscal. */
const CABECERA_VISOR_PUNTO_CLASS =
  "h-1.5 w-1.5 shrink-0 self-center rounded-full bg-primary";

function emisorPdfDePtoVta(
  ptoVtas: readonly FacturaPtoVtaOpcion[],
  ptoVtaId: string
): FacturaComprobantePdfEmisor | null {
  const pto = ptoVtas.find((p) => p.id === ptoVtaId);
  if (!pto) return null;
  return emisorPdfDesdePtoVta(pto);
}

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
  duplicarBorrador?: FacturaComprobanteDuplicarBorrador | null;
  tipoInicial?: FacturaTipo;
};

/**
 * Pantalla Crear (Facturación · Factura): cabecera + líneas.
 * Persiste; `factura_fiscal` / `nota_credito_fiscal` autorizan CAE vía ARCA.
 */
export default function FacturaCrearPageClient({
  ptoVtas,
  condicionesIva,
  duplicarBorrador = null,
  tipoInicial,
}: Props) {
  const router = useRouter();
  const listboxClientesId = useId();
  const clienteWrapRef = useRef<HTMLDivElement>(null);
  const hiddenFechaRef = useRef<HTMLInputElement>(null);
  const remitoRef = useRef<FacturaRemitoSnapshot>({
    lineas: duplicarBorrador?.lineas ?? [],
    descuento: duplicarBorrador?.descuento ?? null,
  });
  const [fechaIso, setFechaIso] = useState(() => dateToIsoYmdArgentina(new Date()));
  const [tipo, setTipo] = useState<FacturaTipo>(
    () => duplicarBorrador?.tipo ?? tipoInicial ?? FACTURA_TIPO_DEFAULT
  );
  const [cabeceraModo, setCabeceraModo] = useState<"editor" | "visor">("editor");
  const [focoClientePendiente, setFocoClientePendiente] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(
    () => duplicarBorrador?.clienteId ?? null
  );
  const [clienteCuit, setClienteCuit] = useState<string | null>(
    () => duplicarBorrador?.clienteCatalogo?.cuit ?? null
  );
  const [clienteCondicionIvaCodigo, setClienteCondicionIvaCodigo] = useState<
    number | null
  >(() => duplicarBorrador?.clienteCatalogo?.condicionIva ?? null);
  const [ctaCorrienteMontoMaxCliente, setCtaCorrienteMontoMaxCliente] = useState<
    number | null
  >(() => duplicarBorrador?.clienteCatalogo?.ctaCorrienteMontoMax ?? null);
  const [saldoCuentaCorrienteCliente, setSaldoCuentaCorrienteCliente] = useState<
    number | null
  >(() =>
    duplicarBorrador?.clienteCatalogo != null
      ? duplicarBorrador.clienteCatalogo.saldoCuentaCorriente
      : null
  );
  const [saldoVencidoCliente, setSaldoVencidoCliente] = useState(
    () => duplicarBorrador?.clienteCatalogo?.saldoVencidoCuentaCorriente ?? 0
  );
  const [saldoInfoOpen, setSaldoInfoOpen] = useState(false);
  /** Cliente elegido o CF explícito: `qActual` del typeahead. */
  const [clienteQActual, setClienteQActual] = useState(() => {
    if (!duplicarBorrador) return "";
    if (duplicarBorrador.clienteCatalogo) {
      return etiquetaClienteListado(duplicarBorrador.clienteCatalogo);
    }
    return duplicarBorrador.cliente;
  });
  const [, setNroComprobante] = useState("");
  const [comentarios, setComentarios] = useState(
    () => duplicarBorrador?.comentarios ?? ""
  );
  const [comentarioCabeceraOpen, setComentarioCabeceraOpen] = useState(false);
  const cbteAsocId = duplicarBorrador?.cbteAsocId ?? "";
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [crearProyectoOpen, setCrearProyectoOpen] = useState(false);
  const [comprobanteModalOpen, setComprobanteModalOpen] = useState(false);
  const [comprobantePdf, setComprobantePdf] =
    useState<FacturaComprobantePdfInput | null>(null);
  const emitirDraftRef = useRef<{
    fechaIso: string;
    tipo: FacturaTipo;
    cliente: string;
    clienteId: string | null;
    proyectoId: string | null;
    comentarios: string;
    ptoVtaId: string;
    personalId: number;
    cbteAsocId?: string;
    lineas: FacturaRemitoSnapshot["lineas"];
    descuento: FacturaRemitoSnapshot["descuento"];
  } | null>(null);
  /** Plan con el stock previo a emitir (la venta descuenta stock de la sucursal). */
  const planMovimientosRef = useRef<PlanMovimientosVenta | null>(null);
  const [movimientos, setMovimientos] = useState<{
    plan: PlanMovimientosVenta;
    sucursal: SucursalTransf;
  } | null>(null);
  const [movimientosOpen, setMovimientosOpen] = useState(false);
  const [sugerenciasClientes, setSugerenciasClientes] = useState<ClienteListaItem[]>([]);
  const [clienteProyectos, setClienteProyectos] = useState<EnviosDireccionItem[]>(
    () => duplicarBorrador?.clienteCatalogo?.proyectos ?? []
  );
  const [proyectoId, setProyectoId] = useState<string | null>(() => {
    if (!duplicarBorrador) return null;
    if (duplicarBorrador.proyectoId) return duplicarBorrador.proyectoId;
    const proyectos = duplicarBorrador.clienteCatalogo?.proyectos ?? [];
    return proyectos.length === 1 ? (proyectos[0]?.id ?? null) : null;
  });
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [editarCliente, setEditarCliente] = useState<ClienteListaItem | null>(null);
  const [pintoresEditarCliente, setPintoresEditarCliente] = useState<ClienteItem[] | null>(null);
  const [clientesAbierto, setClientesAbierto] = useState(false);
  const [clienteHighlight, setClienteHighlight] = useState(0);

  const [descuentoVisor, setDescuentoVisor] = useState(
    () => duplicarBorrador?.descuento ?? null
  );

  const handleRemitoChange = useCallback((snapshot: FacturaRemitoSnapshot) => {
    remitoRef.current = snapshot;
    setDescuentoVisor(snapshot.descuento);
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

  useEffect(() => {
    if (!focoClientePendiente || cabeceraModo !== "editor") return;
    clienteInputRef.current?.focus();
    setFocoClientePendiente(false);
  }, [focoClientePendiente, cabeceraModo, clienteInputRef]);

  const clienteTrim = cliente.trim();
  const puedeBuscarClientes =
    clienteTrim.length >= FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS;
  const hayClienteConSaldo = clienteId != null && saldoCuentaCorrienteCliente != null;
  const tieneSaldoVencido = hayClienteConSaldo && saldoVencidoCliente > 0.009;

  function vaciarInputClienteParaBusqueda() {
    setClienteId(null);
    setClienteCuit(null);
    setClienteCondicionIvaCodigo(null);
    setCtaCorrienteMontoMaxCliente(null);
    setSaldoCuentaCorrienteCliente(null);
    setSaldoVencidoCliente(0);
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
    setClienteCuit(null);
    setClienteCondicionIvaCodigo(null);
    setCtaCorrienteMontoMaxCliente(null);
    setSaldoCuentaCorrienteCliente(null);
    setSaldoVencidoCliente(0);
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
    setClienteCuit(item.cuit);
    setClienteCondicionIvaCodigo(item.condicionIva);
    setCtaCorrienteMontoMaxCliente(item.ctaCorrienteMontoMax);
    setSaldoCuentaCorrienteCliente(
      "saldoCuentaCorriente" in item ? item.saldoCuentaCorriente : 0
    );
    setSaldoVencidoCliente(
      "saldoVencidoCuentaCorriente" in item ? item.saldoVencidoCuentaCorriente : 0
    );
    setClienteProyectos(proyectos);
    setProyectoId(proyectos[0]?.id ?? null);
    setSugerenciasClientes([]);
    setClientesAbierto(false);
    setClienteHighlight(0);
  }

  function abrirEditarCliente(item: ClienteListaItem) {
    setClientesAbierto(false);
    setEditarCliente(item);
    if (pintoresEditarCliente != null) return;
    void listarPintoresFacturaAction().then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPintoresEditarCliente(res.data);
    });
  }

  async function aplicarClienteEditado(id: string) {
    const res = await obtenerClienteFacturaAction({ id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    aplicarClienteSeleccionado(res.data);
  }

  const claseActual = claseDesdeFacturaTipo(tipo);
  const fiscalActual = condicionFiscalDesdeFacturaTipo(tipo);
  const mostrarFiscal = claseActual !== "presupuesto";
  const mostrarProyecto = clienteProyectos.length > 1;
  const proyectoElegido =
    clienteProyectos.find((p) => p.id === proyectoId) ?? null;

  function datosClienteComprobantePdf(): Pick<
    FacturaComprobantePdfInput,
    "clienteCuit" | "clienteCondicionIva" | "proyectoNombre"
  > {
    const fiscal = esFacturaTipoFiscal(tipo);
    const cond = condicionesIva.find((c) => c.codigo === clienteCondicionIvaCodigo);
    return {
      clienteCuit: fiscal ? clienteCuit : null,
      clienteCondicionIva:
        fiscal && cond ? etiquetaCondicionIvaArca(cond.descripcion) : null,
      proyectoNombre:
        mostrarProyecto && proyectoElegido
          ? etiquetaNombreProyecto(proyectoElegido)
          : null,
    };
  }

  const etiquetaFormasPagoVisor =
    textoFormasPagoRestringidasDescPromo(descuentoVisor);
  const etiquetaClienteVisor = etiquetaClienteVisorFactura(cliente, clienteId);
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
        CABECERA_CAMPO_ALTO_CLASS,
        "!w-9 shrink-0 !p-0 hover:bg-muted",
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

  function abrirGenerarComprobante() {
    const { lineas, descuento } = remitoRef.current;
    if (lineas.length === 0) {
      toast.error("Agregá al menos un ítem antes de generar el comprobante.");
      return;
    }
    const clienteNoSel = mensajeClienteFacturaNoSeleccionado(cliente, clienteId);
    if (clienteNoSel) {
      toast.error(clienteNoSel);
      setCabeceraModo("editor");
      setFocoClientePendiente(true);
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
    const personalSesion = leerUsuarioSesion();
    if (!personalSesion) {
      toast.error(MENSAJE_PERSONAL_SESION_REQUERIDO);
      return;
    }
    const ptoVtaId = ptoVtaIdParaSucursal(
      ptoVtas,
      personalSesion.sucursalPorDefecto
    );
    if (!ptoVtaId) {
      toast.error(MENSAJE_PTO_VTA_SUCURSAL_USUARIO);
      return;
    }
    const clienteEmitir = nombreClienteFactura(cliente);
    emitirDraftRef.current = {
      fechaIso,
      tipo,
      cliente: clienteEmitir,
      clienteId,
      proyectoId,
      comentarios,
      ptoVtaId,
      personalId: personalSesion.idPersonal,
      cbteAsocId:
        esFacturaTipoNotaCredito(tipo) && cbteAsocId ? cbteAsocId : undefined,
      lineas,
      descuento,
    };
    setComprobantePdf({
      tipo,
      fechaIso,
      cliente: clienteEmitir,
      nroComprobante: "",
      comentarios,
      lineas,
      descuento,
      cae: null,
      caeVtoIso: null,
      letra: null,
      emisor: emisorPdfDePtoVta(ptoVtas, ptoVtaId),
      ...datosClienteComprobantePdf(),
    });
    setComprobanteModalOpen(true);
  }

  async function planMovimientosConStockActual(
    lineas: FacturaRemitoSnapshot["lineas"]
  ): Promise<PlanMovimientosVenta | null> {
    const sucursal = leerUsuarioSesion()?.sucursalPorDefecto ?? null;
    const codTiendas = [...new Set(lineas.map((l) => l.codTienda))];
    if (!sucursal || codTiendas.length === 0) return null;
    const res = await listarStockSucursalesFacturaAction({ codTiendas });
    if (!res.ok) return null;
    return armarPlanMovimientosVenta({
      lineas,
      sucursalCodigo: sucursal,
      stockPorCod: Object.fromEntries(res.data.items.map((i) => [i.codTienda, i.stockPorSucursal])),
    });
  }

  function irAListado() {
    router.push(
      tipo === "presupuesto"
        ? FACTURACION_ROUTES.factura.presupuestos
        : FACTURACION_ROUTES.factura.facturas
    );
  }

  function finalizarComprobante() {
    const plan = planMovimientosRef.current;
    planMovimientosRef.current = null;
    const sucursal = sucursalPorDefectoSchema.safeParse(leerUsuarioSesion()?.sucursalPorDefecto);
    if (planMovimientosVentaVacio(plan) || !plan || !sucursal.success) {
      irAListado();
      return;
    }
    setMovimientos({ plan, sucursal: sucursal.data });
    window.setTimeout(() => setMovimientosOpen(true), MS_ENTRE_MODALES);
  }

  async function emitirDesdeModal(
    cobros: CobroFacturaEmitirInput[]
  ): Promise<FacturaComprobantePdfInput | null> {
    const draft = emitirDraftRef.current;
    if (!draft) {
      toast.error("No hay datos del comprobante.");
      return null;
    }
    const pctGlobal = porcentajeDescuentoGlobal(draft.lineas, draft.descuento);
    planMovimientosRef.current = esFacturaTipoVenta(draft.tipo)
      ? await planMovimientosConStockActual(draft.lineas)
      : null;
    const res = await emitirFacturaComprobanteAction({
      fechaIso: draft.fechaIso,
      tipo: draft.tipo,
      cliente: draft.cliente,
      clienteId: draft.clienteId,
      proyectoId: draft.proyectoId,
      comentarios: draft.comentarios,
      ptoVtaId: draft.ptoVtaId,
      personalId: draft.personalId,
      cbteAsocId: draft.cbteAsocId,
      lineas: draft.lineas.map((l) => ({
        codTienda: l.codTienda,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        pxLista: l.pxLista,
        descuentoPct: porcentajeDescuentoLinea(l, pctGlobal),
        comentario: l.comentario,
        codColor: l.codColor ?? null,
        codColorIdMarca: l.codColorIdMarca ?? null,
      })),
      descuento: descuentoEstadoParaEmitir(draft.lineas, draft.descuento),
      cobros,
    });
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    setNroComprobante(res.data.nroComprobante);
    if (res.data.cae) {
      toast.success(`CAE ${res.data.cae}`);
    } else {
      toast.success("Comprobante guardado.");
    }
    const pdfRes = await obtenerFacturaComprobantePdfAction({ id: res.data.id });
    if (!pdfRes.ok) {
      toast.error(pdfRes.error ?? "No se pudo armar el PDF.");
      return null;
    }
    setComprobantePdf(pdfRes.data);
    return pdfRes.data;
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
          icon={<FileText className="h-4 w-4 shrink-0" aria-hidden />}
          onClick={() => abrirGenerarComprobante()}
        />
      }
    >
      <CrearEditarClienteModal
        open={crearClienteOpen}
        onOpenChange={setCrearClienteOpen}
        modo="crear"
        onSuccess={(creado) => {
          aplicarClienteSeleccionado(creado);
          void aplicarClienteEditado(creado.id);
        }}
      />
      <CrearEditarClienteModal
        open={editarCliente != null}
        onOpenChange={(open) => {
          if (!open) setEditarCliente(null);
        }}
        modo="editar"
        item={editarCliente}
        pintores={pintoresEditarCliente ?? []}
        direcciones={editarCliente?.proyectos ?? []}
        onSuccess={(actualizado) => void aplicarClienteEditado(actualizado.id)}
        onCatalogoChanged={() => {
          if (editarCliente) void aplicarClienteEditado(editarCliente.id);
        }}
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
                className="boton-encubierto boton-encubierto--cabecera-visor min-w-0 flex-1"
                onClick={() => setCabeceraModo("editor")}
                aria-label="Editar cabecera del comprobante"
                title="Editar cabecera"
              >
                <span className={CABECERA_VISOR_TIPO_GRID_CLASS}>
                  <Pencil className="size-4 shrink-0 justify-self-start text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate text-center tabular-nums">
                    {formatIsoYmdDdMmYyyyArgentina(fechaIso)}
                  </span>
                  <span className={CABECERA_VISOR_PUNTO_CLASS} aria-hidden />
                  <span className="min-w-0 truncate text-center">
                    {FACTURA_CLASE_LABELS[claseActual]}
                  </span>
                  <span className={CABECERA_VISOR_PUNTO_CLASS} aria-hidden />
                  <span className="min-w-0 truncate text-center">
                    {FACTURA_CONDICION_FISCAL_LABELS[fiscalActual ?? "no_fiscal"]}
                  </span>
                </span>
                <span className={CABECERA_VISOR_SEP_CLASS} aria-hidden />
                <span className="min-w-0 truncate text-center uppercase">
                  {etiquetaClienteVisor}
                </span>
                <span className={CABECERA_VISOR_SEP_CLASS} aria-hidden />
                <span className="min-w-0 truncate text-center uppercase">
                  {etiquetaFormasPagoVisor}
                </span>
              </button>
              {botonComentariosCabecera}
            </div>
          ) : (
          <div className="flex flex-col gap-3">
          <div className={CABECERA_EDITOR_FILA1_CLASS}>
            <label className={cn(CABECERA_EDITOR_SLOT_CLASS, "w-full")}>
              <div className="relative w-full">
                <Input
                  type="text"
                  readOnly
                  value={formatIsoYmdDdMmYyyyArgentina(fechaIso)}
                  className={cn(CABECERA_CAMPO_ALTO_CLASS, "tabular-nums", "pr-10", "cursor-pointer")}
                  onClick={() => abrirSelectorFechaNativo(hiddenFechaRef.current)}
                  title="Clic para abrir el calendario"
                  aria-label="Fecha del comprobante. Clic para abrir el calendario."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    CABECERA_CAMPO_ALTO_CLASS,
                    "absolute right-0 top-0 !w-9 shrink-0 !p-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
                <SelectTrigger
                  className={cn(SELECT_TRIGGER_FILTER_CLASS, CABECERA_CAMPO_ALTO_CLASS, "w-full")}
                  aria-label="Tipo comprobante"
                  title="Tipo comprobante"
                >
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
                <Select
                  value={fiscalActual ?? "no_fiscal"}
                  onValueChange={(value) => {
                    if (value === "fiscal" || value === "no_fiscal") {
                      aplicarFiscal(value);
                    }
                  }}
                >
                  <SelectTrigger
                    className={cn(SELECT_TRIGGER_FILTER_CLASS, CABECERA_CAMPO_ALTO_CLASS, "w-full")}
                    aria-label="Condición fiscal"
                    title="Condición fiscal"
                  >
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
                    setClienteCuit(null);
                    setClienteCondicionIvaCodigo(null);
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
                    CABECERA_FILA2_ALTO_CLASS,
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
                            PINTOR
                          </span>
                          <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                            SALDO
                          </span>
                          <span className={TYPEAHEAD_LISTBOX_CELL_CLASS} />
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
                                    TYPEAHEAD_LISTBOX_OPTION_ROW_CLIENTES_CLASS,
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
                                      "text-foreground"
                                    )}
                                  >
                                    {pintor}
                                  </span>
                                  <span
                                    className={cn(
                                      TYPEAHEAD_LISTBOX_CELL_CLASS,
                                      "tabular-nums text-foreground"
                                    )}
                                  >
                                    {`$${fmtPrecio(item.saldoCuentaCorriente)}`}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    tabIndex={-1}
                                    className={cn(
                                      TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                                      "justify-self-center"
                                    )}
                                    title="Editar"
                                    aria-label={`Editar ${nombre}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      abrirEditarCliente(item);
                                    }}
                                  >
                                    <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                  </Button>
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
                <Button
                  type="button"
                  variant="default"
                  className={cn(
                    CABECERA_FILA2_ALTO_CLASS,
                    "box-border w-fit max-w-full self-start px-3 !py-0 text-xs leading-none"
                  )}
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
                <div className="filtro-individual-container relative w-full">
                  <Select
                    value={proyectoId ?? "none"}
                    onValueChange={(value) => {
                      setProyectoId(value === "none" ? null : value);
                    }}
                  >
                    <SelectTrigger
                      className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
                      aria-label="Proyecto cliente"
                      title="Proyecto cliente"
                    >
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

            <div className={cn(CABECERA_EDITOR_SLOT_CLASS, "items-center")}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  CABECERA_FILA2_ALTO_CLASS,
                  "relative w-full !pl-2 !pr-9 rounded-md border text-sm tabular-nums shadow-xs",
                  "disabled:cursor-default disabled:opacity-100",
                  tieneSaldoVencido
                    ? "border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white"
                    : "border-primary bg-card text-foreground hover:bg-muted hover:text-foreground"
                )}
                disabled={!hayClienteConSaldo}
                onClick={() => setSaldoInfoOpen(true)}
                aria-label={
                  tieneSaldoVencido
                    ? "Saldo cliente, con saldo vencido. Ver detalle"
                    : "Saldo cliente. Ver detalle"
                }
                title="Ver detalle del saldo"
              >
                <span className="truncate">
                  <span className="font-bold">SALDO:</span>
                  {hayClienteConSaldo ? (
                    <span className="font-normal">{` $${fmtPrecio(saldoCuentaCorrienteCliente)}`}</span>
                  ) : null}
                </span>
                <Info
                  className={cn(
                    "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2",
                    tieneSaldoVencido ? "text-white" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
              </Button>
            </div>
          </div>

          </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <FacturaCrearLineasBlock
            initialRemito={
              duplicarBorrador
                ? {
                    lineas: duplicarBorrador.lineas,
                    descuento: duplicarBorrador.descuento,
                  }
                : null
            }
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
            emitirDraftRef.current = null;
          }
        }}
        comprobante={comprobantePdf}
        onEmitir={emitirDesdeModal}
        onFinalizado={finalizarComprobante}
      />
      <FacturaMovimientosVentaModal
        open={movimientosOpen}
        onOpenChange={(open) => {
          setMovimientosOpen(open);
          if (!open) irAListado();
        }}
        plan={movimientos?.plan ?? null}
        sucursalDestino={movimientos?.sucursal ?? null}
      />
      <FacturaSaldoClienteModal
        open={saldoInfoOpen && hayClienteConSaldo}
        onOpenChange={setSaldoInfoOpen}
        cliente={cliente}
        saldoTotal={saldoCuentaCorrienteCliente ?? 0}
        saldoVencido={saldoVencidoCliente}
      />
    </ClassicFilteredTableLayout>
  );
}
