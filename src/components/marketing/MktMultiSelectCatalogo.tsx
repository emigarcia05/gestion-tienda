"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MktCatalogoNombreItem } from "@/lib/mktPublicacionesCatalogo";
import { filterItemsBySelectSearch } from "@/lib/selectSearch";
import SelectSearchInput from "@/components/shared/SelectSearchInput";
import { cn } from "@/lib/utils";

/** Multi-select de catálogo Marketing (redes, etc.). */
export default function MktMultiSelectCatalogo({
  opciones,
  selectedIds,
  onChange,
  placeholder,
  emptyPlaceholder,
  ariaLabel,
  disabled,
}: {
  opciones: MktCatalogoNombreItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  emptyPlaceholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => opciones.filter((o) => selectedSet.has(o.id)),
    [opciones, selectedSet]
  );
  const opcionesFiltradas = useMemo(
    () => filterItemsBySelectSearch(opciones, query, (o) => o.nombre),
    [opciones, query]
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  const label =
    opciones.length === 0
      ? emptyPlaceholder
      : selectedItems.length === 0
        ? placeholder
        : selectedItems.length === 1
          ? selectedItems[0]!.nombre
          : `${selectedItems.length} seleccionadas`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled || opciones.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-placeholder={selectedItems.length === 0 ? "" : undefined}
        aria-label={ariaLabel}
        className={cn(
          "border-input flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1 text-left text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          selectedItems.length === 0 && "text-muted-foreground"
        )}
        onClick={() => setOpen((o) => {
          const next = !o;
          if (!next) setQuery("");
          return next;
        })}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && opciones.length > 0 ? (
        <div
          className="absolute top-full left-0 z-50 mt-1 flex max-h-56 min-w-full flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
          role="listbox"
          aria-multiselectable="true"
        >
          <div className="shrink-0 border-b border-border p-1">
            <SelectSearchInput
              value={query}
              onValueChange={setQuery}
              autoFocus
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {opcionesFiltradas.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground" role="status">
                SIN RESULTADOS
              </p>
            ) : (
              opcionesFiltradas.map((item) => {
                const checked = selectedSet.has(item.id);
                return (
                  <label
                    key={item.id}
                    role="option"
                    aria-selected={checked}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted",
                      checked && "bg-muted"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={checked}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.nombre}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
