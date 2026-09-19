import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { cva, type VariantProps } from "class-variance-authority";
import HeaderAccionesMenu from "@/components/shared/HeaderAccionesMenu";
import { cn } from "@/lib/utils";

const pageSectionHeaderRootVariants = cva("section-header shrink-0 w-full", {
  variants: {
    tone: {
      /** Confía en `.section-header` (globals.css) para `--card`. */
      default: "",
      /** Refuerzo explícito con token Tailwind cuando el contexto lo requiera. */
      card: "bg-card",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export type PageSectionHeaderProps = {
  /** Nombre del módulo (h1). Visual: MAYÚSCULAS vía `.section-header__titulo`. */
  title: string;
  /**
   * Submódulo 1. Visual: MAYÚSCULAS + negrita (`.section-header__subtitulo-primario`).
   * Con `subtitleSecondary`: "SUBMÓDULO 1 - Submódulo 2".
   */
  subtitle?: string;
  /**
   * Submódulo 2. Visual: Title Case + negrita (`.section-header__subtitulo-secundario`),
   * separado por " - " tras `subtitle`.
   */
  subtitleSecondary?: string;
  actions?: ReactNode;
  className?: string;
} & VariantProps<typeof pageSectionHeaderRootVariants>;

/**
 * Núcleo compartido de encabezados de página (barra primaria, título, subtítulo, acciones).
 * Usar vía `SectionHeader` o `ClassicPageHeader` para no romper APIs existentes.
 *
 * `actions` se envuelve en `HeaderAccionesMenu`: un botón **ACCIONES** y lista al hover.
 * Jerarquía visual: **MÓDULO** (h1 MAYÚSCULAS) → **SUBMÓDULO 1** (MAYÚSCULAS negrita)
 * - **Submódulo 2** (Title Case negrita).
 */
export default function PageSectionHeader({
  title,
  subtitle,
  subtitleSecondary,
  actions,
  className,
  tone = "default",
}: PageSectionHeaderProps) {
  const showSubtitle = subtitle != null && subtitle !== "";
  const showSecondary =
    showSubtitle && subtitleSecondary != null && subtitleSecondary !== "";

  return (
    <header
      className={cn(pageSectionHeaderRootVariants({ tone }), className)}
      role="banner"
    >
      <div className="section-header__inner flex flex-nowrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="section-header__bar" aria-hidden />
          <div className="min-w-0 flex flex-col gap-0.5">
            <h1 className="section-header__titulo">{title}</h1>
            {showSubtitle && (
              <h3 className="section-header__subtitulo">
                <span className="section-header__subtitulo-primario">{subtitle}</span>
                {showSecondary ? (
                  <>
                    <span className="section-header__subtitulo-sep" aria-hidden>
                      {" "}
                      -{" "}
                    </span>
                    <span className="section-header__subtitulo-secundario">
                      {subtitleSecondary}
                    </span>
                  </>
                ) : null}
              </h3>
            )}
          </div>
        </div>
        {actions != null && (
          <div className="section-header-actions flex shrink-0 items-center justify-end">
            <HeaderAccionesMenu>{actions}</HeaderAccionesMenu>
          </div>
        )}
      </div>
      <Separator className={cn("section-header-divider", "bg-border")} />
    </header>
  );
}

