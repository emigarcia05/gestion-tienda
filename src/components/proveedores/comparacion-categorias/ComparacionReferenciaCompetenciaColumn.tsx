"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CatalogoFinderColumn from "@/components/shared/catalogo-finder/CatalogoFinderColumn";
import CatalogoFinderEmpty from "@/components/shared/catalogo-finder/CatalogoFinderEmpty";
import { fmtPrecio } from "@/lib/format";
import {
  CATALOGO_FINDER_ROW_INTERACTIVE_CLASS,
  CATALOGO_FINDER_ROW_SELECTED_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ReferenciaCompetenciaComparacion } from "@/services/categoriasComparacion.service";

interface Props {
  subcategoriaSeleccionada: boolean;
  loading: boolean;
  referenciasCompetencia: ReferenciaCompetenciaComparacion[];
  referenciaActivaId: string | null;
  puedeEditar: boolean;
  quitarPendingId: string | null;
  onSelectReferenciaActiva: (refCompId: string) => void;
  onAgregarReferencia: () => void;
  onQuitarReferencia: (refCompId: string) => void;
}

function referenciaGridClass(puedeEditar: boolean): string {
  return puedeEditar
    ? "grid grid-cols-[12fr_70fr_13fr_5fr] items-center gap-x-1.5"
    : "grid grid-cols-[12fr_73fr_15fr] items-center gap-x-1.5";
}

export default function ComparacionReferenciaCompetenciaColumn({
  subcategoriaSeleccionada,
  loading,
  referenciasCompetencia,
  referenciaActivaId,
  puedeEditar,
  quitarPendingId,
  onSelectReferenciaActiva,
  onAgregarReferencia,
  onQuitarReferencia,
}: Props) {
  const cantidad = referenciasCompetencia.length;
  const gridClass = referenciaGridClass(puedeEditar);

  return (
    <CatalogoFinderColumn
      titulo="REFERENCIA COMPETENCIA"
      mostrarNuevo={puedeEditar && subcategoriaSeleccionada && !loading}
      onNuevo={onAgregarReferencia}
      deshabilitada={!subcategoriaSeleccionada}
    >
      {!subcategoriaSeleccionada ? (
        <CatalogoFinderEmpty mensaje="Seleccioná una subcategoría para ver o editar el precio de referencia." />
      ) : loading ? (
        <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Cargando referencias…
        </div>
      ) : cantidad === 0 ? (
        <CatalogoFinderEmpty mensaje="Sin referencias para calcular margen. Usá + Nuevo para agregar." />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {referenciasCompetencia.map((ref) => {
            const esActiva = referenciaActivaId === ref.id;
            const producto = ref.descripcionTienda ?? ref.codTienda;
            const quitarPending = quitarPendingId === ref.id;

            return (
              <div
                key={ref.id}
                className={cn(
                  gridClass,
                  "border-b px-2 py-2 text-xs",
                  CATALOGO_FINDER_ROW_INTERACTIVE_CLASS,
                  esActiva && CATALOGO_FINDER_ROW_SELECTED_CLASS
                )}
                onClick={() => onSelectReferenciaActiva(ref.id)}
                role="button"
                tabIndex={0}
                data-selected={esActiva ? "true" : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectReferenciaActiva(ref.id);
                  }
                }}
              >
                <span
                  className={cn(
                    "min-w-0 w-full text-center font-mono leading-tight",
                    esActiva && "font-semibold text-primary"
                  )}
                >
                  {ref.competenciaAbreviatura}
                </span>
                <span
                  className={cn(
                    "min-w-0 w-full text-center line-clamp-2 break-words leading-snug",
                    esActiva && "font-medium text-foreground"
                  )}
                  title={producto}
                >
                  {producto}
                </span>
                <span
                  className={cn(
                    "min-w-0 w-full text-center tabular-nums leading-tight",
                    esActiva ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {ref.pxMostrar != null ? `$${fmtPrecio(ref.pxMostrar)}` : "—"}
                </span>
                {puedeEditar && (
                  <div className="flex min-w-0 items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                        "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
                      )}
                      disabled={quitarPending}
                      title="Quitar referencia"
                      aria-label={`Quitar referencia ${producto}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuitarReferencia(ref.id);
                      }}
                    >
                      {quitarPending ? (
                        <Loader2
                          className={cn(TABLE_ROW_ACTION_ICON_CLASS, "animate-spin")}
                          aria-hidden
                        />
                      ) : (
                        <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CatalogoFinderColumn>
  );
}
