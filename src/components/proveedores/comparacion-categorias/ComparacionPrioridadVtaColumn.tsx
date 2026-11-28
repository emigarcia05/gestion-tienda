"use client";

import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CatalogoFinderColumn from "@/components/shared/catalogo-finder/CatalogoFinderColumn";
import CatalogoFinderEmpty from "@/components/shared/catalogo-finder/CatalogoFinderEmpty";
import {
  CATALOGO_FINDER_COLUMN_NOVO_BUTTON_COMPACT_CLASS,
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { DireccionPrioridadFamilia } from "@/services/categoriasComparacion.service";
import { cn } from "@/lib/utils";
import type { FamiliaPrioridadComparacion } from "@/services/categoriasComparacion.service";

interface Props {
  subcategoriaSeleccionada: boolean;
  loading: boolean;
  familias: FamiliaPrioridadComparacion[];
  puedeEditar: boolean;
  quitarPendingId: string | null;
  moverPendingId: string | null;
  onAgregar: () => void;
  onMover: (id: string, direccion: DireccionPrioridadFamilia) => void;
  onQuitar: (id: string) => void;
}

export default function ComparacionPrioridadVtaColumn({
  subcategoriaSeleccionada,
  loading,
  familias,
  puedeEditar,
  quitarPendingId,
  moverPendingId,
  onAgregar,
  onMover,
  onQuitar,
}: Props) {
  const gridClass = puedeEditar
    ? "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-1.5"
    : "grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-1.5";

  return (
    <CatalogoFinderColumn
      titulo="PRIORIDAD VTA"
      mostrarNuevo={puedeEditar && subcategoriaSeleccionada && !loading}
      onNuevo={onAgregar}
      deshabilitada={!subcategoriaSeleccionada}
    >
      {!subcategoriaSeleccionada ? (
        <CatalogoFinderEmpty mensaje="Seleccioná una subcategoría para ver la prioridad de venta." />
      ) : loading ? (
        <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Cargando familias…
        </div>
      ) : familias.length === 0 ? (
        <CatalogoFinderEmpty mensaje="Sin familias. Usá + para agregar." />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {familias.map((familia, index) => {
            const quitarPending = quitarPendingId === familia.id;
            const ocupada = quitarPending || moverPendingId != null;
            return (
              <div
                key={familia.id}
                className={cn(gridClass, "border-b px-2 py-2 text-xs")}
              >
                <span className="text-center font-mono tabular-nums text-muted-foreground">
                  {familia.orden}
                </span>
                <span className="min-w-0 truncate" title={familia.familiaNombre}>
                  {familia.familiaNombre}
                </span>
                {puedeEditar ? (
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_COMPACT_CLASS}
                      disabled={ocupada || index === 0}
                      title="Subir"
                      aria-label={`Subir ${familia.familiaNombre}`}
                      onClick={() => onMover(familia.id, "subir")}
                    >
                      <ChevronUp className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={CATALOGO_FINDER_COLUMN_NOVO_BUTTON_COMPACT_CLASS}
                      disabled={ocupada || index === familias.length - 1}
                      title="Bajar"
                      aria-label={`Bajar ${familia.familiaNombre}`}
                      onClick={() => onMover(familia.id, "bajar")}
                    >
                      <ChevronDown className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                        "!size-7 max-h-7 min-h-7 min-w-7 shrink-0 !p-0"
                      )}
                      disabled={ocupada}
                      title="Quitar familia"
                      aria-label={`Quitar ${familia.familiaNombre}`}
                      onClick={() => onQuitar(familia.id)}
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
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </CatalogoFinderColumn>
  );
}
