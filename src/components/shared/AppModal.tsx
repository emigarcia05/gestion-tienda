"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const appModalContentVariants = cva(
  [
    // Base layout (3 rows: header / body / footer)
    "app-modal grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 w-full max-h-[90vh]",
    // Position + animation
    "fixed top-[50%] left-[50%] z-[80] translate-x-[-50%] translate-y-[-50%] duration-200",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    // Surface
    "max-w-[calc(100%-2rem)] bg-gris rounded-xl overflow-hidden outline-none border-0 shadow-xl",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "max-w-md",
        md: "max-w-lg",
        lg: "max-w-xl",
        xl: "max-w-3xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const appModalBodyCardVariants = cva(
  "app-modal__body w-full max-w-full bg-card rounded-lg shadow-sm min-h-0",
  {
    variants: {
      padding: {
        default: "p-6",
        sm: "p-4",
        lg: "p-8",
      },
      scroll: {
        auto: "overflow-auto",
        hidden: "overflow-hidden flex flex-col",
      },
    },
    defaultVariants: {
      padding: "default",
      scroll: "auto",
    },
  }
);

/**
 * Props del modal estándar de la app.
 * Layout wrapper: header corporativo + cuerpo en capas (gris → card blanca) + footer con botonera.
 */
export interface AppModalProps
  extends VariantProps<typeof appModalContentVariants>,
    VariantProps<typeof appModalBodyCardVariants> {
  /** Título del modal. Fuente Geist, blanco sobre fondo corporativo. Puede ser string o ReactNode (ej. título + indicador de pasos). */
  title: React.ReactNode;
  /** Contenido dinámico: formulario o datos. Se renderiza dentro de la card blanca centrada en el cuerpo. */
  children: React.ReactNode;
  /** Botonera del footer. Centrada verticalmente; acciones principales con bg #0072BB (primary) y texto blanco; cancelar con variant="outline" o "ghost". */
  actions: React.ReactNode;
  /** Clases adicionales del contenedor raíz (DialogContent). */
  className?: string;
  /** Clases adicionales del contenedor interno (card blanca del cuerpo). */
  bodyClassName?: string;
  /**
   * Padding del contenedor gris alrededor de la card (por defecto `p-4` vía `cn`).
   * Ej.: `p-2` para modales compactos.
   */
  bodyShellClassName?: string;
  /** Clases adicionales del header (fondo primary). Ej. `pt-3 pb-3` para modales densos. */
  headerClassName?: string;
  /** Clases adicionales del footer (botonera). Ej. `py-3` para reducir altura. */
  footerClassName?: string;
  /** Si se muestra el botón de cerrar (X). Por defecto true. */
  showCloseButton?: boolean;
  /** Si false, el cuerpo no hace scroll y el contenido debe caber (overflow-hidden). Por defecto true. */
  scrollBody?: boolean;
  /**
   * Si true y `scrollBody`, oculta la barra de scroll del área gris y de la card del cuerpo
   * (el desplazamiento con rueda/táctil se mantiene). Ver `globals.css` (`.app-modal__scroll-area` / `.app-modal__body` + `.no-scrollbar`).
   */
  hideBodyScrollbars?: boolean;
}

/**
 * Modal estándar de la app (Layout Wrapper).
 *
 * Estructura:
 * - Header: fondo #0072BB (primary), texto blanco Geist centrado, sin bordes internos.
 * - Cuerpo: contenedor externo gris claro (app background); card interna blanca centrada con padding consistente.
 * - Footer: fondo gris claro (igual que contenedor externo del cuerpo), botones centrados verticalmente; primarios #0072BB con texto blanco.
 *
 * Uso: dentro de <Dialog open={open} onOpenChange={setOpen}>.
 */
export default function AppModal({
  title,
  children,
  actions,
  size,
  padding,
  className,
  bodyClassName,
  bodyShellClassName,
  headerClassName,
  footerClassName,
  showCloseButton = true,
  scrollBody = true,
  hideBodyScrollbars = false,
}: AppModalProps) {
  return (
    <DialogContent
      className={cn(
        appModalContentVariants({ size }),
        className
      )}
      showCloseButton={showCloseButton}
    >
      {/* Header: fondo corporativo #0072BB, texto blanco Geist, centrado; sin bordes internos */}
      <DialogHeader
        className={cn(
          "shrink-0 bg-primary px-6 pt-5 pb-4 pr-12",
          headerClassName
        )}
      >
        <DialogTitle className="font-sans text-lg font-semibold text-primary-foreground tracking-tight w-full flex items-center justify-center gap-3 text-center">
          {title}
        </DialogTitle>
      </DialogHeader>

      {/* Cuerpo: scroll cuando scrollBody; si no, overflow-hidden para que el contenido se adapte */}
      <div
        className={cn(
          "min-h-0 flex flex-col bg-gris",
          scrollBody ? "overflow-auto" : "overflow-hidden"
        )}
      >
        <div
          className={cn(
            "min-h-0 flex items-stretch justify-center flex-1 p-4",
            bodyShellClassName
          )}
        >
          <div
            className={cn(
              appModalBodyCardVariants({
                padding,
                scroll: scrollBody ? "auto" : "hidden",
              }),
              bodyClassName,
              scrollBody && hideBodyScrollbars && "no-scrollbar"
            )}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Footer: mismo gris universal que cuerpo externo; botonera centrada verticalmente */}
      <div
        className={cn(
          "shrink-0 flex flex-row items-center justify-end gap-2 px-6 py-4 bg-gris",
          footerClassName
        )}
      >
        {actions}
      </div>
    </DialogContent>
  );
}
