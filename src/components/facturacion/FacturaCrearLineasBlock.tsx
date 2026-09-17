"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, MessageSquare, Percent, Search, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buscarProductosFacturaAction } from "@/actions/factura";
import FacturaDescuentoModal from "@/components/facturacion/FacturaDescuentoModal";
import FacturaLineaComentarioModal from "@/components/facturacion/FacturaLineaComentarioModal";
import FacturaProductoStockModal from "@/components/facturacion/FacturaProductoStockModal";
import PorcentajeCentInput from "@/components/shared/PorcentajeCentInput";
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
import {
  clampDescuentoPct,
  FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS,
  FACTURA_BUSQUEDA_PRODUCTOS_TAKE,
  FACTURA_DESCUENTO_MAX_CENTS,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  prepararDescuentoAlAgregarLinea,
  pxConDescuento,
  resumenTotalesFactura,
  totalLineaConDescuento,
  type FacturaDescuentoEstado,
  type FacturaLineaLocal,
} from "@/lib/factura";
import { fmtNumero, fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
  TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS,
  TYPEAHEAD_LISTBOX_HEADER_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_CLASS,
  TYPEAHEAD_LISTBOX_PANEL_FILL_BLOCK_CLASS,
  TYPEAHEAD_LISTBOX_UL_CLASS,
  TYPEAHEAD_STORE_ICON_OUTLINE_CLASS,
  TYPEAHEAD_STORE_ICON_STOCK_OTRA_CLASS,
} from "@/lib/ui-classes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

const DESC_INPUT_CLASS =
  "h-8 w-full min-w-0 tabular-nums border-primary text-sm text-center";

function pctToNorm(pct: number): string {
  if (pct <= 0) return "";
  return (Math.round(pct * 100) / 100).toFixed(2);
}

