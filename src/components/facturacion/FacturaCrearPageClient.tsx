"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  buscarClientesFacturaAction,
  emitirFacturaComprobanteAction,
} from "@/actions/factura";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import CrearEditarClienteModal from "@/components/envios/CrearEditarClienteModal";
import FacturaCrearLineasBlock, {
  type FacturaRemitoSnapshot,
} from "@/components/facturacion/FacturaCrearLineasBlock";
import FacturaGenerarComprobanteModal from "@/components/facturacion/FacturaGenerarComprobanteModal";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
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
  FACTURA_CLIENTE_CONSUMIDOR_FINAL,
  FACTURA_DOC_TIPO_OPTIONS,
  FACTURA_TIPOS,
  FACTURA_TIPO_DEFAULT,
  FACTURA_TIPO_LABELS,
  esClienteFacturaVacio,
  esFacturaTipo,
  esFacturaTipoFiscal,
  esFacturaTipoNotaCredito,
  nombreClienteFactura,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  type FacturaPtoVtaOpcion,
  type FacturaTipo,
} from "@/lib/factura";
import { ARCA_CONDICION_IVA, ARCA_DOC_TIPO, receptorRequiereCuit } from "@/lib/facturaFiscal";
import type { ClienteItem } from "@/lib/envios";
import {
  nombreCompletoCliente,
  nombrePintorAsociadoCliente,
} from "@/lib/envios";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import type { PtoVentasCodArcaItem } from "@/lib/globalPtoVtas";
import { etiquetaCondicionIvaArca } from "@/lib/globalPtoVtas";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";
import {
  dateToIsoYmdArgentina,
  formatIsoYmdDdMmYyyyArgentina,
} from "@/lib/fechaArgentina";
import { cn } from "@/lib/utils";
import {
  TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS,
  TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS,
  TYPEAHEAD_LISTBOX_UL_CLASS,
} from "@/lib/ui-classes";

