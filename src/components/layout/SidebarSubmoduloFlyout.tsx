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

const CLOSE_DELAY_MS = 140;

type Pos = { top: number; left: number; maxHeight: number };

/**
 * Submódulo fijo del slidenav. El hover (o el foco) abre a la derecha
 * el panel con las funciones. El click de cada función vive en los enlaces hijos.
 */
export default function SidebarSubmoduloFlyout({
  label,
  icon,
  activo,
  children,
}: {
  label: string;
  icon: ReactNode;
  activo: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
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
    const row = rowRef.current;
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

  function openPanel() {
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
    const scroller = rowRef.current?.closest(".sidebar-nav-scroll");
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
    if (rowRef.current?.contains(next)) return true;
    if (panelRef.current?.contains(next)) return true;
    return false;
  }

  return (
    <div
      ref={rowRef}
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
      onFocusCapture={openPanel}
      onBlurCapture={(event) => {
        if (focusStaysInside(event.relatedTarget)) return;
        scheduleClose();
      }}
    >
      <div
        className="sidebar-nav-item"
        data-ancestor={activo ? "true" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        tabIndex={0}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronRight className="sidebar-nav-chevron h-4 w-4 shrink-0" aria-hidden />
      </div>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="menu"
              aria-label={label}
              className="sidebar-funciones-ancla"
              style={{ top: pos.top, left: pos.left }}
              onMouseEnter={openPanel}
              onMouseLeave={scheduleClose}
              onClick={(event) => {
                const target = event.target;
                if (target instanceof Element && target.closest("a")) {
                  setOpen(false);
                }
              }}
            >
              <div
                className="sidebar-funciones-panel"
                style={{ maxHeight: pos.maxHeight }}
              >
                {children}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
