import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import ClassicPageHeader from "./ClassicPageHeader";

export interface ClassicFilteredTableLayoutProps {
  /** Título del módulo (h1 en el header). */
  title: string;
  /** Submódulo 1 (negrita en el h3). */
  subtitle?: string;
  /** Submódulo 2 (normal), separado por " - ". */
  subtitleSecondary?: string;
  /** Botones de la ventana: `PageSectionHeader` los muestra como menú **ACCIONES** (hover). */
  actions?: React.ReactNode;
  /** Contenedor de filtros (inputs, selects). Padding y gap consistentes. */
  filters?: React.ReactNode;
  /** Contenido principal: tabla o DataTable. Ocupa el espacio restante con scroll. */
  children: React.ReactNode;
  /** Clases del contenedor raíz. */
  className?: string;
  /** Clases del área de contenido (filtros + tabla). */
  contentClassName?: string;
  /** Variante visual del fondo raíz. */
  tone?: VariantProps<typeof rootVariants>["tone"];
  /** Ancho máximo del contenedor principal. */
  contentWidth?: VariantProps<typeof contentVariants>["contentWidth"];
  /** Densidad vertical de la sección de contenido. */
  density?: VariantProps<typeof contentVariants>["density"];
  /** Etiqueta accesible del bloque de filtros. */
  filtersAriaLabel?: string;
}

const rootVariants = cva("h-full min-h-0 flex flex-col", {
  variants: {
    tone: {
      gray: "bg-gris",
      card: "bg-card",
    },
  },
  defaultVariants: {
    tone: "gray",
  },
});

const contentVariants = cva(
  "flex-1 min-h-0 flex flex-col overflow-hidden w-full contenedor-pagina-con-filtros",
  {
    variants: {
      contentWidth: {
        default: "max-w-7xl mx-auto",
        /** Ancho completo con padding reducido típico en Comp. Categorias (+50 % útil vs `default` `max-w-7xl`). */
        wide150: "max-w-none w-full",
        full: "max-w-none",
      },
      density: {
        default: "px-8 gap-0",
        compact: "px-6 gap-0",
      },
    },
    defaultVariants: {
      contentWidth: "default",
      density: "default",
    },
  }
);

/**
 * Template de página reutilizable: Header (título + subtítulo + acciones) + Filtros + Tabla.
 * Genérico: reutilizable en cualquier ruta inyectando title, subtitle, actions, filters y children.
 * Espacios: padding y gap consistentes en toda la app.
 */
export default function ClassicFilteredTableLayout({
  title,
  subtitle,
  subtitleSecondary,
  actions,
  filters,
  children,
  className,
  contentClassName,
  tone = "gray",
  contentWidth = "default",
  density = "default",
  filtersAriaLabel = "Filtros",
}: ClassicFilteredTableLayoutProps) {
  return (
    <div className={cn(rootVariants({ tone }), className)}>
      <ClassicPageHeader
        title={title}
        subtitle={subtitle}
        subtitleSecondary={subtitleSecondary}
        actions={actions}
      />

      <div
        className={cn(
          contentVariants({ contentWidth, density }),
          contentClassName
        )}
      >
        {filters != null && (
          <div className="shrink-0 w-full" role="search" aria-label={filtersAriaLabel}>
            {filters}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden w-full flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
