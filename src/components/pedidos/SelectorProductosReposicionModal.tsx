"use client";

import { useState, useEffect } from "react";
import { Search, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductosReposicionSelector, type ItemSelectorReposicion } from "@/actions/reposicion";
import type { SucursalReposicion } from "@/actions/reposicion";
import { getProductosSelectorReposicionCorpAction } from "@/actions/reposicionCorp";
import { FiltroIndividualContainer } from "@/components/FilterBar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `corp`: todo `prod_lista` habilitado (sin sucursal ni proveedor). */
  modo?: "sucursal" | "corp";
  sucursal?: SucursalReposicion;
  /** Solo con POR_BULTO: limita a productos con bulto vacío o igual. */
  bultoReferencia: number | null;
  onConfirmar: (seleccionados: ItemSelectorReposicion[]) => void;
  excludeIds?: string[];
}

async function buscarProductos(
  modo: "sucursal" | "corp",
  sucursal: SucursalReposicion | undefined,
  q: string,
  bultoReferencia: number | null
): Promise<ItemSelectorReposicion[]> {
  if (modo === "corp") {
    const res = await getProductosSelectorReposicionCorpAction({ q, bultoReferencia });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cargar los productos.");
      return [];
    }
    return res.data;
  }
  if (!sucursal) return [];
  return getProductosReposicionSelector({ sucursal, q, bultoReferencia });
}

export default function SelectorProductosReposicionModal({
  open,
  onOpenChange,
  modo = "sucursal",
  sucursal,
  bultoReferencia,
  onConfirmar,
  excludeIds = [],
}: Props) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<ItemSelectorReposicion[]>([]);
  const [loading, setLoading] = useState(false);
  /** Persiste entre búsquedas: se puede tildar en varias búsquedas antes de Agregar. */
  const [selected, setSelected] = useState<Map<string, ItemSelectorReposicion>>(new Map());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    queueMicrotask(() => {
      if (cancelado) return;
      setLoading(true);
      void buscarProductos(modo, sucursal, debouncedQ, bultoReferencia).then((list) => {
        if (cancelado) return;
        setItems(list);
        setLoading(false);
      });
    });
    return () => {
      cancelado = true;
    };
  }, [open, modo, sucursal, debouncedQ, bultoReferencia]);

  const toggle = (item: ItemSelectorReposicion) => {
    const key = item.idListaTienda;
    if (excludeIds.includes(key)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });
  };

  const reiniciar = () => {
    setSelected(new Map());
    setQ("");
  };

  const handleConfirmar = () => {
    onConfirmar([...selected.values()]);
    reiniciar();
    onOpenChange(false);
  };

  const handleCerrar = () => {
    reiniciar();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reiniciar();
        onOpenChange(o);
      }}
    >
      <DialogContent className="modal-app max-w-[40rem] w-[calc(100%-2rem)] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="modal-app__header shrink-0">
          <DialogTitle className="modal-app__title">Seleccionar Productos</DialogTitle>
        </DialogHeader>

        <div className="modal-app__content flex-1 min-h-0">
          <div className="modal-app__body flex flex-col flex-1 min-h-0 overflow-hidden px-6 py-4 gap-4">
            <div>
            <label className="text-sm font-medium text-foreground block mb-1">DESCRIPCIÓN</label>
            <FiltroIndividualContainer
              className="w-full"
              activo={!!q.trim()}
              onLimpiar={() => setQ("")}
            >
              <div className="relative w-full min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 input-filtro-unificado w-full"
                  autoFocus
                />
              </div>
            </FiltroIndividualContainer>
            </div>

            <div className="border border-border rounded-lg flex-1 min-h-0 flex flex-col">
              {/* Encabezado fijo: fuera del contenedor con scroll */}
              <div className="shrink-0">
                <Table variant="compact">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/50">
                      <TableHead className="w-12 text-xs"> </TableHead>
                      <TableHead className="text-xs">DESCRIPCIÓN</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
              {/* Cuerpo con scroll */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <Table variant="compact">
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className={tableEmptyStateContainerVariants({
                            placement: "tableCell",
                            textSize: "sm",
                          })}
                        >
                          <span
                            className={tableEmptyStateMessageVariants({
                              maxWidth: "full",
                            })}
                          >
                            Cargando...
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && items.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className={tableEmptyStateContainerVariants({
                            placement: "tableCell",
                            textSize: "sm",
                          })}
                        >
                          <span
                            className={tableEmptyStateMessageVariants({
                              maxWidth: "full",
                            })}
                          >
                            Sin resultados
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading &&
                      items.map((item) => {
                        const key = item.idListaTienda;
                        const isSelected = selected.has(key);
                        const disabled = excludeIds.includes(key);
                        return (
                          <TableRow
                            key={key}
                            className={cn(
                              disabled && "opacity-50",
                              !disabled && "cursor-pointer hover:bg-muted/50"
                            )}
                            onClick={() => !disabled && toggle(item)}
                          >
                            <TableCell className="celda-datos w-12 text-center">
                              <button
                                type="button"
                                className={cn(
                                  "selector-cuadro inline-flex items-center justify-center rounded border-2 transition-colors",
                                  isSelected && "selector-cuadro--selected"
                                )}
                                aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
                                aria-checked={isSelected}
                                role="checkbox"
                                disabled={disabled}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!disabled) toggle(item);
                                }}
                              >
                                {isSelected ? (
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                ) : null}
                              </button>
                            </TableCell>
                            <TableCell className="celda-datos text-left">
                              {item.descripcionTienda ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="modal-app__footer shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCerrar}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmar} disabled={selected.size === 0}>
              {selected.size > 0 ? `Agregar (${selected.size})` : "Agregar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
