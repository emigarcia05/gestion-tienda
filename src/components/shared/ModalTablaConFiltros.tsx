"use client";

import { useState, useEffect } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2 } from "lucide-react";
import {
  TableEmptyState,
  modalListLoadingVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";

const modalTablaContentVariants = cva(
  "modal-app max-w-[84rem] w-[calc(100%-2rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
);

const modalTablaHeadCellVariants = cva(
  "bg-primary text-primary-foreground font-bold uppercase",
  {
    variants: {
      kind: {
        select: "py-2 px-2 w-10",
        quantity: "py-2 px-2 w-14 text-center",
        data: "text-xs py-2 px-3",
      },
    },
    defaultVariants: {
      kind: "data",
    },
  }
);

const modalTablaBodyCellVariants = cva("text-xs py-2.5 px-3", {
  variants: {
    kind: {
      select: "py-2.5 px-2 w-10",
      quantity: "tabla-celda-cant w-14 p-0",
      data: "",
    },
  },
  defaultVariants: {
    kind: "data",
  },
});

const modalTablaRowVariants = cva("", {
  variants: {
    interaction: {
      none: "",
      single: "cursor-pointer select-none hover:bg-primary/5",
    },
    selected: {
      true: "bg-primary/5",
      false: "",
    },
  },
  defaultVariants: {
    interaction: "none",
    selected: false,
  },
});

export interface ColumnaModalTabla<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface ModalTablaConFiltrosBase<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  filterContent: React.ReactNode;
  columns: ColumnaModalTabla<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  count?: number;
  contentClassName?: string;
  /** Maneja doble clic en fila (single o multi). En multi puede usarse como “selección rápida” de un solo ítem. */
  onRowDoubleClick?: (row: T) => void;
  /** Clic simple en la fila (single, sin columna de selección). */
  onRowClick?: (row: T) => void;
  /**
   * Anchos de columna en % (incluye columna de selección si aplica).
   * Ej. `[5, 10, 20, 65]` → CHECK + 3 columnas de datos.
   */
  tableColumnWidthsPct?: readonly number[];
}

interface ModalTablaSingleSelect<T> extends ModalTablaConFiltrosBase<T> {
  selectionMode?: "single";
  onConfirm?: never;
  confirmLabel?: never;
  confirmPending?: never;
  confirmSingleDisabled?: never;
  showSingleConfirmCheckbox?: never;
  onConfirmSingle?: never;
  confirmSingleLabel?: never;
  onConfirmQuantity?: never;
  confirmQuantityLabel?: never;
  /** Contenido a la derecha del footer (ej. botón Cancelar). En multi se ignora. */
  footerRight?: React.ReactNode;
}

interface ModalTablaMultiSelect<T> extends ModalTablaConFiltrosBase<T> {
  selectionMode: "multi";
  onConfirm: (ids: string[]) => void | Promise<void>;
  confirmLabel?: (count: number) => string;
  confirmPending?: boolean;
  confirmSingleDisabled?: never;
  showSingleConfirmCheckbox?: never;
  onConfirmSingle?: never;
  confirmSingleLabel?: never;
  onConfirmQuantity?: never;
  confirmQuantityLabel?: never;
  footerRight?: never;
}

export interface ModalTablaQuantityItem {
  id: string;
  cantidad: number;
}

interface ModalTablaMultiQuantitySelect<T> extends ModalTablaConFiltrosBase<T> {
  selectionMode: "multiQuantity";
  onConfirm?: never;
  onConfirmQuantity: (items: ModalTablaQuantityItem[]) => void | Promise<void>;
  confirmQuantityLabel?: (count: number) => string;
  confirmPending?: boolean;
  confirmLabel?: never;
  confirmSingleDisabled?: never;
  showSingleConfirmCheckbox?: never;
  onConfirmSingle?: never;
  confirmSingleLabel?: never;
  footerRight?: never;
}

interface ModalTablaSingleConfirmSelect<T> extends ModalTablaConFiltrosBase<T> {
  selectionMode: "singleConfirm";
  onConfirm?: never;
  confirmLabel?: never;
  onConfirmSingle: (row: T) => void | Promise<void>;
  confirmSingleLabel?: string;
  confirmPending?: boolean;
  /** Deshabilita el botón de confirmar en modo singleConfirm por validaciones externas (ej. cantidad). */
  confirmSingleDisabled?: boolean;
  /** Muestra columna de checkbox para selección singleConfirm (1 fila a la vez). */
  showSingleConfirmCheckbox?: boolean;
  onConfirmQuantity?: never;
  confirmQuantityLabel?: never;
  footerRight?: never;
}

