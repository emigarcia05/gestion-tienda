"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { buscarClientesFacturaAction } from "@/actions/factura";
import { INPUT_FILTER_CLASS } from "@/components/FilterBar";
import { Input } from "@/components/ui/input";
import {
  etiquetaClienteListado,
  nombrePintorAsociadoCliente,
  type ClienteListaItem,
} from "@/lib/envios";
import {
  FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS,
  FACTURA_BUSQUEDA_CLIENTES_TAKE,
} from "@/lib/factura";
import { fmtCelda, fmtPrecio } from "@/lib/format";
import { useFiltrosConBusqueda } from "@/lib/hooks/useFiltrosConBusqueda";
import {
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

const FILA_GRID_CLASS =
  "grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem] items-center justify-items-stretch gap-1.5 px-2";

interface Props {
  id: string;
  /** Cliente elegido; `null` = input libre para buscar. */
  seleccionado: ClienteListaItem | null;
  /** Elegir de la lista o `null` cuando el usuario vuelve a escribir. */
  onSeleccionar: (item: ClienteListaItem | null) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Buscador de clientes (≥ 3 caracteres, `buscarClientesFacturaAction`) con lista
 * CLIENTE | PINTOR | SALDO. Solo elige: sin alta ni edición de cliente.
 */
export default function FacturaClienteTypeahead({
  id,
  seleccionado,
  onSeleccionar,
  placeholder = "BUSCAR CLIENTE...",
  className,
}: Props) {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const seleccionadoIdRef = useRef<string | null>(seleccionado?.id ?? null);
  const [sugerencias, setSugerencias] = useState<ClienteListaItem[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    seleccionadoIdRef.current = seleccionado?.id ?? null;
  }, [seleccionado?.id]);

  const fetchSugerencias = useCallback(async (value: string) => {
    if (seleccionadoIdRef.current != null) return;
    const qTrim = value.trim();
    if (qTrim.length < FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS) {
      setSugerencias([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await buscarClientesFacturaAction({
      q: qTrim,
      take: FACTURA_BUSQUEDA_CLIENTES_TAKE,
    });
    setLoading(false);
    if (seleccionadoIdRef.current != null) return;
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron buscar clientes.");
      setSugerencias([]);
      return;
    }
    setSugerencias(res.data.items);
    setHighlight(0);
  }, []);

  const { q, handleQChange, isDebouncing, ref: inputRef } = useFiltrosConBusqueda({
    qActual: seleccionado ? etiquetaClienteListado(seleccionado) : "",
    debounceMs: 300,
    onDebouncedSearch: (value) => {
      void fetchSugerencias(value);
    },
  });

  const puedeBuscar = q.trim().length >= FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS;
  const listaVisible = abierto && puedeBuscar && seleccionado == null;

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const wrap = wrapRef.current;
      if (!wrap || !(e.target instanceof Node) || wrap.contains(e.target)) return;
      setAbierto(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  function elegir(item: ClienteListaItem) {
    seleccionadoIdRef.current = item.id;
    setAbierto(false);
    setSugerencias([]);
    onSeleccionar(item);
  }

  function onQChange(next: string) {
    const value = next.toLocaleUpperCase("es-AR");
    if (seleccionado != null) {
      seleccionadoIdRef.current = null;
      onSeleccionar(null);
    }
    handleQChange(value);
    if (value.trim().length < FACTURA_BUSQUEDA_CLIENTES_MIN_CHARS) {
      setAbierto(false);
      setSugerencias([]);
      setLoading(false);
      return;
    }
    setAbierto(true);
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        TYPEAHEAD_LISTBOX_ANCHOR_CLASS,
        listaVisible && TYPEAHEAD_LISTBOX_ANCHOR_OPEN_CLASS,
        className
      )}
    >
      <Input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={listaVisible}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label="Cliente"
        placeholder={placeholder}
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
            setHighlight((h) => (h - 1 + sugerencias.length) % sugerencias.length);
            return;
          }
          if (e.key === "Enter" && listaVisible && sugerencias[highlight]) {
            e.preventDefault();
            elegir(sugerencias[highlight]!);
            return;
          }
          if (e.key === "Escape") setAbierto(false);
        }}
        onFocus={() => {
          if (puedeBuscar) setAbierto(true);
        }}
        className={cn("w-full", INPUT_FILTER_CLASS)}
      />
      {listaVisible ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            TYPEAHEAD_LISTBOX_PANEL_CLASS,
            TYPEAHEAD_LISTBOX_PANEL_HEIGHT_CLASS,
            TYPEAHEAD_LISTBOX_PANEL_WIDER_THAN_INPUT_CLASS
          )}
        >
          {loading || isDebouncing ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Buscando…</p>
          ) : sugerencias.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <div className={TYPEAHEAD_LISTBOX_BODY_SCROLL_CLASS}>
              <div className={cn(FILA_GRID_CLASS, TYPEAHEAD_LISTBOX_HEADER_CLASS)} aria-hidden>
                <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>CLIENTE</span>
                <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>PINTOR</span>
                <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>SALDO</span>
              </div>
              <ul className={cn(TYPEAHEAD_LISTBOX_UL_CLASS, "flex-none overflow-visible")}>
                {sugerencias.map((item, idx) => {
                  const activo = idx === highlight;
                  return (
                    <li key={item.id} role="option" aria-selected={activo}>
                      <div
                        role="button"
                        tabIndex={-1}
                        className={cn(
                          FILA_GRID_CLASS,
                          TYPEAHEAD_LISTBOX_OPTION_ROW_CLASS,
                          TYPEAHEAD_LISTBOX_OPTION_ROW_CLIENTES_CLASS,
                          activo && TYPEAHEAD_LISTBOX_OPTION_ACTIVE_CLASS
                        )}
                        onMouseEnter={() => setHighlight(idx)}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => elegir(item)}
                      >
                        <span className={cn(TYPEAHEAD_LISTBOX_CELL_CLASS, "text-foreground")}>
                          {etiquetaClienteListado(item)}
                        </span>
                        <span className={TYPEAHEAD_LISTBOX_CELL_CLASS}>
                          {fmtCelda(nombrePintorAsociadoCliente(item) ?? "")}
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
  );
}
