"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 140;

export type SidebarModuloOpcion = {
  id: string;
  label: string;
  icon: ReactNode;
};

type Pos = { top: number; left: number; maxHeight: number };

type Props = {
  modulos: SidebarModuloOpcion[];
  seleccionado: SidebarModuloOpcion | null;
  placeholder?: string;
  menuLabel?: string;
  onSelect: (id: string) => void;
};

/**
 * Recuadro del slidenav. El hover abre la lista a la derecha; el click elige.
 */
export default function SidebarModulosRecuadro({
  modulos,
  seleccionado,
  placeholder = "MÓDULO",
  menuLabel = "Módulos",
  onSelect,
}: Props) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  function cancelClose() {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function measure() {
    const row = rootRef.current;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const aside = row.closest(".sidebar-container");
    const left = aside ? aside.getBoundingClientRect().right : rect.right;
    const top = Math.max(8, rect.top);
    setPos({
      top,
      left,
      maxHeight: Math.max(120, window.innerHeight - top - 8),
    });
  }

  function openMenu() {
    cancelClose();
    measure();
    setOpen(true);
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }

  useEffect(() => {
    return () => cancelClose();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      measure();
    }
    const scroller = rootRef.current?.closest(".sidebar-nav-scroll");
    scroller?.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      scroller?.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function focusStaysInside(next: EventTarget | null): boolean {
    if (!(next instanceof Node)) return false;
    if (rootRef.current?.contains(next)) return true;
    if (panelRef.current?.contains(next)) return true;
    return false;
  }

  if (modulos.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={cn("sidebar-modulos-recuadro", open && "sidebar-modulos-recuadro--abierto")}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onFocusCapture={openMenu}
      onBlurCapture={(event) => {
        if (focusStaysInside(event.relatedTarget)) return;
        scheduleClose();
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
        <ChevronRight className="sidebar-nav-chevron h-4 w-4 shrink-0" aria-hidden />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              aria-label={menuLabel}
              className="sidebar-funciones-ancla"
              style={{ top: pos.top, left: pos.left }}
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
            >
              <ul
                className="sidebar-modulos-lista"
                style={{ maxHeight: pos.maxHeight }}
              >
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
