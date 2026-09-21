"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import SelectSearchInput from "@/components/shared/SelectSearchInput";
import { filterItemsBySelectSearch } from "@/lib/selectSearch";
import { cn } from "@/lib/utils";

export type FiltroMultiSelectOpcion = { value: string; label: string };

function normalizarOpciones(
  opciones: readonly string[] | readonly FiltroMultiSelectOpcion[]
): FiltroMultiSelectOpcion[] {
  if (opciones.length === 0) return [];
  const first = opciones[0];
  if (typeof first === "string") {
    return (opciones as readonly string[]).map((value) => ({
      value,
      label: value,
    }));
  }
  return [...(opciones as readonly FiltroMultiSelectOpcion[])];
}

function measureTriggerPos(el: HTMLElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.bottom + 4, left: r.left, width: r.width };
}

/**
 * Lista desplegable de selección múltiple (una o más).
 * Trigger `input-filtro-unificado` + panel `role="listbox"` + `SelectSearchInput`.
 * Vacío = placeholder. El panel va en portal (`z-[90]`) para usarse también en `AppModal`.
 */
export default function FiltroMultiSelect({
  opciones,
  extras,
  selected,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
}: {
  opciones: readonly string[] | readonly FiltroMultiSelectOpcion[];
  extras?: readonly FiltroMultiSelectOpcion[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const panelOpen = open && !disabled && panelPos !== null;

  const todas = useMemo(() => {
    const base = normalizarOpciones(opciones);
    return extras && extras.length > 0 ? [...base, ...extras] : base;
  }, [opciones, extras]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const labelPorValor = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of todas) map.set(o.value, o.label);
    return map;
  }, [todas]);

  const filtradas = useMemo(
    () => filterItemsBySelectSearch(todas, query, (o) => o.label),
    [todas, query]
  );

  useLayoutEffect(() => {
    if (!open || disabled) return;
    function onWin() {
      const pos = measureTriggerPos(rootRef.current);
      if (pos) setPanelPos(pos);
    }
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, disabled]);

  useEffect(() => {
    if (!open || disabled) return;
    function onPointerDown(event: MouseEvent) {
      const t = event.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
      setPanelPos(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, disabled]);

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((x) => x !== value));
      return;
    }
    onChange([...selected, value]);
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (labelPorValor.get(selected[0]!) ?? selected[0]!)
        : selected
            .map((v) => labelPorValor.get(v) ?? v)
            .join(" · ");

  const panel =
    panelOpen && panelPos ? (
      <div
        ref={panelRef}
        className="fixed z-[90] flex max-h-72 min-w-[8rem] flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
        style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
      role="listbox"
      aria-multiselectable="true"
    >
      <div className="shrink-0 border-b border-border p-1">
        <SelectSearchInput value={query} onValueChange={setQuery} autoFocus />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filtradas.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground" role="status">
            SIN RESULTADOS
          </p>
        ) : (
          filtradas.map((item) => {
            const checked = selectedSet.has(item.value);
            return (
              <label
                key={item.value}
                role="option"
                aria-selected={checked}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted",
                  checked && "bg-muted"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.value)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  aria-label={item.label}
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            setQuery("");
            setPanelPos(null);
            return;
          }
          const pos = measureTriggerPos(rootRef.current);
          if (!pos) return;
          setPanelPos(pos);
          setOpen(true);
        }}
        className={cn(
          SELECT_TRIGGER_FILTER_CLASS,
          "flex w-full items-center justify-between gap-2 text-left font-semibold",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-expanded={panelOpen}
        aria-haspopup="listbox"
        aria-label={`${ariaLabel} (selección múltiple)`}
        disabled={disabled}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