function parsePctNorm(norm: string): number {
  const t = norm.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function nuevaKeyLinea(): string {
  return `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseCantidadDraft(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

const FILA_BUSQUEDA_GRID =
  "grid w-full grid-cols-[5.5rem_minmax(0,1fr)_6.5rem_6.5rem] items-center justify-items-stretch gap-1.5 px-2";

const FILA_BUSQUEDA_CELDA =
  "min-w-0 w-full overflow-hidden text-center text-ellipsis whitespace-nowrap";

const FILA_BUSQUEDA_STOCK =
  "flex w-full min-w-0 items-center justify-center gap-1";

/** Anchos de columnas del remito (suma 100 %). */
const REMITO_COL_PCT = {
  acciones: 7,
  cod: 7,
  descripcion: 40,
  cant: 8,
  pxLista: 10,
  desc: 8,
  pxConDesc: 10,
  total: 10,
} as const;

function hayStockEnOtraSucursal(
  item: ProductoFacturaBusquedaItem,
  sucursalCodigo: string | null
): boolean {
  return item.stockPorSucursal.some((s) => {
    if (s.stock <= 0) return false;
    if (sucursalCodigo == null) return true;
    return s.codigo !== sucursalCodigo;
  });
}

/**
 * Segundo bloque de Factura · Crear: typeahead de productos + tabla remito local.
 * Dropdown fijo al foco; búsqueda desde 3 letras; click en ítem = agregar.
 */
export type FacturaRemitoSnapshot = {
  lineas: FacturaLineaLocal[];
  descuento: FacturaDescuentoEstado | null;
};

interface FacturaCrearLineasBlockProps {
  onRemitoChange?: (snapshot: FacturaRemitoSnapshot) => void;
  /** Al enfocar el buscador de productos (p. ej. colapsar cabecera). */
  onBusquedaProductoFocus?: () => void;
}

export default function FacturaCrearLineasBlock({
  onRemitoChange,
  onBusquedaProductoFocus,
}: FacturaCrearLineasBlockProps) {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sugerencias, setSugerencias] = useState<ProductoFacturaBusquedaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [lineas, setLineas] = useState<FacturaLineaLocal[]>([]);
  const [descuento, setDescuento] = useState<FacturaDescuentoEstado | null>(null);
  const [descuentoModalOpen, setDescuentoModalOpen] = useState(false);
  const [comentarioLineaKey, setComentarioLineaKey] = useState<string | null>(
    null
  );
  const [stockModalItem, setStockModalItem] =
    useState<ProductoFacturaBusquedaItem | null>(null);
  const cantidadInputRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocusCantidadKeyRef = useRef<string | null>(null);
  /** Si el alta fue al final de la grilla, bajar el scroll tras el paint. */
  const pendingScrollAlFinalRef = useRef(false);
  const tablaScrollRef = useRef<HTMLDivElement>(null);

  const fetchSugerencias = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS) {
      setSugerencias([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sucursalCodigo = leerUsuarioSesion()?.sucursalPorDefecto;
    const res = await buscarProductosFacturaAction({
      q,
      take: FACTURA_BUSQUEDA_PRODUCTOS_TAKE,
      ...(sucursalCodigo ? { sucursalCodigo } : {}),
    });
    setLoading(false);
    if (!res.ok) {
      setSugerencias([]);
      toast.error(res.error);
      return;
    }
    setSugerencias(res.data.items);
    setHighlight(0);
  }, []);

  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      void fetchSugerencias(value);
    },
  });

  const qTrim = q.trim();
  const puedeBuscar = qTrim.length >= FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS;
  const stockModalOpen = stockModalItem != null;
  const comentarioLinea =
    comentarioLineaKey == null
      ? null
      : (lineas.find((l) => l.key === comentarioLineaKey) ?? null);
  const comentarioModalOpen = comentarioLinea != null;
  const sucursalUsuario = leerUsuarioSesion()?.sucursalPorDefecto ?? null;
  const resumen = useMemo(
    () => resumenTotalesFactura(lineas, descuento),
    [lineas, descuento]
  );
  const pctGlobal = useMemo(
    () => porcentajeDescuentoGlobal(lineas, descuento),
    [lineas, descuento]
  );

  useEffect(() => {
    onRemitoChange?.({ lineas, descuento });
  }, [lineas, descuento, onRemitoChange]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (stockModalItem != null || descuentoModalOpen || comentarioModalOpen)
        return;
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [stockModalItem, descuentoModalOpen, comentarioModalOpen]);

  useEffect(() => {
    const key = pendingFocusCantidadKeyRef.current;
    if (!key) return;
    const el = cantidadInputRefs.current.get(key);
    if (!el) return;
    pendingFocusCantidadKeyRef.current = null;

    if (pendingScrollAlFinalRef.current) {
      pendingScrollAlFinalRef.current = false;
      const scrollEl = tablaScrollRef.current;
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    } else {
      el.scrollIntoView({ block: "nearest" });
    }

    el.focus();
    el.select();
  }, [lineas]);

  function agregarItem(item: ProductoFacturaBusquedaItem) {
    const keyFoco = nuevaKeyLinea();
    pendingScrollAlFinalRef.current = true;
    const { descuentoPctEspecial, descuentoSiguiente } =
      prepararDescuentoAlAgregarLinea(lineas, descuento);
    if (descuentoSiguiente !== descuento) {
      setDescuento(descuentoSiguiente);
    }
    setLineas((prev) => [
      ...prev,
      {
        key: keyFoco,
        codTienda: item.codTienda,
        descripcion: item.descripcion,
        cantidad: 1,
        pxLista: item.pxLista,
        descuentoPctEspecial,
        comentario: "",
      },
    ]);
    setQ("");
    setSugerencias([]);
    setHighlight(0);
    setAbierto(false);
    pendingFocusCantidadKeyRef.current = keyFoco;
  }

  function limpiarBusquedaProducto() {
    handleQChange("");
    setAbierto(false);
    setSugerencias([]);
    setLoading(false);
    setHighlight(0);
    ref.current?.focus();
  }

  function actualizarCantidad(key: string, raw: string) {
    const cant = parseCantidadDraft(raw);
    if (cant == null) return;
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, cantidad: cant } : l))
    );
  }

  function eliminarLinea(key: string) {
    setLineas((prev) => {
      const next = prev.filter((l) => l.key !== key);
      if (next.length === 0) {
        setDescuento(null);
      }
      return next;
    });
    cantidadInputRefs.current.delete(key);
  }

  function actualizarDescLinea(key: string, next: string) {
    if (next.trim() === "") {
      setLineas((prev) =>
        prev.map((l) =>
          l.key === key ? { ...l, descuentoPctEspecial: null } : l
        )
      );
      return;
    }
    const pct = parsePctNorm(next);
    if (pct > 100) {
      toast.error("El DESC. % no puede superar 100.");
      return;
    }
    const global = porcentajeDescuentoGlobal(lineas, descuento);
    const especial =
      Math.abs(pct - global) < 0.005 ? null : clampDescuentoPct(pct);
    setLineas((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, descuentoPctEspecial: especial } : l
      )
    );
  }

  function actualizarComentarioLinea(key: string, comentario: string) {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, comentario } : l))
    );
  }

  function aplicarDescuentoDesdeModal(next: FacturaDescuentoEstado | null) {
    if (next?.fuente === "total_fac") {
      setLineas((prev) =>
        prev.map((l) => ({ ...l, descuentoPctEspecial: null }))
      );
    }
    setDescuento(next);
  }

  function confirmarCantidadYVolverABuscar() {
    ref.current?.focus();
  }

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4"
    >
      <div className="relative z-30 shrink-0">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            title="Búsqueda avanzada (próximamente)"
            aria-label="Búsqueda avanzada (próximamente)"
            onClick={() => toast.message("Búsqueda avanzada: próximamente.")}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
          </Button>

          <div className="filtro-individual-container relative min-w-0 flex-1">
            <Input
              ref={ref}
              id="factura-crear-buscar-producto"
              value={q}
              onChange={(e) => {
                const next = e.target.value;
                handleQChange(next);
                if (next.trim().length < FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS) {
                  setAbierto(false);
                  setSugerencias([]);
                  setLoading(false);
                  return;
                }
                setAbierto(true);
              }}
              onFocus={() => {
                onBusquedaProductoFocus?.();
              }}
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
                    (h) => (h - 1 + sugerencias.length) % sugerencias.length
                  );
                  return;
                }
                if (e.key === "Enter" && sugerencias[highlight]) {
                  e.preventDefault();
                  agregarItem(sugerencias[highlight]!);
                  return;
                }
                if (e.key === "Escape") {
                  setAbierto(false);
                }
              }}
              placeholder="Buscar producto por descripción..."
              autoComplete="off"
              role="combobox"
              aria-expanded={abierto}
              aria-controls={listboxId}
              aria-autocomplete="list"
              className={cn(
                "w-full",
                q && (isDebouncing || loading) && "pr-14",
                q && !(isDebouncing || loading) && "pr-10",
                !q && (isDebouncing || loading) && "pr-10"
              )}
            />
            {(isDebouncing || loading) && (
              <Loader2
                className={cn(
                  "pointer-events-none absolute top-1/2 z-[1] h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground",
                  q ? "right-[2.65rem]" : "right-3"
                )}
                aria-hidden
              />
            )}
            {q ? (
              <Button
                type="button"
                variant="primaryIcon"
                size="icon-lg"
                className="filtro-individual-clear-btn"
                onClick={limpiarBusquedaProducto}
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={tablaScrollRef}
        className="contenedor-tabla-gestion relative z-0 min-h-0 flex-1 overflow-y-auto"
      >
        <Table className="w-full table-fixed" scrollX={false}>
          <colgroup>
            <col style={{ width: `${REMITO_COL_PCT.acciones}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.cod}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.descripcion}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.cant}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.pxLista}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.desc}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.pxConDesc}%` }} />
            <col style={{ width: `${REMITO_COL_PCT.total}%` }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-0 text-center" aria-label="Acciones" />
              <TableHead className="min-w-0 text-center">COD.</TableHead>
              <TableHead className="min-w-0 text-center">DESCRIPCIÓN</TableHead>
              <TableHead className="min-w-0 text-center">CANT.</TableHead>
              <TableHead className="min-w-0 text-center">PX. LISTA</TableHead>
              <TableHead className="min-w-0 text-center">DESC.</TableHead>
              <TableHead className="min-w-0 text-center">PX C/ DESC.</TableHead>
              <TableHead className="min-w-0 text-center">TOTAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 ? (
              <EmptyTableRow colSpan={8} message="Sin ítems." />
            ) : (
              lineas.map((linea) => {
                const pctLinea = porcentajeDescuentoLinea(linea, pctGlobal);
                const pxDesc = pxConDescuento(linea.pxLista, pctLinea);
                const totalFila = totalLineaConDescuento(linea, pctLinea);
                const descNorm =
                  linea.descuentoPctEspecial != null
                    ? (Math.round(linea.descuentoPctEspecial * 100) / 100).toFixed(
                        2
                      )
                    : pctGlobal > 0
                      ? pctToNorm(pctGlobal)
                      : "";
                const comentarioVisible = linea.comentario.trim();
                return (
                  <TableRow key={linea.key}>
                    <TableCell className="celda-datos min-w-0 text-center">
                      <div
                        className={cn(
                          TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
                          "flex-nowrap gap-1 p-0.5"
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                            "!h-7 !w-7 min-h-7 min-w-7 shrink-0 !p-0"
                          )}
                          title="Eliminar ítem"
                          aria-label={`Eliminar ${linea.descripcion}`}
                          onClick={() => eliminarLinea(linea.key)}
                        >
                          <Trash2
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                            "!h-7 !w-7 min-h-7 min-w-7 shrink-0 !p-0"
                          )}
                          title="Comentario"
                          aria-label={`Comentario de ${linea.descripcion}`}
                          onClick={() => setComentarioLineaKey(linea.key)}
                        >
                          <MessageSquare
                            className={TABLE_ROW_ACTION_ICON_CLASS}
                            aria-hidden
                          />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 truncate text-center tabular-nums">
                      {linea.codTienda}
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 text-center">
                      <div className="flex min-w-0 flex-col items-center gap-0.5">
                        <span className="w-full min-w-0 break-words">
                          {linea.descripcion}
                        </span>
                        {comentarioVisible ? (
                          <span className="w-full min-w-0 break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {comentarioVisible}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 text-center">
                      <Input
                        ref={(el) => {
                          if (el) cantidadInputRefs.current.set(linea.key, el);
                          else cantidadInputRefs.current.delete(linea.key);
                        }}
                        type="text"
                        inputMode="numeric"
                        className="h-8 w-full min-w-0 text-center tabular-nums"
                        value={String(linea.cantidad)}
                        aria-label={`Cantidad de ${linea.descripcion}`}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const digits = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6);
                          if (digits === "") return;
                          actualizarCantidad(linea.key, digits);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmarCantidadYVolverABuscar();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 truncate text-center tabular-nums">
                      {`$${fmtPrecio(linea.pxLista)}`}
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 text-center">
                      <PorcentajeCentInput
                        valueNormalized={descNorm}
                        onValueNormalizedChange={(next) =>
                          actualizarDescLinea(linea.key, next)
                        }
                        maxCents={FACTURA_DESCUENTO_MAX_CENTS}
                        treatEmptyNormalizedAsBlank
                        pctSuffixAlwaysVisible
                        className={DESC_INPUT_CLASS}
                        aria-label={`Descuento de ${linea.descripcion}`}
                      />
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 truncate text-center tabular-nums">
                      {`$${fmtPrecio(pxDesc)}`}
                    </TableCell>
                    <TableCell className="celda-datos min-w-0 truncate text-center tabular-nums">
                      {`$${fmtPrecio(totalFila)}`}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div
        className={cn(
          "flex min-h-[2.8125rem] shrink-0 items-center overflow-hidden rounded-md border border-border bg-card"
        )}
      >
        <div
          className="flex shrink-0 items-center justify-center px-2 py-1.5"
          aria-label="Zona de descuentos"
        >
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            disabled={lineas.length === 0}
            title="Aplicar descuento"
            aria-label="Aplicar descuento"
            onClick={() => setDescuentoModalOpen(true)}
          >
            <Percent className="h-3 w-3 shrink-0" aria-hidden />
            Desc.
          </Button>
        </div>

        <div
          className={cn(
            "grid min-w-0 flex-1 grid-cols-5 items-center gap-2 px-2 py-1.5 text-center",
            "bg-muted/40"
          )}
          aria-label="Resumen de totales"
        >
          <div className="flex min-w-0 flex-col gap-0 leading-none">
            <span className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
              TOTAL ITEM
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {fmtNumero(resumen.totalItem)}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0 leading-none">
            <span className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
              TOTAL $
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {`$${fmtPrecio(resumen.totalLista)}`}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0 leading-none">
            <span className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
              DESC. % PROMEDIO
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {fmtPorcentajeTabla(resumen.descPctPromedio)}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0 leading-none">
            <span className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
              DESC. $
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {`$${fmtPrecio(resumen.descPesos)}`}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0 leading-none">
            <span className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
              TOTAL C/ DESC.
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {`$${fmtPrecio(resumen.totalConDesc)}`}
            </span>
          </div>
        </div>
      </div>

      {abierto && puedeBuscar ? (
        <div className="pointer-events-none absolute inset-4 z-[70]">
          <div
            id={listboxId}
            role="listbox"
            className={cn(
              TYPEAHEAD_LISTBOX_PANEL_CLASS,
              TYPEAHEAD_LISTBOX_PANEL_FILL_BLOCK_CLASS,
              "pointer-events-auto"
            )}
          >
            {loading || isDebouncing ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Buscando…</p>
            ) : sugerencias.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Sin resultados.
              </p>
            ) : (
              <>
                <div className={TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS}>
                  <div
                    className={cn(FILA_BUSQUEDA_GRID, TYPEAHEAD_LISTBOX_HEADER_CLASS)}
                    aria-hidden
                  >
                    <span className={FILA_BUSQUEDA_CELDA}>COD.</span>
                    <span className={FILA_BUSQUEDA_CELDA}>DESCRIPCIÓN</span>
                    <span className={FILA_BUSQUEDA_CELDA}>PRECIOS</span>
                    <span className={FILA_BUSQUEDA_CELDA}>STOCK</span>
                  </div>
                  <ul
                    className={cn(
                      TYPEAHEAD_LISTBOX_UL_CLASS,
                      "flex-none overflow-visible"
                    )}
                  >
                    {sugerencias.map((item, idx) => {
                    const activo = idx === highlight;
                    const sinStockLocal = item.stock <= 0;
                    const stockEnOtra = hayStockEnOtraSucursal(
                      item,
                      sucursalUsuario
                    );
                    const resaltarSucursal = sinStockLocal && stockEnOtra;
                    return (
                      <li
                        key={item.codTienda}
                        role="option"
                        aria-selected={activo}
                      >
                        <div
                          role="button"
                          tabIndex={-1}
                          className={cn(
                            FILA_BUSQUEDA_GRID,
                            "min-h-5 cursor-pointer py-0 text-sm leading-tight text-foreground transition-colors",
                            "hover:bg-accent/60",
                            activo && "bg-accent/60"
                          )}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => agregarItem(item)}
                        >
                          <span className={cn(FILA_BUSQUEDA_CELDA, "tabular-nums text-foreground")}>
                            {item.codTienda}
                          </span>
                          <span className={cn(FILA_BUSQUEDA_CELDA, "text-foreground")}>
                            {item.descripcion}
                          </span>
                          <span className={cn(FILA_BUSQUEDA_CELDA, "tabular-nums text-foreground")}>
                            {`$${fmtPrecio(item.pxLista)}`}
                          </span>
                          <div className={FILA_BUSQUEDA_STOCK}>
                            <span className="min-w-0 tabular-nums text-foreground">
                              {sinStockLocal ? (
                                <span
                                  className="inline-flex"
                                  title="Sin stock en la sucursal"
                                >
                                  <AlertTriangle
                                    className={cn(
                                      TABLE_ROW_ACTION_ICON_CLASS,
                                      "text-destructive"
                                    )}
                                    aria-label="Sin stock en la sucursal"
                                  />
                                </span>
                              ) : (
                                fmtNumero(item.stock)
                              )}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 shrink-0 bg-transparent p-0 shadow-none hover:bg-transparent"
                              title={
                                resaltarSucursal
                                  ? "Hay stock en otra sucursal"
                                  : "Ver stock por sucursal"
                              }
                              aria-label={
                                resaltarSucursal
                                  ? `Hay stock en otra sucursal — ver detalle de ${item.descripcion}`
                                  : `Stock por sucursal de ${item.descripcion}`
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAbierto(false);
                                setStockModalItem(item);
                              }}
                            >
                              <Store
                                className={cn(
                                  TABLE_ROW_ACTION_ICON_CLASS,
                                  resaltarSucursal
                                    ? TYPEAHEAD_STORE_ICON_STOCK_OTRA_CLASS
                                    : TYPEAHEAD_STORE_ICON_OUTLINE_CLASS
                                )}
                                aria-hidden
                              />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <FacturaProductoStockModal
        open={stockModalOpen}
        onOpenChange={(open) => {
          if (!open) setStockModalItem(null);
        }}
        producto={stockModalItem}
      />

      <FacturaDescuentoModal
        key={descuentoModalOpen ? "factura-desc-open" : "factura-desc-closed"}
        open={descuentoModalOpen}
        onOpenChange={setDescuentoModalOpen}
        totalLista={resumen.totalLista}
        descuentoActual={descuento}
        onAplicar={aplicarDescuentoDesdeModal}
      />

      {comentarioLinea ? (
        <FacturaLineaComentarioModal
          key={`comentario-${comentarioLinea.key}`}
          open={comentarioModalOpen}
          onOpenChange={(open) => {
            if (!open) setComentarioLineaKey(null);
          }}
          descripcionItem={comentarioLinea.descripcion}
          comentarioInicial={comentarioLinea.comentario}
          onGuardar={(comentario) =>
            actualizarComentarioLinea(comentarioLinea.key, comentario)
          }
        />
      ) : null}
    </div>
  );
}
