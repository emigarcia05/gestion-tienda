"use client";

import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * CVA de `ToolbarActionButton`.
 *
 * Solo agrega variantes que NO duplican lo que ya ofrece `Button` de shadcn.
 * `variant` y `size` del botón base se re-exponen tal cual (pass-through).
 */
const toolbarActionButtonVariants = cva("", {
  variants: {
    density: {
      /** Separación estándar icon ↔ label (hereda `gap-2` del Button base). */
      default: "",
      /** Toolbars muy compactas (filas de acciones densas). */
      tight: "gap-1.5",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

type BaseButtonProps = ComponentProps<typeof Button>;

export interface ToolbarActionButtonProps
  extends Omit<BaseButtonProps, "children">,
    VariantProps<typeof toolbarActionButtonVariants> {
  /**
   * Texto visible del botón (title case, ver guía §3).
   * Si se omite, el botón debe recibir `aria-label` para mantener accesibilidad.
   */
  label?: ReactNode;
  /**
   * Icono izquierdo (ej. `<RefreshCw />`).
   * El `Button` base ya aplica `size-4 shrink-0` a los `<svg>` sin tamaño explícito,
   * por lo que no hace falta repetir `h-4 w-4 shrink-0` en cada call site.
   */
  icon?: ReactNode;
  /**
   * Estado async: deshabilita el botón, muestra spinner y setea `aria-busy`.
   * El `Loader2` reemplaza al `icon` mientras dure la acción.
   */
  loading?: boolean;
  /** Texto alterno mientras `loading` (ej. "Importando…"); por defecto reutiliza `label`. */
  loadingLabel?: ReactNode;
}

/**
 * Botón estándar para barras de acciones y encabezados de página.
 *
 * Centraliza el patrón `icon + label + estado loading` accesible,
 * delegando tipografía/altura/tokens al `Button` de shadcn (`variant`/`size`).
 * No duplica estilos: la clase base ya incluye `inline-flex items-center gap-2 shrink-0`
 * y tamaña los SVGs a `size-4` automáticamente.
 *
 * @example
 * // Acción primaria con ícono
 * <ToolbarActionButton
 *   label="Importar Datos Dux"
 *   icon={<RefreshCw />}
 *   onClick={handleImport}
 * />
 *
 * @example
 * // Acción con estado async y texto alterno
 * <ToolbarActionButton
 *   label="Importar Datos Dux"
 *   loadingLabel="Importando…"
 *   loading={syncing}
 *   icon={<RefreshCw />}
 *   onClick={handleImport}
 * />
 *
 * @example
 * // Variante secundaria
 * <ToolbarActionButton
 *   variant="secondary"
 *   label="Imprimir"
 *   icon={<Printer />}
 * />
 */
export default function ToolbarActionButton({
  label,
  icon,
  loading = false,
  loadingLabel,
  density,
  className,
  disabled,
  variant = "default",
  size = "default",
  type = "button",
  ...rest
}: ToolbarActionButtonProps) {
  const busy = !!loading;
  const visibleIcon = busy ? <Loader2 className="animate-spin" aria-hidden /> : icon;
  const visibleLabel = busy ? (loadingLabel ?? label) : label;

  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(toolbarActionButtonVariants({ density }), className)}
      {...rest}
    >
      {visibleIcon}
      {visibleLabel}
    </Button>
  );
}