type ModalTablaConFiltrosProps<T> =
  | ModalTablaSingleSelect<T>
  | ModalTablaMultiSelect<T>
  | ModalTablaMultiQuantitySelect<T>
  | ModalTablaSingleConfirmSelect<T>;

type ModalTablaContentProps = VariantProps<typeof modalTablaContentVariants>;

function ModalTablaColGroup({ widthsPct }: { widthsPct: readonly number[] }) {
  return (
    <colgroup>
      {widthsPct.map((pct, i) => (
        <col key={i} style={{ width: `${pct}%` }} />
      ))}
    </colgroup>
  );
}

/**
 * Modal reutilizable: título + filtros + tabla.
 * - single: doble clic en fila para seleccionar (ej. vincular producto), o clic simple si hay `onRowClick`.
 * - multi: checkboxes para selección múltiple + botón confirmar (ej. asignar productos a categoría).
 * - multiQuantity: columna CANT con input entero positivo por fila + botón confirmar (ej. bases tintométricas).
 */
export default function ModalTablaConFiltros<T>({
  open,
  onClose,
  title,
  subtitle,
  filterContent,
  columns,
  rows,
  getRowId,
  onRowDoubleClick,
  onRowClick,
  onConfirm,
  onConfirmQuantity,
  onConfirmSingle,
  selectionMode = "single",
  confirmLabel = (n) => `ASIGNAR ${n} PRODUCTO(S)`,
  confirmQuantityLabel = (n) => `AGREGAR ${n} BASE(S)`,
  confirmSingleLabel = "AGREGAR",
  confirmPending = false,
  confirmSingleDisabled = false,
  showSingleConfirmCheckbox = false,
  loading = false,
  emptyMessage = "SIN RESULTADOS",
  count,
  contentClassName,
  tableColumnWidthsPct,
  footerRight: footerRightProp,
}: ModalTablaConFiltrosProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cantPorRowId, setCantPorRowId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setCantPorRowId({});
    }
  }, [open]);

  const isMulti = selectionMode === "multi";
  const isMultiQuantity = selectionMode === "multiQuantity";
  const isSingleConfirm = selectionMode === "singleConfirm";
  const showSelectColumn = isMulti || isMultiQuantity || (isSingleConfirm && showSingleConfirmCheckbox);
  const selectHeadClass = cn(
    modalTablaHeadCellVariants({ kind: "select" }),
    tableColumnWidthsPct && "!w-auto"
  );
  const selectBodyClass = cn(
    modalTablaBodyCellVariants({ kind: isMultiQuantity ? "quantity" : "select" }),
    tableColumnWidthsPct && "!w-auto"
  );
  const quantityHeadClass = cn(
    modalTablaHeadCellVariants({ kind: "quantity" }),
    tableColumnWidthsPct && "!w-auto"
  );

  function getQuantityItems(): ModalTablaQuantityItem[] {
    return rows
      .map((row) => {
        const id = getRowId(row);
        const n = Math.floor(Number(cantPorRowId[id]) || 0);
        if (n > 0) return { id, cantidad: n };
        return null;
      })
      .filter((item): item is ModalTablaQuantityItem => item !== null);
  }

  function hasValidQuantity(id: string) {
    const n = Number(cantPorRowId[id]);
    return Number.isFinite(n) && n > 0;
  }

  function setRowQuantity(id: string, value: string) {
    setCantPorRowId((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return prev;
      return { ...prev, [id]: String(Math.floor(n)) };
    });
  }

  function renderSelectHeadCell() {
    if (isMultiQuantity) {
      return (
        <TableHead className={quantityHeadClass}>
          CANT
        </TableHead>
      );
    }
    if (isMulti) {
      return (
        <TableHead className={selectHeadClass}>
          <label className="flex items-center justify-center cursor-pointer">
            <input
              type="checkbox"
              checked={rows.length > 0 && selectedIds.size === rows.length}
              onChange={toggleSelectAll}
              className="rounded border-input"
              aria-label="Seleccionar Todos"
            />
          </label>
        </TableHead>
      );
    }
    return (
      <TableHead className={selectHeadClass}>
        <Check className="mx-auto h-4 w-4 text-primary-foreground" aria-hidden />
        <span className="sr-only">Seleccionar</span>
      </TableHead>
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectSingle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.size === 1 && next.has(id)) return new Set();
      return new Set([id]);
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => getRowId(r))));
    }
  }

  async function handleConfirm() {
    if (!isMulti || selectedIds.size === 0 || !onConfirm) return;
    try {
      await onConfirm(Array.from(selectedIds));
      onClose();
    } catch {
      /* El padre muestra toast de error; no cerramos */
    }
  }

  async function handleConfirmQuantity() {
    if (!isMultiQuantity || !onConfirmQuantity) return;
    const items = getQuantityItems();
    if (items.length === 0) return;
    try {
      await onConfirmQuantity(items);
      onClose();
    } catch {
      /* El padre muestra toast de error; no cerramos */
    }
  }

  async function handleConfirmSingle() {
    if (!isSingleConfirm || selectedIds.size === 0 || !onConfirmSingle) return;
    try {
      const selectedId = Array.from(selectedIds)[0];
      const selectedRow = rows.find((r) => getRowId(r) === selectedId);
      if (!selectedRow) return;
      await onConfirmSingle(selectedRow);
      onClose();
    } catch {
      /* El padre muestra toast de error; no cerramos */
    }
  }

  const quantityItems = isMultiQuantity ? getQuantityItems() : [];

  const footerRight = isMulti ? (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClose}
        disabled={confirmPending}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={handleConfirm}
        disabled={confirmPending || selectedIds.size === 0}
      >
        {confirmPending ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel(selectedIds.size)}
      </Button>
    </>
  ) : isMultiQuantity ? (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClose}
        disabled={confirmPending}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={handleConfirmQuantity}
        disabled={confirmPending || quantityItems.length === 0}
      >
        {confirmPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          confirmQuantityLabel(quantityItems.length)
        )}
      </Button>
    </>
  ) : isSingleConfirm ? (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClose}
        disabled={confirmPending}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={handleConfirmSingle}
        disabled={confirmPending || confirmSingleDisabled || selectedIds.size === 0}
      >
        {confirmPending ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmSingleLabel}
      </Button>
    </>
  ) : (
    footerRightProp ?? (
      <Button variant="outline" size="sm" onClick={onClose}>
        Cancelar
      </Button>
    )
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className={cn(
          modalTablaContentVariants({} satisfies ModalTablaContentProps),
          contentClassName
        )}
      >
        <DialogHeader className="modal-app__header shrink-0">
          <DialogTitle className="modal-app__title">{title}</DialogTitle>
        </DialogHeader>

        <div className="modal-app__content flex-1 min-h-0 flex flex-col">
          <div className="modal-app__body flex flex-col flex-1 min-h-0 overflow-hidden px-6 pt-4 pb-0">
            {subtitle && (
              <p className="text-xs text-muted-foreground shrink-0 uppercase tracking-wide">
                {subtitle}
              </p>
            )}
            <div className="shrink-0 w-full flex flex-col gap-2 pb-3 border-b border-border">
              {filterContent}
            </div>

            <div className="flex-1 min-h-0 flex flex-col pt-3 pb-3 overflow-hidden">
              {loading ? (
                <>
                  <div className="shrink-0 overflow-hidden">
                    <Table variant="compact" className="table-fixed w-full">
                      {tableColumnWidthsPct ? (
                        <ModalTablaColGroup widthsPct={tableColumnWidthsPct} />
                      ) : null}
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-0">
                          {showSelectColumn ? renderSelectHeadCell() : null}
                          {columns.map((col) => (
                            <TableHead
                              key={col.key}
                              className={cn(
                                modalTablaHeadCellVariants({ kind: "data" }),
                                col.className
                              )}
                            >
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto border-b border-border">
                    <div
                      className={cn(
                        modalListLoadingVariants({ padding: "panel" }),
                        "h-full w-full flex items-center justify-center"
                      )}
                      role="status"
                      aria-live="polite"
                    >
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                      CARGANDO…
                    </div>
                  </div>
                </>
              ) : rows.length === 0 ? (
                <>
                  <div className="shrink-0 overflow-hidden">
                    <Table variant="compact" className="table-fixed w-full">
                      {tableColumnWidthsPct ? (
                        <ModalTablaColGroup widthsPct={tableColumnWidthsPct} />
                      ) : null}
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-0">
                          {showSelectColumn ? renderSelectHeadCell() : null}
                          {columns.map((col) => (
                            <TableHead
                              key={col.key}
                              className={cn(
                                modalTablaHeadCellVariants({ kind: "data" }),
                                col.className
                              )}
                            >
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto border-b border-border">
                    <div className="h-full w-full flex items-center justify-center px-2">
                      <TableEmptyState message={emptyMessage} placement="panel" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="shrink-0 overflow-hidden">
                    <Table variant="compact" className="table-fixed w-full">
                      {tableColumnWidthsPct ? (
                        <ModalTablaColGroup widthsPct={tableColumnWidthsPct} />
                      ) : null}
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-0">
                          {showSelectColumn ? renderSelectHeadCell() : null}
                          {columns.map((col) => (
                            <TableHead
                              key={col.key}
                              className={cn(
                                modalTablaHeadCellVariants({ kind: "data" }),
                                col.className
                              )}
                            >
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto border-b border-border">
                    <Table variant="compact" className="table-fixed w-full">
                      {tableColumnWidthsPct ? (
                        <ModalTablaColGroup widthsPct={tableColumnWidthsPct} />
                      ) : null}
                      <TableBody>
                        {rows.map((row) => {
                          const id = getRowId(row);
                          const isSelected = selectedIds.has(id);
                          const rowHasQuantity = isMultiQuantity && hasValidQuantity(id);
                          return (
                            <TableRow
                              key={id}
                              onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
                              onClick={
                                isSingleConfirm
                                  ? () => selectSingle(id)
                                  : onRowClick
                                    ? () => onRowClick(row)
                                    : undefined
                              }
                              className={cn(
                                modalTablaRowVariants({
                                  interaction:
                                    isMulti || isMultiQuantity ? "none" : "single",
                                  selected:
                                    isMulti || isSingleConfirm
                                      ? isSelected
                                      : isMultiQuantity
                                        ? rowHasQuantity
                                        : false,
                                })
                              )}
                              title={
                                isSingleConfirm
                                  ? "Clic en la fila para seleccionar"
                                  : onRowClick
                                    ? "Clic para agregar"
                                    : onRowDoubleClick
                                      ? "Doble Clic Para Seleccionar"
                                      : undefined
                              }
                            >
                              {showSelectColumn ? (
                                <TableCell className={selectBodyClass}>
                                  {isMultiQuantity ? (
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      inputMode="numeric"
                                      value={cantPorRowId[id] ?? ""}
                                      onChange={(e) => setRowQuantity(id, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-full w-full min-h-0 rounded-none border-0 px-1 text-center text-xs tabular-nums shadow-none focus-visible:border-0 focus-visible:ring-0"
                                      placeholder="0"
                                      aria-label={`Cantidad para fila ${id}`}
                                    />
                                  ) : isMulti ? (
                                    <label className="flex items-center justify-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.has(id)}
                                        onChange={() => toggleSelect(id)}
                                        className="rounded border-input"
                                        aria-label="Seleccionar"
                                      />
                                    </label>
                                  ) : (
                                    <label
                                      className="flex items-center justify-center cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.has(id)}
                                        onChange={() => selectSingle(id)}
                                        className="rounded border-input"
                                        aria-label="Seleccionar"
                                      />
                                    </label>
                                  )}
                                </TableCell>
                              ) : null}
                              {columns.map((col) => (
                                <TableCell
                                  key={col.key}
                                  className={cn(modalTablaBodyCellVariants({ kind: "data" }), col.className)}
                                >
                                  {col.render(row)}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-app__footer shrink-0 justify-between">
            <p className="text-sm text-muted-foreground tabular-nums">
              {count !== undefined && (
                <>
                  <strong className="text-primary font-semibold">{count.toLocaleString()}</strong>
                  {" RESULTADO(S)"}
                </>
              )}
            </p>
            {footerRight}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