/** Saldo en typeahead de clientes: pendiente de implementar. */
const CLIENTE_SALDO_PLACEHOLDER = "";

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
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [nroComprobante, setNroComprobante] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [ptoVtaId, setPtoVtaId] = useState(ptoVtas[0]?.id ?? "");
  const [receptorCondicionIva, setReceptorCondicionIva] = useState("5");
  const [receptorDocTipo, setReceptorDocTipo] = useState("99");
  const [receptorDocNro, setReceptorDocNro] = useState("0");
  const [cbteAsocId, setCbteAsocId] = useState("");
  const [pending, setPending] = useState(false);
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [comprobanteModalOpen, setComprobanteModalOpen] = useState(false);
  const [comprobantePdf, setComprobantePdf] =
    useState<FacturaComprobantePdfInput | null>(null);
  const [sugerenciasClientes, setSugerenciasClientes] = useState<ClienteItem[]>([]);
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
    qActual: FACTURA_CLIENTE_CONSUMIDOR_FINAL,
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      void fetchSugerenciasClientes(value);
    },
  });

  const clienteTrim = cliente.trim();
  const puedeBuscarClientes =
    clienteTrim.length >= FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS;

  function aplicarClienteSeleccionado(item: ClienteItem) {
    const nombre = nombreCompletoCliente(item);
    setCliente(nombre);
    setClienteId(item.id);
    const cond = item.condicionIva ?? ARCA_CONDICION_IVA.CF;
    setReceptorCondicionIva(String(cond));
    if (item.cuit) {
      setReceptorDocTipo(String(ARCA_DOC_TIPO.CUIT));
      setReceptorDocNro(item.cuit);
    } else if (receptorRequiereCuit(cond)) {
      setReceptorDocTipo(String(ARCA_DOC_TIPO.CUIT));
      setReceptorDocNro("");
    } else {
      setReceptorDocTipo(String(ARCA_DOC_TIPO.CF));
      setReceptorDocNro("0");
    }
    setSugerenciasClientes([]);
    setClientesAbierto(false);
    setClienteHighlight(0);
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

  const fiscal = esFacturaTipoFiscal(tipo);

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
    const clienteVacio = esClienteFacturaVacio(cliente);
    const clienteEmitir = nombreClienteFactura(cliente);
    setPending(true);
    try {
      const pctGlobal = porcentajeDescuentoGlobal(lineas, descuento);
      const res = await emitirFacturaComprobanteAction({
        fechaIso,
        tipo,
        cliente: clienteEmitir,
        clienteId,
        comentarios,
        ptoVtaId,
        receptorDocTipo: fiscal
          ? clienteVacio
            ? ARCA_DOC_TIPO.CF
            : Number(receptorDocTipo)
          : undefined,
        receptorDocNro: fiscal
          ? clienteVacio
            ? "0"
            : receptorDocNro
          : undefined,
        receptorCondicionIva: fiscal
          ? clienteVacio
            ? ARCA_CONDICION_IVA.CF
            : Number(receptorCondicionIva)
          : undefined,
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
      setComprobanteModalOpen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <ClassicFilteredTableLayout
      title="FACTURA"
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-4">
        <div className="shrink-0 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-5 gap-4">
            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>TIPO COMPROBANTE</ModalMicroLabel>
              <Select
                value={tipo}
                onValueChange={(value) => {
                  if (esFacturaTipo(value)) setTipo(value);
                }}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACTURA_TIPOS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {FACTURA_TIPO_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
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

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>CLIENTE</ModalMicroLabel>
              <div ref={clienteWrapRef} className="relative z-20 w-full">
                <Input
                  ref={clienteInputRef}
                  id="factura-crear-buscar-cliente"
                  type="text"
                  value={cliente}
                  onChange={(e) => {
                    const next = e.target.value.toLocaleUpperCase("es-AR");
                    setClienteId(null);
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
                  onFocus={() => {
                    if (
                      puedeBuscarClientes &&
                      cliente.trim() !== FACTURA_CLIENTE_CONSUMIDOR_FINAL
                    ) {
                      setClientesAbierto(true);
                    }
                  }}
                  placeholder={FACTURA_CLIENTE_CONSUMIDOR_FINAL}
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
                  variant="default"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 shrink-0 rounded-l-none rounded-r-md"
                  onClick={() => setCrearClienteOpen(true)}
                  aria-label="Crear cliente"
                  title="Crear cliente"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
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
                      <ul className={TYPEAHEAD_LISTBOX_UL_CLASS}>
                        {sugerenciasClientes.map((item, idx) => {
                          const activo = idx === clienteHighlight;
                          const nombre =
                            nombreCompletoCliente(item) || "CONSUMIDOR FINAL";
                          const pintor = nombrePintorAsociadoCliente(item);
                          return (
                            <li key={item.id} role="option" aria-selected={activo}>
                              <div
                                role="button"
                                tabIndex={-1}
                                className={cn(
                                  TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS,
                                  "flex flex-col gap-0.5 px-2 text-left",
                                  activo && TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS
                                )}
                                onMouseEnter={() => setClienteHighlight(idx)}
                                onClick={() => aplicarClienteSeleccionado(item)}
                              >
                                <span className="min-w-0 truncate">
                                  {nombre}
                                  {" - "}
                                  <span className="tabular-nums text-muted-foreground">
                                    {CLIENTE_SALDO_PLACEHOLDER}
                                  </span>
                                </span>
                                {pintor ? (
                                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                                    ({pintor})
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>N° COMPROBANTE</ModalMicroLabel>
              <Input
                type="text"
                readOnly
                value={nroComprobante}
                placeholder="—"
                className="bg-muted/40 tabular-nums"
                aria-label="Número de comprobante (solo lectura)"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <ModalMicroLabel>COMENTARIOS</ModalMicroLabel>
              <Input
                type="text"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Comentarios"
                autoComplete="off"
                aria-label="Comentarios"
              />
            </label>
          </div>

          {fiscal ? (
            <div className="mt-4 grid grid-cols-5 gap-4">
              <label className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>PTO. VTA.</ModalMicroLabel>
                <Select value={ptoVtaId} onValueChange={setPtoVtaId}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="Punto de venta" />
                  </SelectTrigger>
                  <SelectContent>
                    {ptoVtas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.ptoVenta} — {p.nombreTitular}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>COND. IVA RECEPTOR</ModalMicroLabel>
                <Select
                  value={receptorCondicionIva}
                  onValueChange={setReceptorCondicionIva}
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {condicionesIva
                      .filter((c) => c.activo)
                      .map((c) => (
                        <SelectItem key={c.codigo} value={String(c.codigo)}>
                          {c.codigo} — {etiquetaCondicionIvaArca(c.descripcion)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>TIPO DOC.</ModalMicroLabel>
                <Select value={receptorDocTipo} onValueChange={setReceptorDocTipo}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACTURA_DOC_TIPO_OPTIONS.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>NRO. DOC.</ModalMicroLabel>
                <Input
                  type="text"
                  value={receptorDocNro}
                  onChange={(e) => setReceptorDocNro(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="tabular-nums"
                  autoComplete="off"
                  aria-label="Número de documento del receptor"
                />
              </label>

              {esFacturaTipoNotaCredito(tipo) ? (
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
              ) : (
                <div />
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-5 gap-4">
              <label className="flex min-w-0 flex-col gap-1">
                <ModalMicroLabel>PTO. VTA.</ModalMicroLabel>
                <Select value={ptoVtaId} onValueChange={setPtoVtaId}>
                  <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}>
                    <SelectValue placeholder="Punto de venta" />
                  </SelectTrigger>
                  <SelectContent>
                    {ptoVtas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.ptoVenta} — {p.nombreTitular}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <FacturaCrearLineasBlock onRemitoChange={handleRemitoChange} />
        </div>
      </div>

      <FacturaGenerarComprobanteModal
        open={comprobanteModalOpen}
        onOpenChange={(open) => {
          setComprobanteModalOpen(open);
          if (!open) setComprobantePdf(null);
        }}
        comprobante={comprobantePdf}
      />
    </ClassicFilteredTableLayout>
  );
}
