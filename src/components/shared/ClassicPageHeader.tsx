import PageSectionHeader, {
  type PageSectionHeaderProps,
} from "@/components/shared/PageSectionHeader";

export type ClassicPageHeaderProps = Omit<PageSectionHeaderProps, "tone">;

/**
 * Encabezado global compartido para páginas con layout clásico.
 * @see PageSectionHeader — núcleo; el fondo lo pinta `.section-header` (`--sidebar-user-switcher-bg`).
 */
export default function ClassicPageHeader(props: ClassicPageHeaderProps) {
  return <PageSectionHeader {...props} tone="card" />;
}
