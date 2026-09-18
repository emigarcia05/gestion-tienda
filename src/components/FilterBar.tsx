import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * FILTROS — Estilo madre reutilizable.
 * Para nuevos módulos: usar FilterBar > FilterRowSelection (con FILTER_SELECT_WRAPPER_CLASS
 * en cada Select) + fila con FilterRowSearch (INPUT_FILTER_CLASS) y LimpiarFiltrosButton.
 * Contador: FILTER_COUNT_CLASS. Colores y tipografía heredan de este archivo.
 */
export default function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "seccion-filtros filtros-contenedor flex flex-col gap-y-2",
        className
      )}
      role="search"
      aria-label="FILTROS DE BÚSQUEDA"
    >
      {children}
    </div>
  );
}

/** Fila 1 (Selección): solo menús desplegables (Select). items-center + gap-3 para alineación con inputs. */
export function FilterRowSelection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {children}
    </div>
  );
}

/**
 * Fila de filtros desplegables en grid uniforme (4, 5 o 6 columnas).
 * Default **5** (estándar de la app). Usar **`columnas={6}`** solo cuando la fila
 * tiene **exactamente 6** listas desplegables juntas (p. ej. Categorizacion).
 * Con 5 o menos: dejar el default o `columnas={4}` según el layout (sin cambios).
 */
export function FilaFiltrosDesplegables({
  children,
  columnas = 5,
}: {
  children: React.ReactNode;
  /** Cantidad de columnas del grid (por defecto 5). */
  columnas?: 4 | 5 | 6;
}) {
  return (
    <div
      className={cn(
        "fila-filtros-desplegables grid w-full gap-3",
        columnas === 4 && "fila-filtros-4 grid-cols-4",
        columnas === 5 && "fila-filtros-5 grid-cols-5",
        columnas === 6 && "fila-filtros-6 grid-cols-6"
      )}
    >
      {children}
    </div>
  );
}

/** Fila 2 (Búsqueda): input de texto. Ocupa ~75% dejando espacio al botón de limpieza; borde primary cuando activo. */
export function FilterRowSearch({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-[75%] max-w-2xl min-w-0", className)}>
      {children}
    </div>
  );
}

/**
 * Wrapper de filtro individual con botón tacho contextual.
 * El botón aparece solo cuando el filtro está activo.
 */
export function FiltroIndividualContainer({
  children,
  activo,
  onLimpiar,
  className,
}: {
  children: React.ReactNode;
  activo: boolean;
  onLimpiar: () => void;
  className?: string;
}) {
  return (
    <div className={cn("filtro-individual-container min-w-0 flex-1", className)}>
      {children}
      {activo ? (
        <Button
          type="button"
          variant="primaryIcon"
          size="icon-lg"
          onClick={onLimpiar}
          className="filtro-individual-clear-btn"
          aria-label="Limpiar este filtro"
          title="Limpiar este filtro"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

/** Fila 2 alternativa: filtro por rango de fechas (trigger con flecha). */
export function FilterRowDateRange({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("w-full", className)}>{children}</div>;
}

/**
 * Clase global única para input y SelectTrigger de filtros (SSOT en globals.css).
 * Un cambio en .input-filtro-unificado se propaga a todos los filtros.
 * El contorno azul (`--primary`) es la misma regla que `Input` / `SelectTrigger` (`--input`).
 */
export const INPUT_FILTER_CLASS = "input-filtro-unificado";

/**
 * Wrapper para cada Select de filtros. Con flex-1 min-w-0, hasta 5 desplegables
 * entran en una fila repartiendo el ancho por igual. Heredable.
 */
export const FILTER_SELECT_WRAPPER_CLASS = "min-w-0 flex-1";

/** Misma clase global que INPUT_FILTER_CLASS: un solo estilo para input y trigger. */
export const SELECT_TRIGGER_FILTER_CLASS = "input-filtro-unificado";

/**
 * Slot inline para acciones en pantallas sin búsqueda por descripción.
 * Se usa dentro de `FilaFiltrosDesplegables` para conservar una sola línea.
 */
export const FILTER_INLINE_ACTION_SLOT_CLASS = "min-w-0 flex items-center justify-end";

/** Clase para el indicador de cantidad de elementos filtrados (color primario del tema). Reutilizable en todos los filtros. */
export const FILTER_COUNT_CLASS =
  "text-sm text-primary tabular-nums shrink-0 font-semibold filtro-count-label";

/** Trigger estándar para rango de fechas por calendario. */
export const FILTER_DATE_RANGE_TRIGGER_CLASS =
  "input-filtro-unificado w-full justify-between text-left font-normal";

/**
 * Botón cuadrado con icono de tacho de basura, al lado del filtro de descripción.
 * Al apretarlo borra todos los filtros. Heredable: usar en todos los módulos con filtros.
 */
export function LimpiarFiltrosButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="primaryIcon"
      size="icon-lg"
      onClick={onClick}
      className="limpiar-filtros-global-btn h-10 min-h-10 shrink-0"
      aria-label="Limpiar filtros"
      title="Limpiar filtros"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
