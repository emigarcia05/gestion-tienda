"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HEADER_ACCIONES_ITEM_CLASS,
  HEADER_ACCIONES_LIST_CLASS,
  HEADER_ACCIONES_MENU_CLASS,
  HEADER_ACCIONES_PANEL_CLASS,
  HEADER_ACCIONES_PANEL_OPEN_CLASS,
  HEADER_ACCIONES_TRIGGER_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 120;

function elementChildren(el: ReactElement): ReactNode {
  return (el.props as { children?: ReactNode }).children;
}

/** Aplana fragments y un wrapper `div`/`span` de layout (fila de botones del header). */
export function unwrapHeaderActionNodes(node: ReactNode): ReactNode[] {
  // `Children.toArray` ya excluye `null` / `undefined` / booleanos.
  const parts = Children.toArray(node).filter((item) => item !== "");
  if (parts.length === 1 && isValidElement(parts[0])) {
    const el = parts[0];
    if (el.type === Fragment) {
      return unwrapHeaderActionNodes(elementChildren(el));
    }
    if (el.type === "div" || el.type === "span") {
      const nested = unwrapHeaderActionNodes(elementChildren(el));
      if (nested.length > 0) return nested;
    }
  }
  return parts;
}

export interface HeaderAccionesMenuProps {
  children: ReactNode;
  className?: string;
}

/**
 * Único botón **ACCIONES** del header de página.
 * Hover / foco abre la lista de acciones de la ventana; al crear/editar (modal) el ítem sigue vivo en el árbol.
 */
export default function HeaderAccionesMenu({ children, className }: HeaderAccionesMenuProps) {
  const items = unwrapHeaderActionNodes(children);
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

  if (items.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={cn(HEADER_ACCIONES_MENU_CLASS, className)}
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
            "[data-header-acciones-trigger]"
          );
          trigger?.focus();
        }
      }}
    >
      <Button
        type="button"
        variant="default"
        className={HEADER_ACCIONES_TRIGGER_CLASS}
        data-header-acciones-trigger=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        ACCIONES
        <ChevronDown className="size-4" aria-hidden />
      </Button>
      <div
        id={menuId}
        role="menu"
        aria-label="Acciones de la ventana"
        className={cn(HEADER_ACCIONES_PANEL_CLASS, open && HEADER_ACCIONES_PANEL_OPEN_CLASS)}
      >
        <ul className={HEADER_ACCIONES_LIST_CLASS}>
          {items.map((item, index) => (
            <li
              key={index}
              className={HEADER_ACCIONES_ITEM_CLASS}
              role="none"
              onClick={() => {
                cancelClose();
                setOpen(false);
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
