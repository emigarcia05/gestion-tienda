"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { buscarProductosFacturaAction } from "@/actions/factura";
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
  FACTURA_BUSQUEDA_PRODUCTOS_TAKE,
  totalLineaFactura,
  type FacturaLineaLocal,
} from "@/lib/factura";
import { fmtPrecio } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
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

/**
 * Segundo bloque de Factura · Crear: typeahead de productos + tabla remito local.
 */
export default function FacturaCrearLineasBlock() {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sugerencias, setSugerencias] = useState<ProductoFacturaBusquedaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ProductoFacturaBusquedaItem | null>(
    null
  );
  const [highlight, setHighlight] = useState(0);
  const [lineas, setLineas] = useState<FacturaLineaLocal[]>([]);

  const fetchSugerencias = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length === 0) {
      setSugerencias([]);
      setSeleccionado(null);
      setAbierto(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await buscarProductosFacturaAction({
      q,
      take: FACTURA_BUSQUEDA_PRODUCTOS_TAKE,
    });
    setLoading(false);
    if (!res.ok) {
      setSugerencias([]);
      setAbierto(false);
      toast.error(res.error);
      return;
    }
    setSugerencias(res.data.items);
    setHighlight(0);
    setAbierto(res.data.items.length > 0);
    setSeleccionado((prev) => {
      if (!prev) return null;
      return res.data.items.find((i) => i.codTienda === prev.codTienda) ?? null;
    });
  }, []);

  const { q, setQ, ref, handleQChange, isDebouncing } = useFiltrosConBusqueda({
    qActual: "",
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      void fetchSugerencias(value);
    },
  });

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  function elegirSugerencia(item: ProductoFacturaBusquedaItem) {
    setSeleccionado(item);
    setQ(item.descripcion);
    setAbierto(false);
  }

  function agregarSeleccionado() {
    const item =
      seleccionado ??
      (sugerencias.length === 1 ? sugerencias[0] : null) ??
      (sugerencias[highlight] ?? null);
    if (!item) {
      toast.message("Elegí un producto de la lista.");
      return;
    }
    setLineas((prev) => {
      const existente = prev.find((l) => l.codTienda === item.codTienda);
      if (existente) {
        return prev.map((l) =>
          l.codTienda === item.codTienda
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          key: nuevaKeyLinea(),
          codTienda: item.codTienda,
          descripcion: item.descripcion,
          cantidad: 1,
          pxLista: item.pxLista,
        },
      ];
    });
    setQ("");
    setSugerencias([]);
    setSeleccionado(null);
    setAbierto(false);
    ref.current?.focus();
  }

  function actualizarCantidad(key: string, raw: string) {
    const cant = parseCantidadDraft(raw);
    if (cant == null) return;
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, cantidad: cant } : l))
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <div ref={wrapRef} className="relative shrink-0">
        <div className="flex items-center gap-2">
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
                setSeleccionado(null);
                handleQChange(e.target.value);
                if (e.target.value.trim() === "") {
                  setSugerencias([]);
                  setAbierto(false);
                }
              }}
              onFocus={() => {
                if (sugerencias.length > 0) setAbierto(true);
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
                  setHighlight((h) => (h - 1 + sugerencias.length) % sugerencias.length);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (abierto && sugerencias[highlight]) {
                    elegirSugerencia(sugerencias[highlight]!);
                    return;
                  }
                  agregarSeleccionado();
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

            {abierto && sugerencias.length > 0 ? (
              <ul
                id={listboxId}
                role="listbox"
                className={cn(
                  "absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto",
                  "rounded-md border border-border bg-popover text-popover-foreground shadow-md"
                )}
              >
                {sugerencias.map((item, idx) => {
                  const activo = idx === highlight;
                  const sel = seleccionado?.codTienda === item.codTienda;
                  return (
                    <li key={item.codTienda} role="option" aria-selected={sel || activo}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2 text-left text-sm",
                          (activo || sel) && "bg-accent text-accent-foreground"
                        )}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => elegirSugerencia(item)}
                      >
                        <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                          {item.codTienda}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.descripcion}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {fmtPrecio(item.pxLista)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0"
            title="Agregar ítem"
            aria-label="Agregar ítem a la factura"
            onClick={agregarSeleccionado}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="contenedor-tabla-gestion min-h-0 flex-1 overflow-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[7rem]">COD.</TableHead>
              <TableHead>DESCRIPCIÓN</TableHead>
              <TableHead className="w-[7rem] text-right">CANTIDAD</TableHead>
              <TableHead className="w-[8rem] text-right">PX. LISTA</TableHead>
              <TableHead className="w-[8rem] text-right">TOTAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 ? (
              <EmptyTableRow colSpan={5} message="Sin ítems." />
            ) : (
              lineas.map((linea) => (
                <TableRow key={linea.key}>
                  <TableCell className="celda-datos tabular-nums">{linea.codTienda}</TableCell>
                  <TableCell className="celda-datos text-left">{linea.descripcion}</TableCell>
                  <TableCell className="celda-datos text-right">
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="ml-auto h-8 w-20 text-right tabular-nums"
                      value={String(linea.cantidad)}
                      aria-label={`Cantidad de ${linea.descripcion}`}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                        if (digits === "") return;
                        actualizarCantidad(linea.key, digits);
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
    </div>
  );
}
