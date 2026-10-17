"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppModal from "@/components/shared/AppModal";
import { buscarComponentesCandidatosAction } from "@/actions/listaProductos";
import type { ComponenteCandidatoItem } from "@/lib/productoCompuesto";
import { fmtPrecio } from "@/lib/format";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const LIST_ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-9 w-9 min-h-9 max-h-9");
const BUSQUEDA_DEBOUNCE_MS = 300;

/**
 * Buscador de componentes para un producto compuesto: ítems de `prod_lista` que no son compuestos,
 * distintos del compuesto y no agregados todavía. Montar solo con el modal abierto.
 * `codTienda` null = compuesto todavía sin crear (Agregar Item).
 */
export default function SeleccionarComponenteCompuestoModal({
  codTienda,
  excluir,
  onSeleccionar,
  onClose,
}: {
  codTienda: string | null;
  excluir: string[];
  onSeleccionar: (item: ComponenteCandidatoItem) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [candidatos, setCandidatos] = useState<ComponenteCandidatoItem[]>([]);

  useEffect(() => {
    let activo = true;
    const timer = setTimeout(() => {
      setCargando(true);
      void buscarComponentesCandidatosAction({ codTienda, q: busqueda }).then((res) => {
        if (!activo) return;
        if (res.ok) setCandidatos(res.data);
        else toast.error(res.error);
        setCargando(false);
      });
    }, BUSQUEDA_DEBOUNCE_MS);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [codTienda, busqueda]);

  const visibles = candidatos.filter((c) => !excluir.includes(c.codTienda));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppModal
        title="Agregar Componente"
        size="lg"
        className="max-w-xl"
        scrollBody
        hideBodyScrollbars
        actions={
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
              className="h-10 pl-9"
              aria-label="Buscar producto"
              autoFocus
            />
          </div>
          <div className="min-h-[12rem]">
            {cargando ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Buscando...
              </p>
            ) : visibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún producto coincide con la búsqueda.</p>
            ) : (
              <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
                {visibles.map((c) => (
                  <li
                    key={c.codTienda}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium text-foreground" title={c.descripcion}>
                        {c.descripcion || c.codTienda}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.codTienda} · COSTO <span className="tabular-nums">${fmtPrecio(c.costoUnitario)}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={LIST_ROW_ICON_BTN_CLASS}
                      aria-label={`Agregar ${c.descripcion || c.codTienda}`}
                      onClick={() => onSeleccionar(c)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
