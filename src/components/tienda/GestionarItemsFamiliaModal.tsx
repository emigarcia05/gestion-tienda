"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiltroIndividualContainer } from "@/components/FilterBar";
import {
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buscarItemsFamiliaAction, guardarItemsFamiliaAction } from "@/actions/listaProductos";
import type { ItemSelectorFamilia } from "@/lib/listaProductos";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familiaId: string;
  onGuardado?: () => void;
}

function mismaSeleccion(iniciales: Set<string>, selected: Map<string, ItemSelectorFamilia>): boolean {
  if (iniciales.size !== selected.size) return false;
  for (const codigo of iniciales) {
    if (!selected.has(codigo)) return false;
  }
  return true;
}

export default function GestionarItemsFamiliaModal({ open, onOpenChange, familiaId, onGuardado }: Props) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<ItemSelectorFamilia[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Map<string, ItemSelectorFamilia>>(new Map());
  const [iniciales, setIniciales] = useState<Set<string>>(new Set());
  const sembrado = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (open) return;
    sembrado.current = false;
    setQ("");
    setDebouncedQ("");
    setItems([]);
    setSelected(new Map());
    setIniciales(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setLoading(true);
    void buscarItemsFamiliaAction({ id: familiaId, q: debouncedQ }).then((res) => {
      if (cancelado) return;
      if (!res.ok) {
        toast.error(res.error);
        setItems([]);
        setLoading(false);
        return;
      }
      setItems(res.data);
      if (!sembrado.current && debouncedQ.trim().length === 0) {
        const map = new Map<string, ItemSelectorFamilia>();
        const ids = new Set<string>();
        for (const item of res.data) {
          if (!item.enFamilia) continue;
          map.set(item.codTienda, item);
          ids.add(item.codTienda);
        }
        setSelected(map);
        setIniciales(ids);
        sembrado.current = true;
      }
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [open, familiaId, debouncedQ]);

  function toggle(item: ItemSelectorFamilia) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.codTienda)) next.delete(item.codTienda);
      else next.set(item.codTienda, item);
      return next;
    });
  }

  function cerrar() {
    if (pending) return;
    onOpenChange(false);
  }

  async function confirmar() {
    if (pending || mismaSeleccion(iniciales, selected)) return;
    setPending(true);
    try {
      const res = await guardarItemsFamiliaAction({
        id: familiaId,
        codTiendas: [...selected.keys()],
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ítems de la familia actualizados.");
      onGuardado?.();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  const sinCambios = mismaSeleccion(iniciales, selected);
  const etiqueta =
    selected.size > 0 ? `Agregar (${selected.size})` : "Guardar";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cerrar();
      }}
    >
      <DialogContent className="modal-app max-w-[40rem] w-[calc(100%-2rem)] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="modal-app__header shrink-0">
          <DialogTitle className="modal-app__title">Gestionar Items</DialogTitle>
        </DialogHeader>

        <div className="modal-app__content flex-1 min-h-0">
          <div className="modal-app__body flex flex-col flex-1 min-h-0 overflow-hidden px-6 py-4 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">DESCRIPCIÓN</label>
              <FiltroIndividualContainer className="w-full" activo={!!q.trim()} onLimpiar={() => setQ("")}>
                <div className="relative w-full min-w-0">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="input-filtro-unificado w-full pl-9"
                    autoFocus
                  />
                </div>
              </FiltroIndividualContainer>
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border">
              <div className="shrink-0">
                <Table variant="compact">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-transparent">
                      <TableHead className="w-12 text-xs"> </TableHead>
                      <TableHead className="text-xs">DESCRIPCIÓN</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Table variant="compact">
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className={tableEmptyStateContainerVariants({ placement: "tableCell", textSize: "sm" })}
                        >
                          <span className={tableEmptyStateMessageVariants({ maxWidth: "full" })}>Cargando...</span>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {!loading && items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className={tableEmptyStateContainerVariants({ placement: "tableCell", textSize: "sm" })}
                        >
                          <span className={tableEmptyStateMessageVariants({ maxWidth: "full" })}>Sin resultados</span>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {!loading
                      ? items.map((item) => {
                          const isSelected = selected.has(item.codTienda);
                          return (
                            <TableRow
                              key={item.codTienda}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggle(item)}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(item);
                                  }}
                                >
                                  {isSelected ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
                                </button>
                              </TableCell>
                              <TableCell className="celda-datos text-left">{item.descripcion}</TableCell>
                            </TableRow>
                          );
                        })
                      : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="modal-app__footer shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmar()} disabled={pending || sinCambios}>
              {etiqueta}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
