"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 120;

export type SidebarModuloOpcion = {
  id: string;
  label: string;
  icon: ReactNode;
};

type Props = {
  modulos: SidebarModuloOpcion[];
  seleccionado: SidebarModuloOpcion | null;
  placeholder?: string;
  onSelect: (id: string) => void;
};

/**
 * Recuadro de módulos del slidenav: hover abre la lista; el click elige el módulo.
 */
export default function SidebarModulosRecuadro({
  modulos,
  seleccionado,
  placeholder = "MÓDULOS",
  onSelect,
}: Props) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  function cancelClose() {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }

  function openMenu() {
    cancelClose();
    setOpen(true);
  }

  useEffect(() => {
    return () => cancelClose();
  }, []);

  if (modulos.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={cn("sidebar-modulos-recuadro", open && "sidebar-modulos-recuadro--abierto")}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onFocusCapture={openMenu}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        if (next instanceof Node) {
          cancelClose();
          setOpen(false);
          return;
        }
        scheduleClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          const trigger = rootRef.current?.querySelector<HTMLButtonElement>(
            "[data-sidebar-modulos-trigger]"
          );
          trigger?.focus();
        }
      }}
    >
      <button
        type="button"
        className="sidebar-modulos-trigger"
        data-sidebar-modulos-trigger=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {seleccionado?.icon ?? null}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">
          {seleccionado?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "sidebar-nav-chevron h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      <div
        id={menuId}
        role="menu"
        aria-label="Módulos"
        className={cn(
          "sidebar-modulos-panel",
          open && "sidebar-modulos-panel--abierto"
        )}
      >
        <ul className="sidebar-modulos-lista">
          {modulos.map((modulo) => {
            const activo = seleccionado?.id === modulo.id;
            return (
              <li key={modulo.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="sidebar-nav-module"
                  data-active={activo ? "true" : undefined}
                  onClick={() => {
                    cancelClose();
                    setOpen(false);
                    onSelect(modulo.id);
                  }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {modulo.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-left">{modulo.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
