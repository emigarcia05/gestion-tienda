"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AppModal from "@/components/shared/AppModal";
import FiltroBusquedaInput from "@/components/shared/FiltroBusquedaInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyTableRow,
} from "@/components/ui/table";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import {
  TablaControlItemCelda,
  TablaControlItemHead,
} from "@/components/shared/TablaControlItem";
import { toast } from "sonner";
import type { PedidoHistoriaEstado } from "@/services/pedidosHistoria.service";
import type { PedidoHistoriaDetalle } from "@/services/pedidosHistoria.service";
import type { ProductoTiendaRowBusqueda } from "@/services/productosTienda.service";
import {
  crearPedidoHistoriaRecepcionDirectaAction,
  eliminarPedidoHistoriaAction,
  guardarRecepcionPedidoHistoriaAction,
  marcarPedidoHistoriaRegistradoAction,
  registrarNotaCreditoCompraPedidoAction,
} from "@/actions/pedidosHistoria";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import NumeroComprobanteBloquesInput from "@/components/shared/NumeroComprobanteBloquesInput";
import {
  COMPROBANTE_COMPRA_NRO_DIGITOS,
  NUMERO_COMPROBANTE_COMPRA_REGEX,
  TIPO_COMP_COMPRA,
  digitosBloqueComprobante,
  digitosPuntoVentaComprobante,
  formatearNumeroComprobanteCompra,
  numeroComprobanteCompraCompleto,
} from "@/lib/numeroComprobanteCompra";
import { fetchPedidoHistoriaDetalle } from "@/lib/fetchPedidoHistoriaDetalle";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import AgregarProductosModal from "@/components/pedidos/AgregarProductosModal";
import { BotoneraStepperVertical } from "@/components/shared/EnteroStepperInput";
import MontoArInput from "@/components/shared/MontoArInput";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import {
  dateToIsoYmdArgentina,
  formatDdMmHhMmArgentina,
} from "@/lib/fechaArgentina";
import { SUCURSAL_LABEL_PEDIDO } from "@/lib/pedidos";
import {
  COD_TIENDA_PROD_VARIO_RECEPCION,
  esItemProdVarioRecepcion,
  etiquetaDescripcionRecepcion,
  nuevoCodExtProdVario,
} from "@/lib/prodVarioRecepcion";
import type { IvaValue } from "@/lib/validations/iva";

