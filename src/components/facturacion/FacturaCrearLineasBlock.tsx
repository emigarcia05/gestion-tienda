"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Loader2, Search, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buscarProductosFacturaAction } from "@/actions/factura";
import FacturaProductoStockModal from "@/components/facturacion/FacturaProductoStockModal";
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
  FACTURA_BUSQUEDA_PRODUCTOS_MIN_CHARS,
  FACTURA_BUSQUEDA_PRODUCTOS_TAKE,
  totalLineaFactura,
  type FacturaLineaLocal,
} from "@/lib/factura";
import { fmtNumero, fmtPrecio } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { leerUsuarioSesion } from "@/lib/usuarioSesion";
import { cn } from "@/lib/utils";
import type { ProductoFacturaBusquedaItem } from "@/services/facturaProductos.service";

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
  "grid w-full grid-cols-[5.5rem_minmax(0,1fr)_5.5rem_4.5rem_2rem] items-center gap-2 px-3";

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
export default function FacturaCrearLineasBlock() {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sugerencias, setSugerencias] = useState<ProductoFacturaBusquedaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [lineas, setLineas] = useState<FacturaLineaLocal[]>([]);
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
  const sucursalUsuario = leerUsuarioSesion()?.sucursalPorDefecto ?? null;

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (stockModalItem != null) return;
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [stockModalItem]);

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
    const existente = lineas.find((l) => l.codTienda === item.codTienda);
    const keyFoco = existente?.key ?? nuevaKeyLinea();
    pendingScrollAlFinalRef.current = existente == null;
    setLineas((prev) => {
      const ya = prev.find((l) => l.codTienda === item.codTienda);
      if (ya) {
        return prev.map((l) =>
          l.codTienda === item.codTienda
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          key: keyFoco,
          codTienda: item.codTienda,
          descripcion: item.descripcion,
          cantidad: 1,
          pxLista: item.pxLista,
        },
      ];
    });
    setQ("");
    setSugerencias([]);
    setHighlight(0);
    setAbierto(false);
    pendingFocusCantidadKeyRef.current = keyFoco;
  }

  function actualizarCantidad(key: string, raw: string) {
    const cant = parseCantidadDraft(raw);
    if (cant == null) return;
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, cantidad: cant } : l))
    );
  }

  function eliminarLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key));
    cantidadInputRefs.current.delete(key);
  }

  function confirmarCantidadYVolverABuscar() {
    ref.current?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <div ref={wrapRef} className="relative z-30 shrink-0">
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

          <div className="relative min-w-0 flex-1">
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
              className={cn("w-full", (isDebouncing || loading) && "pr-10")}
            />
            {(isDebouncing || loading) && (
              <Loader2
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden
              />
            )}

            {abierto && puedeBuscar ? (
              <div
                id={listboxId}
                role="listbox"
                className={cn(
                  "absolute left-0 right-0 top-full z-50 mt-1 flex flex-col",
                  "h-72 overflow-hidden rounded-md border border-border bg-popover",
                  "text-popover-foreground shadow-md"
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
                    <div
                      className={cn(
                        FILA_BUSQUEDA_GRID,
                        "shrink-0 border-b border-border bg-muted/40 py-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground"
                      )}
                      aria-hidden
                    >
                      <span>COD.</span>
                      <span>DESCRIPCIÓN</span>
                      <span className="text-right">PRECIOS</span>
                      <span className="text-right">STOCK</span>
                      <span />
                    </div>
                    <ul className="min-h-0 flex-1 overflow-y-auto py-0.5">
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
                                "cursor-pointer py-1 text-left text-sm leading-snug text-foreground transition-colors",
                                "hover:bg-accent/60",
                                activo && "bg-accent/60"
                              )}
                              onMouseEnter={() => setHighlight(idx)}
                              onClick={() => agregarItem(item)}
                            >
                              <span className="truncate tabular-nums text-muted-foreground">
                                {item.codTienda}
                              </span>
                              <span className="min-w-0 truncate">
                                {item.descripcion}
                              </span>
                              <span className="text-right tabular-nums text-muted-foreground">
                                {fmtPrecio(item.pxLista)}
                              </span>
                              <span className="flex items-center justify-end tabular-nums text-muted-foreground">
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
                                size="icon"
                                className={cn(
                                  "size-6 shrink-0",
                                  resaltarSucursal
                                    ? "text-primary hover:bg-primary/10"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
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
                                  setStockModalItem(item);
                                }}
                              >
                                <Store
                                  className={TABLE_ROW_ACTION_ICON_CLASS}
                                  aria-hidden
                                />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={tablaScrollRef}
        className="contenedor-tabla-gestion relative z-0 min-h-0 flex-1 overflow-y-auto"
      >
        <Table className="w-full table-fixed" scrollX={false}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" aria-label="Eliminar" />
              <TableHead className="w-[7rem]">COD.</TableHead>
              <TableHead>DESCRIPCIÓN</TableHead>
              <TableHead className="w-[7rem] text-center">CANTIDAD</TableHead>
              <TableHead className="w-[8rem] text-right">PX. LISTA</TableHead>
              <TableHead className="w-[8rem] text-right">TOTAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 ? (
              <EmptyTableRow colSpan={6} message="Sin ítems." />
            ) : (
              lineas.map((linea) => (
                <TableRow key={linea.key}>
                  <TableCell className="celda-datos">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                      title="Eliminar ítem"
                      aria-label={`Eliminar ${linea.descripcion}`}
                      onClick={() => eliminarLinea(linea.key)}
                    >
                      <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                  </TableCell>
                  <TableCell className="celda-datos tabular-nums">
                    {linea.codTienda}
                  </TableCell>
                  <TableCell className="celda-datos text-left">
                    {linea.descripcion}
                  </TableCell>
                  <TableCell className="celda-datos text-center">
                    <Input
                      ref={(el) => {
                        if (el) cantidadInputRefs.current.set(linea.key, el);
                        else cantidadInputRefs.current.delete(linea.key);
                      }}
                      type="text"
                      inputMode="numeric"
                      className="mx-auto h-8 w-20 text-center tabular-nums"
                      value={String(linea.cantidad)}
                      aria-label={`Cantidad de ${linea.descripcion}`}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
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
                  <TableCell className="celda-datos text-right tabular-nums">
                    {fmtPrecio(linea.pxLista)}
                  </TableCell>
                  <TableCell className="celda-datos text-right tabular-nums">
                    {fmtPrecio(totalLineaFactura(linea))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <FacturaProductoStockModal
        open={stockModalOpen}
        onOpenChange={(open) => {
          if (!open) setStockModalItem(null);
        }}
        producto={stockModalItem}
      />
    </div>
  );
}