/** Texto plano de un error desconocido (throws de Server Actions / runtime). Incluye `digest` si React/Next lo adjuntan. */
function mensajeErrorDesconocido(e: unknown): string {
  if (e instanceof Error) {
    const digest =
      "digest" in e && typeof (e as { digest?: unknown }).digest === "string"
        ? (e as { digest: string }).digest
        : null;
    return digest ? `${e.message}\n\ndigest: ${digest}` : e.message;
  }
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function parseIntSafe(value: string): number {
  const t = value.trim();
  if (t === "" || t === "-") return 0;
  const n = Math.trunc(Number(t));
  return Number.isFinite(n) ? n : 0;
}

function sanitizeEnteroConSignoInput(raw: string, maxDigits = 6): string {
  const t = raw.replace(/[^\d-]/g, "");
  const neg = t.startsWith("-");
  const digits = t.replace(/-/g, "").slice(0, maxDigits);
  if (neg) return digits === "" ? "-" : `-${digits}`;
  return digits;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildChecklistConfirmadoInicial(
  items: PedidoHistoriaDetalle["items"],
  estado: PedidoHistoriaEstado,
  esNotaCredito: boolean
): Record<string, boolean> {
  // En pedidos ya recepcionados, partimos con todos los ítems marcados como revisados
  // para que el flujo de corrección solo requiera tocar lo que cambió.
  if (estado === "RECEPCIONADO" && !esNotaCredito) {
    return Object.fromEntries(items.map((item) => [item.id, true]));
  }
  return {};
}

const inputBorderClassName = "border-[#0072bb] focus-visible:ring-[#0072bb]";

/**
 * Cabecera resumen: proveedor + metadatos | fecha factura (dos columnas ~85% / ~15%).
 */
const GRID_CAPAS_SUP_PEDIDO_HISTORIA =
  "grid min-w-0 w-full grid-cols-[85fr_15fr] items-center gap-0";

/** Recepción sin comprobante: datos | FISCAL | N° COMPROBANTE | FECHA FACTURA. */
const GRID_CAPAS_SUP_RECEPCION_COMPROBANTE =
  "grid min-w-0 w-full grid-cols-[44fr_13fr_28fr_15fr] items-end gap-3";

/**
 * Mismas columnas que la tabla de ítems (check | desc | cant.p. | cant.r. | acciones).
 * `minmax(0, …)` evita que el texto de Agregar Producto ensanche la última columna
 * por encima del 15 % de ACCIONES.
 */
const GRID_PEDIDO_HISTORIA_TABLA_COLS =
  "grid w-full grid-cols-[minmax(0,5%)_minmax(0,50%)_minmax(0,10%)_minmax(0,20%)_minmax(0,15%)]";

/** Contenedor de grilla: sin borde ni fondo (transparente). */
const MODAL_SECTION_CARD_CLASS = "min-w-0 bg-transparent";

const MODAL_RESUMEN_PANEL_CLASS = "min-w-0 bg-transparent";

/** Total normalizado (`totalPedido`) distinto de vacío y distinto de 0 (admite negativo). */
function totalPedidoMontoValido(norm: string): boolean {
  if (norm === "" || norm === "-") return false;
  const n = Number(norm);
  return Number.isFinite(n) && n !== 0;
}

/**
 * NC: CANT. PED. pasa a ser lo recibido (tope a devolver) y CANT. REC. arranca vacía
 * para cargar lo devuelto con el mismo checklist de la recepción.
 */
function itemsParaNotaCredito(
  items: PedidoHistoriaDetalle["items"]
): PedidoHistoriaDetalle["items"] {
  return items
    .filter((it) => (it.cantRecibida ?? 0) > 0)
    .map((it) => ({ ...it, cantPedida: it.cantRecibida ?? 0, cantRecibida: null }));
}

function fmtPesos(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PedidoHistoriaDetalleVariante = "recepcion" | "nota-credito";

export type ProveedorRecepcionDirecta = {
  id: string;
  nombre: string;
  iva: IvaValue;
};

const PROVEEDORES_RECEPCION_VACIO: ProveedorRecepcionDirecta[] = [];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoHistoriaId: string | null;
  variante?: PedidoHistoriaDetalleVariante;
  /** Recepción de mercadería que no se pidió por el sistema: el proveedor se elige en el modal. */
  recepcionDirecta?: boolean;
  proveedoresMercaderia?: ProveedorRecepcionDirecta[];
}

export default function PedidoHistoriaDetalleModal({
  open,
  onOpenChange,
  pedidoHistoriaId,
  variante = "recepcion",
  recepcionDirecta = false,
  proveedoresMercaderia = PROVEEDORES_RECEPCION_VACIO,
}: Props) {
  const esNotaCredito = variante === "nota-credito";
  /** Cabecera creada al confirmar una recepción directa; si se cierra sin marcar, se borra. */
  const pedidoCreadoIdRef = useRef<string | null>(null);
  const recepcionPersistidaRef = useRef(false);
  const confirmadaRef = useRef(false);
  const [pedidoCreadoId, setPedidoCreadoId] = useState<string | null>(null);
  const [cerrandoRecepcionDirecta, setCerrandoRecepcionDirecta] = useState(false);
  const [detalle, setDetalle] = useState<PedidoHistoriaDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  /** Valor normalizado para lógica futura: "" | "123" | "123.45" (punto decimal). */
  const [totalPedido, setTotalPedido] = useState<string>("");
  const [agregarProductosOpen, setAgregarProductosOpen] = useState(false);
  const [busquedaAgregarProducto, setBusquedaAgregarProducto] = useState("");
  /** Solo ítems cuyo checklist todavía no se confirmó. */
  const [soloPendientesConfirmacion, setSoloPendientesConfirmacion] = useState(false);
  /** Valor ISO `YYYY-MM-DD` — UI: campo FECHA FACTURA. */
  const [fechaRecepcion, setFechaRecepcion] = useState<string>("");
  /** Check list por ítem: solo se marca vía botón OK (confirma cant. recibida) o cesto (0 + verificar). */
  const [checkListConfirmedByItem, setCheckListConfirmedByItem] = useState<Record<string, boolean>>(
    {}
  );
  /** Modo de corrección en pedidos RECEPCIONADO (edición local de UI). */
  const [modoCorreccionRecepcionado, setModoCorreccionRecepcionado] = useState(false);
  const [fiscal, setFiscal] = useState(false);
  const [numeroComprobante, setNumeroComprobante] = useState("");
  /** Recepción: N° `PPPP-NNNNNNNN` en dígitos sin ceros a la izquierda por bloque. */
  const [comprobantePv, setComprobantePv] = useState("");
  const [comprobanteNro, setComprobanteNro] = useState("");
  const fechaInputRef = useRef<HTMLInputElement>(null);
  const comprobantePvRef = useRef<HTMLInputElement>(null);
  const busquedaAgregarRef = useRef<HTMLInputElement>(null);
  const cantRecEditingInputRef = useRef<HTMLInputElement>(null);

  const estado: PedidoHistoriaEstado | null = detalle ? detalle.estado : null;
  const bloqueadoPorEstado = estado === "RECEPCIONADO" && !esNotaCredito;
  const locked = bloqueadoPorEstado && !modoCorreccionRecepcionado;
  const comprobanteCompra = detalle?.comprobanteCompra ?? null;
  /** Recepción (primera o corrección, que reemplaza el comprobante) o NC: se elige fiscal y N°. */
  const pideComprobante = esNotaCredito || !locked;
  const fiscalEditable = detalle?.proveedorIva === "PREGUNTA";
  /** Recepción sin comprobante aún: FISCAL → N° (dos bloques) → FECHA FACTURA en la cabecera. */
  const pideComprobanteRecepcion = pideComprobante && !esNotaCredito;
  const busy = guardando != null || loading;

  const generadoAtStr = useMemo(() => {
    const d = toDate(detalle?.generadoAt ?? null);
    return d ? formatDdMmHhMmArgentina(d) : "";
  }, [detalle?.generadoAt]);

  const cargarDetalle = useCallback(
    async (
      id: string,
      options?: { preserveChecklist?: boolean }
    ): Promise<PedidoHistoriaDetalle | null> => {
    const res = await fetchPedidoHistoriaDetalle(id);
    if (!res.ok) {
      setDetalle(null);
      const userLine = res.error ?? "Error al cargar detalle.";
      setErrorMsg(userLine);
      return null;
    }
    const detalleParaUi = esNotaCredito
      ? { ...res.data, items: itemsParaNotaCredito(res.data.items) }
      : res.data;
    setDetalle(detalleParaUi);
    setFiscal(detalleParaUi.proveedorIva === "SIEMPRE");
    const checklistInicial = buildChecklistConfirmadoInicial(
      detalleParaUi.items,
      detalleParaUi.estado,
      esNotaCredito
    );
    setCheckListConfirmedByItem((prev) => {
      if (!options?.preserveChecklist) return checklistInicial;
      const merged = { ...checklistInicial };
      for (const item of detalleParaUi.items) {
        if (prev[item.id] === true) merged[item.id] = true;
      }
      return merged;
    });
    if (esNotaCredito) {
      setErrorMsg(
        res.data.comprobanteCompra
          ? null
          : "El pedido no tiene comprobante de compra (se recepcionó antes de esta función)."
      );
      return detalleParaUi;
    }
    if (res.data.total != null && Number.isFinite(res.data.total) && res.data.total !== 0) {
      const totalNorm = String(res.data.total);
      setTotalPedido(totalNorm);
    }
    if (res.data.fechaRecepcionIso) {
      setFechaRecepcion(res.data.fechaRecepcionIso);
    } else if (res.data.estado === "RECEPCIONADO") {
      const d = toDate(res.data.generadoAt);
      if (d) setFechaRecepcion(dateToIsoYmdArgentina(d));
    }
    setErrorMsg(null);
    return detalleParaUi;
  }, [esNotaCredito]);

  useEffect(() => {
    if (!open || !pedidoHistoriaId) return;

    queueMicrotask(() => {
      setDetalle(null);
      setErrorMsg(null);
      setLoading(true);
      setEditingItemId(null);
      setEditingValue("");
      setTotalPedido("");
      setAgregarProductosOpen(false);
      setBusquedaAgregarProducto("");
      setSoloPendientesConfirmacion(false);
      setFechaRecepcion("");
      setCheckListConfirmedByItem({});
      setModoCorreccionRecepcionado(false);
      setFiscal(false);
      setNumeroComprobante("");
      setComprobantePv("");
      setComprobanteNro("");
    });

    void (async () => {
      try {
        await cargarDetalle(pedidoHistoriaId);
      } catch (e) {
        const raw = mensajeErrorDesconocido(e);
        setErrorMsg(raw);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, pedidoHistoriaId, cargarDetalle]);

  useEffect(() => {
    if (!open || !recepcionDirecta) return;
    pedidoCreadoIdRef.current = null;
    recepcionPersistidaRef.current = false;
    confirmadaRef.current = false;
    queueMicrotask(() => {
      setDetalle(null);
      setPedidoCreadoId(null);
      setCerrandoRecepcionDirecta(false);
      setErrorMsg(null);
      setLoading(false);
      setEditingItemId(null);
      setEditingValue("");
      setTotalPedido("");
      setAgregarProductosOpen(false);
      setBusquedaAgregarProducto("");
      setSoloPendientesConfirmacion(false);
      setFechaRecepcion("");
      setCheckListConfirmedByItem({});
      setModoCorreccionRecepcionado(false);
      setFiscal(false);
      setNumeroComprobante("");
      setComprobantePv("");
      setComprobanteNro("");
    });
  }, [open, recepcionDirecta]);

  const proveedorElegidoId = recepcionDirecta ? (detalle?.proveedorId ?? "") : "";

  useEffect(() => {
    if (!open || locked || loading) return;
    if (recepcionDirecta && !proveedorElegidoId) return;
    queueMicrotask(() => {
      (pideComprobanteRecepcion ? comprobantePvRef : fechaInputRef).current?.focus();
    });
  }, [open, pedidoHistoriaId, locked, loading, pideComprobanteRecepcion, recepcionDirecta, proveedorElegidoId]);

  function irAFechaFactura() {
    const el = fechaInputRef.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker();
    } catch {
      /* showPicker no disponible o sin gesto de usuario: queda el foco. */
    }
  }

  useEffect(() => {
    if (!editingItemId) return;
    queueMicrotask(() => {
      cantRecEditingInputRef.current?.focus();
    });
  }, [editingItemId]);

  function actualizarItemCantRecibidaLocal(
    pedidoHistoriaItemId: string,
    cantRecibida: number,
    options?: { confirmChecklistAfter?: boolean }
  ): boolean {
    if (locked) return false;
    if (guardando) return false;
    if (fechaRecepcion.trim() === "") return false;

    setDetalle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.id === pedidoHistoriaItemId ? { ...it, cantRecibida } : it
        ),
      };
    });
    setEditingItemId(null);
    setEditingValue("");
    if (options?.confirmChecklistAfter) {
      setCheckListConfirmedByItem((prev) => ({
        ...prev,
        [pedidoHistoriaItemId]: true,
      }));
      setBusquedaAgregarProducto("");
    } else {
      setCheckListConfirmedByItem((prev) => {
        const next = { ...prev };
        delete next[pedidoHistoriaItemId];
        return next;
      });
    }
    return true;
  }

  function onClickOk(item: PedidoHistoriaDetalle["items"][number]) {
    return () => {
      if (locked || busy) return;
      if (fechaRecepcion.trim() === "") return;
      const cant = Math.max(0, item.cantPedida);
      actualizarItemCantRecibidaLocal(item.id, cant, {
        confirmChecklistAfter: true,
      });
    };
  }

  function onClickCesto(item: PedidoHistoriaDetalle["items"][number]) {
    return () => {
      if (locked || busy) return;
      if (fechaRecepcion.trim() === "") return;
      actualizarItemCantRecibidaLocal(item.id, 0, {
        confirmChecklistAfter: true,
      });
    };
  }

  function onClickEditar(item: PedidoHistoriaDetalle["items"][number]) {
    return () => {
      if (locked) return;
      if (busy) return;
      if (fechaRecepcion.trim() === "") return;
      const cantInicial = Math.max(0, item.cantPedida);
      const ok = actualizarItemCantRecibidaLocal(item.id, cantInicial);
      if (!ok) return;
      setEditingItemId(item.id);
      setEditingValue(String(cantInicial));
    };
  }

  async function agregarNuevaFila(
    producto: ProductoTiendaRowBusqueda,
    cantRecibida: number | null
  ) {
    if (locked) return;
    if (fechaRecepcion.trim() === "") return;
    if (!detalle) return;
    const cant =
      cantRecibida == null ? null : Math.trunc(Number(cantRecibida));
    if (cant != null && (!Number.isFinite(cant) || cant === 0)) {
      toast.error("Ingresá una Cant. Recibida distinta de 0.");
      return;
    }
    const codNormalizado = producto.codTienda.trim();
    const yaExiste = detalle.items.some((it) => it.codTienda === codNormalizado);
    if (yaExiste) {
      toast.error("El producto ya existe en el pedido.");
      return;
    }

    const tempId = `tmp-${crypto.randomUUID()}`;
    setDetalle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: tempId,
            codTienda: codNormalizado,
            codExt: codNormalizado,
            descripcionTienda: producto.descripcionTienda,
            cantPedida: cant == null ? 0 : Math.max(0, cant),
            cantRecibida: cant,
          },
        ],
      };
    });
    if (cant == null) {
      setBusquedaAgregarProducto("");
      setEditingItemId(tempId);
      setEditingValue("");
    } else {
      setCheckListConfirmedByItem((prev) => ({ ...prev, [tempId]: true }));
      queueMicrotask(() => {
        setEditingItemId(null);
        setEditingValue("");
        busquedaAgregarRef.current?.focus();
      });
    }
    setAgregarProductosOpen(false);
    toast.success("Ítem agregado.");
  }

  async function agregarFilaVario(descripcion: string) {
    if (locked || esNotaCredito) return;
    if (fechaRecepcion.trim() === "") return;
    if (!detalle) return;
    const desc = descripcion.trim().slice(0, 500);
    if (!desc) return;

    const tempId = `tmp-${crypto.randomUUID()}`;
    setDetalle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: tempId,
            codTienda: COD_TIENDA_PROD_VARIO_RECEPCION,
            codExt: nuevoCodExtProdVario(),
            descripcionTienda: desc,
            cantPedida: 0,
            cantRecibida: null,
          },
        ],
      };
    });
    setBusquedaAgregarProducto("");
    setEditingItemId(tempId);
    setEditingValue("");
    setAgregarProductosOpen(false);
    toast.success("Ítem agregado.");
  }

  function ajustarEditingValue(delta: number) {
    if (locked || busy) return;
    if (fechaRecepcion.trim() === "") return;
    const current = parseIntSafe(editingValue);
    const next = current + delta;
    setEditingValue(next === 0 ? "" : String(next));
  }

  function onClickConfirmarEdicion(item: PedidoHistoriaDetalle["items"][number]) {
    return () => {
      if (locked || busy) return;
      if (fechaRecepcion.trim() === "") return;
      if (editingItemId !== item.id) return;
      const cant = parseIntSafe(editingValue);
      actualizarItemCantRecibidaLocal(item.id, cant, {
        confirmChecklistAfter: true,
      });
    };
  }

  const itemsOrdenados = useMemo(() => detalle?.items ?? [], [detalle?.items]);

  const itemsFiltrados = useMemo(() => {
    const q = busquedaAgregarProducto.trim().toLocaleLowerCase("es");
    return itemsOrdenados.filter((it) => {
      if (soloPendientesConfirmacion && checkListConfirmedByItem[it.id] === true) return false;
      if (!q) return true;
      return etiquetaDescripcionRecepcion(it).toLocaleLowerCase("es").includes(q);
    });
  }, [itemsOrdenados, busquedaAgregarProducto, soloPendientesConfirmacion, checkListConfirmedByItem]);

  const fechaFacturaOk = fechaRecepcion.trim() !== "";
  const checklistCompleto =
    itemsOrdenados.length > 0 &&
    itemsOrdenados.every((it) => checkListConfirmedByItem[it.id] === true);
  const tablaYAltaHabilitados = !locked && !loading && fechaFacturaOk;
  const totalPedidoInputHabilitado = tablaYAltaHabilitados && checklistCompleto;
  const comprobanteOk = !pideComprobante
    ? true
    : esNotaCredito
      ? !fiscal || numeroComprobante.trim() !== ""
      : numeroComprobanteCompraCompleto(comprobantePv, comprobanteNro);
  const totalNum = Number(totalPedido);
  const totalOk = esNotaCredito
    ? totalPedidoMontoValido(totalPedido) &&
      totalNum > 0 &&
      comprobanteCompra != null &&
      totalNum <= comprobanteCompra.saldo
    : totalPedidoMontoValido(totalPedido);
  const sinProveedor = recepcionDirecta && !detalle?.proveedorId;
  const puedeConfirmarRecepcion =
    (Boolean(pedidoHistoriaId) || (recepcionDirecta && Boolean(detalle?.proveedorId))) &&
    !cerrandoRecepcionDirecta &&
    !locked &&
    !busy &&
    !errorMsg &&
    fechaFacturaOk &&
    checklistCompleto &&
    totalOk &&
    comprobanteOk;

  function elegirProveedorRecepcionDirecta(id: string) {
    if (id === "none" || pedidoCreadoIdRef.current) return;
    const prov = proveedoresMercaderia.find((p) => p.id === id);
    if (!prov) return;
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Seleccioná un usuario en el slidenav.");
      return;
    }
    setDetalle({
      id: "nueva",
      generadoAt: new Date().toISOString(),
      registradoAt: null,
      fechaRecepcionIso: null,
      total: null,
      estado: "ABIERTO",
      proveedorId: prov.id,
      proveedorNombre: prov.nombre,
      proveedorIva: prov.iva,
      sucursalId: "",
      sucursalNombre: SUCURSAL_LABEL_PEDIDO[usuario.sucursalPorDefecto],
      comprobanteCompra: null,
      items: [],
    });
    setFiscal(prov.iva === "SIEMPRE");
    setCheckListConfirmedByItem({});
    setTotalPedido("");
    setEditingItemId(null);
    setEditingValue("");
    setErrorMsg(null);
  }

  function personalIdSesion(): number | null {
    const usuario = leerUsuarioSesion();
    if (!usuario) {
      toast.error("Seleccioná un usuario en el slidenav.");
      return null;
    }
    return usuario.idPersonal;
  }

  async function confirmarRecepcion() {
    if (!puedeConfirmarRecepcion || guardando || cerrandoRecepcionDirecta || !detalle) return;
    const personalId = personalIdSesion();
    if (personalId == null) return;

    setGuardando("post");
    try {
      let id = pedidoCreadoIdRef.current ?? pedidoHistoriaId;
      if (recepcionDirecta && !id) {
        const usuario = leerUsuarioSesion();
        if (!usuario) {
          toast.error("Seleccioná un usuario en el slidenav.");
          return;
        }
        const creado = await crearPedidoHistoriaRecepcionDirectaAction({
          proveedorId: detalle.proveedorId,
          sucursalCodigo: usuario.sucursalPorDefecto,
        });
        if (!creado.ok) {
          toast.error(creado.error ?? "Error al crear la recepción.");
          return;
        }
        id = creado.data.id;
        pedidoCreadoIdRef.current = id;
        setPedidoCreadoId(id);
      }
      if (!id) return;

      if (!recepcionDirecta || !recepcionPersistidaRef.current) {
        const guardadoOk = await persistirRecepcionActual(personalId, id);
        if (!guardadoOk) return;
        if (recepcionDirecta) recepcionPersistidaRef.current = true;
      }

      const marcar = await marcarPedidoHistoriaRegistradoAction({
        pedidoHistoriaId: id,
        totalPedido: Number(totalPedido),
        fechaRecepcionIso: fechaRecepcion,
        personalId,
        fiscal,
        numeroComprobante: formatearNumeroComprobanteCompra(comprobantePv, comprobanteNro),
      });
      if (!marcar.ok) {
        const line =
          marcar.error ?? "Error al marcar el pedido como recepcionado.";
        toast.error(line);
        return;
      }

      if (modoCorreccionRecepcionado && pedidoHistoriaId) {
        setModoCorreccionRecepcionado(false);
        await cargarDetalle(pedidoHistoriaId);
        toast.success("Corrección guardada. Se generó un nuevo comprobante de compra.");
        return;
      }
      confirmadaRef.current = true;
      pedidoCreadoIdRef.current = null;
      toast.success("Pedido recepcionado. Stock registrado.");
      onOpenChange(false);
    } catch {
      toast.error("Error inesperado al confirmar la recepción.");
    } finally {
      setGuardando(null);
    }
  }

  /** La corrección reemplaza el comprobante: se precarga el anterior y se bloquea si ya tiene pagos / NC. */
  function iniciarCorreccion() {
    if (comprobanteCompra && comprobanteCompra.montoAplicado > 0) {
      toast.error(
        "El comprobante de compra ya tiene pagos o notas de crédito aplicadas: no se puede corregir."
      );
      return;
    }
    if (comprobanteCompra) {
      setFiscal(comprobanteCompra.tipoComp === TIPO_COMP_COMPRA.FISCAL);
      if (NUMERO_COMPROBANTE_COMPRA_REGEX.test(comprobanteCompra.numero)) {
        const [pv, nro] = comprobanteCompra.numero.split("-");
        setComprobantePv(
          digitosPuntoVentaComprobante(pv ?? "")
        );
        setComprobanteNro(
          digitosBloqueComprobante(nro ?? "", COMPROBANTE_COMPRA_NRO_DIGITOS)
        );
      }
    }
    setModoCorreccionRecepcionado(true);
  }

  async function generarNotaCredito() {
    if (!pedidoHistoriaId || !detalle || !puedeConfirmarRecepcion || guardando) return;
    const personalId = personalIdSesion();
    if (personalId == null) return;

    setGuardando("nota-credito");
    try {
      const res = await registrarNotaCreditoCompraPedidoAction({
        pedidoHistoriaId,
        personalId,
        fiscal,
        numeroComprobante: fiscal ? numeroComprobante.trim() : undefined,
        fechaIso: fechaRecepcion,
        total: totalNum,
        items: detalle.items
          .filter((it) => !esItemProdVarioRecepcion(it.codTienda))
          .map((it) => ({
            codTienda: it.codTienda,
            cantidad: Math.max(0, it.cantRecibida ?? 0),
          })),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Error al registrar la nota de crédito.");
        return;
      }
      toast.success(
        `Nota de crédito ${res.data.numero} registrada. Saldo a pagar: ${fmtPesos(res.data.saldo)}.`
      );
      onOpenChange(false);
    } catch {
      toast.error("Error inesperado al registrar la nota de crédito.");
    } finally {
      setGuardando(null);
    }
  }

  async function persistirRecepcionActual(personalId: number, id: string): Promise<boolean> {
    if (!detalle) return false;
    try {
      const res = await guardarRecepcionPedidoHistoriaAction({
        pedidoHistoriaId: id,
        personalId,
        items: detalle.items.map((item) => ({
          id: item.id.startsWith("tmp-") ? undefined : item.id,
          codTienda: item.codTienda,
          codExt: item.codExt,
          descripcion: item.descripcionTienda,
          cantPedida: item.cantPedida,
          cantRecibida: item.cantRecibida,
        })),
        fechaRecepcionIso: fechaRecepcion.trim() || undefined,
      });
      if (!res.ok) {
        const line = res.error ?? "Error al guardar la recepción.";
        toast.error(line);
        return false;
      }
      return true;
    } catch {
      toast.error("Error inesperado al guardar la recepción.");
      return false;
    }
  }

  const bloquearNavegacionModalPorEdicionCantidad =
    editingItemId != null && !locked && fechaFacturaOk && !loading;

  function handleModalOpenChange(next: boolean) {
    if (!next && bloquearNavegacionModalPorEdicionCantidad) {
      toast.info(
        "Confirmá la cantidad con el ícono de verificación antes de continuar."
      );
      return;
    }
    if (!next && (recepcionDirecta && guardando != null || cerrandoRecepcionDirecta)) return;
    if (!next && recepcionDirecta) {
      const idCreado = pedidoCreadoIdRef.current;
      if (idCreado && !confirmadaRef.current) {
        pedidoCreadoIdRef.current = null;
        setCerrandoRecepcionDirecta(true);
        void eliminarPedidoHistoriaAction({ pedidoHistoriaId: idCreado }).finally(() => {
          onOpenChange(false);
        });
        return;
      }
    }
    onOpenChange(next);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleModalOpenChange}>
        <AppModal
          title={esNotaCredito ? "Nota de Crédito" : "Recepción de Compra"}
          scrollBody={false}
          size="xl"
          className="max-w-[66rem] h-[95vh] max-h-[95vh]"
          bodyShellClassName="p-0"
          padding="sm"
          headerClassName="pt-3 pb-3"
          footerClassName="py-3"
          bodyClassName="py-2.5"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                disabled={bloquearNavegacionModalPorEdicionCantidad || cerrandoRecepcionDirecta}
                onClick={() => handleModalOpenChange(false)}
              >
                Cerrar
              </Button>
              {!locked ? (
                <Button
                  type="button"
                  className="disabled:cursor-not-allowed"
                  onClick={() =>
                    void (esNotaCredito ? generarNotaCredito() : confirmarRecepcion())
                  }
                  disabled={
                    !puedeConfirmarRecepcion || bloquearNavegacionModalPorEdicionCantidad
                  }
                >
                  {esNotaCredito
                    ? "Generar Nota de Crédito"
                    : modoCorreccionRecepcionado
                      ? "Guardar Corrección"
                      : "Confirmar Recepción"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="disabled:cursor-not-allowed"
                  disabled={
                    guardando != null || loading || bloquearNavegacionModalPorEdicionCantidad
                  }
                  onClick={iniciarCorreccion}
                >
                  Corregir Recepcion
                </Button>
              )}
            </>
          }
        >
        <div className="flex min-h-0 flex-1 flex-col gap-0">
          <section
            aria-labelledby="pedido-historia-resumen-title"
            className="shrink-0"
            inert={bloquearNavegacionModalPorEdicionCantidad ? true : undefined}
          >
            <h2 id="pedido-historia-resumen-title" className="sr-only">
              Resumen del pedido
            </h2>
            <div
              className={cn(
                MODAL_RESUMEN_PANEL_CLASS,
                "pt-0 pb-1.5"
              )}
            >
              <div
                className={cn(
                  pideComprobanteRecepcion
                    ? GRID_CAPAS_SUP_RECEPCION_COMPROBANTE
                    : GRID_CAPAS_SUP_PEDIDO_HISTORIA,
                  "w-full"
                )}
              >
                <div
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col gap-0.5 py-0 text-left",
                    pideComprobanteRecepcion ? "justify-end" : "justify-center"
                  )}
                >
                  {comprobanteCompra ? (
                    <p className="text-xs leading-snug text-muted-foreground tabular-nums">
                      {`Comprobante N° ${comprobanteCompra.numero} · Total ${fmtPesos(
                        comprobanteCompra.total
                      )} · Saldo a pagar ${fmtPesos(comprobanteCompra.saldo)}`}
                    </p>
                  ) : null}
                  {pideComprobanteRecepcion ? (
                    <p className="text-[0.65rem] font-semibold leading-tight text-muted-foreground">
                      <span className="tabular-nums">
                        {detalle ? detalle.sucursalNombre : "—"}
                        {" - "}
                        {generadoAtStr || "—"}
                      </span>
                    </p>
                  ) : null}
                  {recepcionDirecta ? (
                    <Select
                      value={detalle?.proveedorId ?? ""}
                      onValueChange={elegirProveedorRecepcionDirecta}
                      disabled={pedidoCreadoId != null || guardando != null || cerrandoRecepcionDirecta}
                    >
                      <SelectTrigger className="w-full max-w-md font-semibold" aria-label="Proveedor">
                        <SelectValue placeholder="PROVEEDOR" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start">
                        {proveedoresMercaderia.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p
                      className={cn(
                        "text-sm font-semibold leading-snug text-foreground",
                        pideComprobanteRecepcion && "flex h-9 items-center"
                      )}
                    >
                      {detalle ? detalle.proveedorNombre : "—"}
                    </p>
                  )}
                  {pideComprobanteRecepcion ? null : (
                    <p className="text-xs leading-snug text-muted-foreground">
                      <span className="tabular-nums">
                        {detalle ? detalle.sucursalNombre : "—"}
                        {" - "}
                        {generadoAtStr || "—"}
                      </span>
                    </p>
                  )}
                </div>
                {pideComprobanteRecepcion ? (
                  <>
                    <div className="flex min-w-0 flex-col justify-end gap-0.5">
                      <ModalMicroLabel>IVA CREDITO</ModalMicroLabel>
                      <ModalSiNoChoice
                        label="FISCAL"
                        value={fiscal}
                        onChange={setFiscal}
                        disabled={!fiscalEditable || loading || sinProveedor}
                        className="h-9 py-0"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col justify-center gap-0.5">
                      <ModalMicroLabel>N° COMPROBANTE</ModalMicroLabel>
                      <NumeroComprobanteBloquesInput
                        puntoVenta={comprobantePv}
                        numero={comprobanteNro}
                        onPuntoVentaChange={setComprobantePv}
                        onNumeroChange={setComprobanteNro}
                        onCompletar={irAFechaFactura}
                        disabled={loading || sinProveedor}
                        puntoVentaRef={comprobantePvRef}
                        inputClassName={inputBorderClassName}
                      />
                    </div>
                  </>
                ) : null}
                <label
                  className={cn(
                    "flex min-h-0 min-w-0 w-full flex-col justify-center gap-0.5 py-0 text-left",
                    locked || loading || sinProveedor ? "cursor-default" : "cursor-pointer"
                  )}
                >
                  <ModalMicroLabel>{esNotaCredito ? "FECHA NC" : "FECHA FACTURA"}</ModalMicroLabel>
                  <Input
                    ref={fechaInputRef}
                    type="date"
                    value={fechaRecepcion}
                    onChange={(e) => setFechaRecepcion(e.target.value)}
                    disabled={locked || loading || sinProveedor}
                    aria-label={esNotaCredito ? "FECHA NC" : "FECHA FACTURA"}
                    className={cn(
                      "h-9 w-full min-w-0 tabular-nums text-left",
                      inputBorderClassName,
                      locked || loading || sinProveedor ? "cursor-not-allowed" : "cursor-pointer"
                    )}
                  />
                </label>
              </div>
            </div>
          </section>

          <div className="grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-x-3 gap-y-0 overflow-hidden">
            <section
              aria-labelledby="pedido-historia-agregar-recepcion-titulo"
              className={cn(
                MODAL_SECTION_CARD_CLASS,
                "flex shrink-0 flex-col gap-0 pb-2 pt-0",
                !tablaYAltaHabilitados &&
                  !locked &&
                  "pointer-events-none cursor-not-allowed opacity-50"
              )}
              inert={
                (!tablaYAltaHabilitados && !locked) ||
                bloquearNavegacionModalPorEdicionCantidad
                  ? true
                  : undefined
              }
            >
              <span
                id="pedido-historia-agregar-recepcion-titulo"
                className="sr-only"
              >
                AGREGAR PRODUCTO A LA RECEPCIÓN
              </span>
              <div className={cn(GRID_PEDIDO_HISTORIA_TABLA_COLS, "items-center px-px pt-1 pb-0")}>
                <div className="col-span-4 flex min-w-0 items-center gap-3">
                  <div className="min-w-0 max-w-[36rem] flex-1">
                    <FiltroBusquedaInput
                      id="pedido-historia-agregar-producto-filtro"
                      placeholder="BUSCAR POR DESCRIPCIÓN..."
                      value={busquedaAgregarProducto}
                      onChange={setBusquedaAgregarProducto}
                      isDebouncing={false}
                      inputRef={busquedaAgregarRef}
                      className="h-10 min-h-10"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <div className="flex items-stretch gap-2">
                      <span className="flex flex-col text-right text-xs font-semibold leading-tight text-foreground">
                        <span>PENDIENTE</span>
                        <span>CONFIRMACIÓN</span>
                      </span>
                      <Button
                        type="button"
                        variant={soloPendientesConfirmacion ? "default" : "outline"}
                        aria-pressed={soloPendientesConfirmacion}
                        aria-label="Filtrar ítems pendientes de confirmación"
                        onClick={() => setSoloPendientesConfirmacion((prev) => !prev)}
                        className={cn(
                          "aspect-square h-auto w-auto shrink-0 self-stretch rounded-md border-primary p-0",
                          !soloPendientesConfirmacion &&
                            "bg-card text-primary hover:bg-card hover:text-primary"
                        )}
                      >
                        <Check
                          className={cn("h-3.5 w-3.5", !soloPendientesConfirmacion && "opacity-0")}
                          aria-hidden
                        />
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setAgregarProductosOpen(true)}
                  disabled={
                    esNotaCredito || locked || loading || !fechaFacturaOk || guardando != null || sinProveedor
                  }
                  className={cn(
                    "h-10 min-h-10 w-full min-w-0 max-w-full cursor-pointer justify-center gap-1.5 overflow-hidden rounded-md px-2 py-1 text-sm font-normal text-primary-foreground [&_svg]:text-primary-foreground disabled:cursor-not-allowed"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Agregar Producto
                </Button>
              </div>
            </section>

            <section
              aria-label="Ítems del pedido"
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
            >
              <div
                className={cn(
                  MODAL_SECTION_CARD_CLASS,
                  "flex min-h-0 flex-1 flex-col overflow-hidden"
                )}
              >
                <div
                  className="contenedor-tabla-gestion no-scroll-x flex min-h-0 flex-1 flex-col overflow-hidden"
                  style={{ height: "auto" }}
                >
                  <div className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto no-scrollbar">
                    <div
                      className={cn(
                        !tablaYAltaHabilitados &&
                          !locked &&
                          "pointer-events-none cursor-not-allowed opacity-50"
                      )}
                    >
                    <Table variant="compact" className="tabla-recepcion-pedido" scrollX={false}>
                <TableHeader inert={editingItemId ? true : undefined}>
                  <TableRow>
                    <TablaControlItemHead />
                    <TableHead className="w-[50%]">DESCRIPCIÓN</TableHead>
                    <TableHead className="w-[10%]">
                      {esNotaCredito ? "CANT. REC." : "CANT. PED."}
                    </TableHead>
                    <TableHead className="w-[20%]">
                      {esNotaCredito ? "CANT. DEV." : "CANT. REC."}
                    </TableHead>
                    <TableHead className="w-[15%] tabla-bloque-secundario-head-divider">
                      ACCIONES
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <EmptyTableRow colSpan={5} message="CARGANDO…" />
                  ) : errorMsg ? (
                    <EmptyTableRow colSpan={5} message={errorMsg} />
                  ) : itemsFiltrados.length === 0 ? (
                    <EmptyTableRow
                      colSpan={5}
                      message={
                        busquedaAgregarProducto.trim()
                          ? "SIN ÍTEMS PARA LA DESCRIPCIÓN BUSCADA."
                          : soloPendientesConfirmacion
                            ? "SIN ÍTEMS PENDIENTES DE CONFIRMACIÓN."
                            : "SIN ÍTEMS."
                      }
                    />
                  ) : (
                    itemsFiltrados.map((item) => {
                      const isEditing = editingItemId === item.id;
                      const cantRecNum = item.cantRecibida ?? 0;
                      const cantRecibidaVisible =
                        item.cantRecibida != null ? String(item.cantRecibida) : "";
                      // Si por cualquier motivo el backend registra `cantPedida` en 0 pero el usuario
                      // ya cargó `cantRecibida` al agregar el producto, mostramos `cantRecibida` para
                      // que ambas columnas queden consistentes.
                      const cantPedidaVisible =
                        item.cantPedida > 0
                          ? item.cantPedida.toLocaleString("es-AR")
                          : cantRecNum > 0
                            ? cantRecNum.toLocaleString("es-AR")
                            : "";

                      const checkListConfirmed = checkListConfirmedByItem[item.id] === true;
                      /** En estado ABIERTO, la columna solo muestra valor tras confirmar checklist (OK / cesto / check edición). */
                      const cantRecibidaCeldaLectura =
                        (estado === "ABIERTO" || esNotaCredito) && !checkListConfirmed
                          ? ""
                          : cantRecibidaVisible;

                      return (
                        <TableRow
                          key={item.id}
                          inert={
                            editingItemId != null && !isEditing ? true : undefined
                          }
                          className={cn(
                            "transition-colors duration-100",
                            checkListConfirmed
                              ? "recepcion-fila-verificada cursor-not-allowed"
                              : "recepcion-fila-activa"
                          )}
                        >
                          <TablaControlItemCelda
                            verificado={checkListConfirmed}
                            ocultarPlaceholder={locked}
                            placeholderTitle="Verificá con OK, Editar o Cesto en la columna ACCIONES."
                          />
                          <TableCell
                            className={cn(
                              "celda-datos min-w-0 truncate w-[50%]",
                              checkListConfirmed && "font-medium text-foreground"
                            )}
                            title={
                              esItemProdVarioRecepcion(item.codTienda)
                                ? etiquetaDescripcionRecepcion(item)
                                : item.codTienda
                                  ? `${item.codTienda} — ${item.descripcionTienda}`
                                  : item.descripcionTienda
                            }
                          >
                            {etiquetaDescripcionRecepcion(item)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "celda-datos tabular-nums w-[10%]",
                              checkListConfirmed && "text-foreground"
                            )}
                          >
                            {cantPedidaVisible}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "celda-datos tabular-nums w-[20%]",
                              checkListConfirmed && !isEditing && "text-foreground"
                            )}
                          >
                            {locked ? (
                              cantRecibidaVisible
                            ) : isEditing ? (
                              <div className="factura-cant-stepper">
                                <Input
                                  ref={cantRecEditingInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  value={editingValue}
                                  onChange={(e) =>
                                    setEditingValue(sanitizeEnteroConSignoInput(e.target.value))
                                  }
                                  data-edit-input={item.id}
                                  onBlur={() => {
                                    if (
                                      editingValue.trim() === "" &&
                                      item.cantRecibida == null
                                    ) {
                                      setEditingItemId(null);
                                      setEditingValue("");
                                      return;
                                    }
                                    const v = parseIntSafe(editingValue);
                                    if (
                                      item.cantRecibida != null &&
                                      v === item.cantRecibida
                                    ) {
                                      setEditingItemId(null);
                                      setEditingValue("");
                                      return;
                                    }
                                    toast.info(
                                      "Confirmá la cantidad con el ícono de verificación."
                                    );
                                    queueMicrotask(() => {
                                      cantRecEditingInputRef.current?.focus();
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                  disabled={locked || busy || !fechaFacturaOk}
                                  className={cn(
                                    "h-[1.75rem] w-[2.75rem] max-w-[2.75rem] shrink-0 px-0.5 text-center tabular-nums",
                                    inputBorderClassName
                                  )}
                                />
                                <BotoneraStepperVertical
                                  onAumentar={() => ajustarEditingValue(1)}
                                  onDisminuir={() => ajustarEditingValue(-1)}
                                  disabled={locked || busy || !fechaFacturaOk}
                                  ariaAumentar="Aumentar cantidad recibida"
                                  ariaDisminuir="Disminuir cantidad recibida"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={onClickConfirmarEdicion(item)}
                                  disabled={locked || busy || !fechaFacturaOk}
                                  className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                  aria-label="Confirmar Edición"
                                  title="Confirmar Edición"
                                >
                                  <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                </Button>
                              </div>
                            ) : (
                              cantRecibidaCeldaLectura
                            )}
                          </TableCell>
                          <TableCell className="celda-datos w-[15%] tabla-bloque-secundario-cell-divider">
                            <div
                              className={cn(
                                TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                                checkListConfirmed && "cursor-auto"
                              )}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onClickOk(item)}
                                disabled={
                                  locked || busy || checkListConfirmed || !fechaFacturaOk
                                }
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                aria-label="OK"
                                title="OK"
                                data-ok-button={item.id}
                              >
                                <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onClickEditar(item)}
                                disabled={locked || busy || !fechaFacturaOk}
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                aria-label="Editar"
                                title="Editar"
                              >
                                <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onClickCesto(item)}
                                disabled={locked || busy || !fechaFacturaOk}
                                className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                aria-label="Cesto De Basura"
                                title="Cesto De Basura"
                              >
                                <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                    </Table>
                    </div>
                  </div>
                  <section
                    aria-label="Totales del pedido"
                    className={cn(
                      GRID_PEDIDO_HISTORIA_TABLA_COLS,
                      "min-w-0 shrink-0 border-t border-border bg-background py-2 items-center",
                      !totalPedidoInputHabilitado &&
                        !locked &&
                        "pointer-events-none cursor-not-allowed opacity-50"
                    )}
                    inert={
                      (!totalPedidoInputHabilitado && !locked) ||
                      bloquearNavegacionModalPorEdicionCantidad
                        ? true
                        : undefined
                    }
                  >
                    {pideComprobante && esNotaCredito ? (
                      <div className="celda-datos col-start-2 col-span-2 flex min-w-0 items-center gap-3 border-b-0">
                        <ModalSiNoChoice
                          label="FISCAL"
                          value={fiscal}
                          onChange={setFiscal}
                          disabled={!fiscalEditable || locked || loading}
                          className="shrink-0 py-1.5"
                        />
                        {fiscal ? (
                          <Input
                            type="text"
                            value={numeroComprobante}
                            onChange={(e) => setNumeroComprobante(e.target.value)}
                            maxLength={50}
                            placeholder={esNotaCredito ? "N° NOTA DE CRÉDITO" : "N° FACTURA"}
                            aria-label={esNotaCredito ? "N° Nota de Crédito" : "N° Factura"}
                            disabled={locked || loading}
                            className={cn("h-9 min-w-0 flex-1 tabular-nums", inputBorderClassName)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            N° correlativo automático
                          </span>
                        )}
                      </div>
                    ) : null}
                    <div className="celda-datos col-start-4 flex items-center justify-end border-b-0 text-right">
                      <span className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                        {esNotaCredito ? "TOTAL NC" : "TOTAL PEDIDO"}
                      </span>
                    </div>
                    <div className="celda-datos celda-datos--flush-left celda-datos--flush-right col-start-5 flex min-w-0 items-center justify-start gap-0 border-b-0">
                      <MontoArInput
                        variant="totalPedido"
                        allowNegative={!esNotaCredito}
                        disabled={locked || loading || !totalPedidoInputHabilitado}
                        valueNormalized={totalPedido}
                        onValueNormalizedChange={setTotalPedido}
                        className={cn(
                          "w-full",
                          inputBorderClassName
                        )}
                        aria-label={esNotaCredito ? "Total Nota de Crédito" : "Total Pedido"}
                      />
                    </div>
                  </section>
              </div>
              </div>
            </section>
          </div>
        </div>
        </AppModal>
      </Dialog>

      <AgregarProductosModal
        open={agregarProductosOpen}
        onOpenChange={setAgregarProductosOpen}
        proveedorId={detalle?.proveedorId || undefined}
        initialBusqueda={busquedaAgregarProducto}
        onAgregar={async (row, cantRecibida) => {
          await agregarNuevaFila(row, cantRecibida);
        }}
        onAgregarVario={
          esNotaCredito
            ? undefined
            : async (descripcion) => {
                await agregarFilaVario(descripcion);
              }
        }
      />
    </>
  );
}

