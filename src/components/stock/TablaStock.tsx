"use client";

import { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
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
import type { ControlStockData, Sucursal } from "@/actions/stock";
import PrintStock from "./PrintStock";
import {
  TableEmptyState,
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { esBorradorCantidadUnDecimal, parseCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import {
  formatStockInputValor,
  getVariacionStock,
  itemControladoEnSesion,
  type ItemStockControlMeta,
} from "@/lib/controlStockSesion";

function fmtFecha(d: Date | string | null): string {
  if (!d) return "";
  return formatDdMmHhMmArgentina(new Date(d));
}

export interface TablaStockHandle {
  openPrint: () => void;
}

interface Props {
  data: ControlStockData;
  sucursalActual: Sucursal | null;
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  soloNegativoActual: boolean;
  onFiltradosCountChange?: (count: number) => void;
}

const SUCURSALES: { value: Sucursal; label: string }[] = [
  { value: "guaymallen", label: "GUAYMALLÉN" },
  { value: "maipu", label: "MAIPÚ" },
];

const TablaStock = forwardRef<TablaStockHandle, Props>(function TablaStock(
  {
    data,
    sucursalActual,
    qActual: _qActual,
    marcaActual: _marcaActual,
    rubroActual: _rubroActual,
    soloNegativoActual: _soloNegativoActual,
    onFiltradosCountChange,
  },
  ref
) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const [ultimosControles, setUltimosControles] = useState<Record<string, Date>>(() => {
    const m: Record<string, Date> = {};
    for (const i of data.items)
      if (i.ultimaExportacionExcel) m[i.id] = new Date(i.ultimaExportacionExcel);
    return m;
  });
  const [confirmadosSesion, setConfirmadosSesion] = useState<Record<string, boolean>>({});
  const [stocksEditados, setStocksEditados] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const i of data.items) {
      m[i.id] = formatStockInputValor(i.stock);
    }
    return m;
  });

  const idsKey = data.items.map((i) => i.id).join("|");

  useEffect(() => {
    if (data.items.length === 0) return;
    queueMicrotask(() => {
      setStocksEditados((prev) => {
        let hasNew = false;
        const next = { ...prev };
        for (const i of data.items) {
          if (next[i.id] === undefined) {
            hasNew = true;
            next[i.id] = formatStockInputValor(i.stock);
          }
        }
        return hasNew ? next : prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `idsKey` acota cambios al conjunto de filas
  }, [idsKey]);

  useEffect(() => {
    if (data.items.length === 0) return;
    queueMicrotask(() => {
      setUltimosControles((prev) => {
        let hasNew = false;
        const next = { ...prev };
        for (const i of data.items) {
          if (i.ultimaExportacionExcel && next[i.id] === undefined) {
            hasNew = true;
            next[i.id] = new Date(i.ultimaExportacionExcel);
          }
        }
        return hasNew ? next : prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `idsKey` acota cambios al conjunto de filas
  }, [idsKey]);

  function quitarConfirmacion(id: string) {
    setConfirmadosSesion((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleCambioStock(id: string, value: string) {
    if (!esBorradorCantidadUnDecimal(value)) return;
    setStocksEditados((prev) => ({ ...prev, [id]: value }));
    const meta = itemMetaRef.current[id];
    if (meta && getVariacionStock(meta.stock, value)) {
      quitarConfirmacion(id);
    }
  }

  function ajustarStockUnidad(id: string, stockBase: number, delta: -1 | 1) {
    const raw = stocksEditadosRef.current[id];
    const parsed =
      raw !== undefined && raw !== ""
        ? parseCantidadUnDecimal(raw, { min: 0 })
        : stockBase;
    const base = parsed ?? stockBase;
    const next = Math.max(0, base + delta);
    const valor = formatStockInputValor(next);
    setStocksEditados((prev) => ({ ...prev, [id]: valor }));
    const meta = itemMetaRef.current[id];
    if (meta && getVariacionStock(meta.stock, valor)) {
      quitarConfirmacion(id);
    }
  }

  function toggleConfirmacionControl(id: string, stockOriginal: number) {
    if (confirmadosSesionRef.current[id]) {
      quitarConfirmacion(id);
      return;
    }
    setStocksEditados((s) => ({ ...s, [id]: formatStockInputValor(stockOriginal) }));
    setConfirmadosSesion((prev) => ({ ...prev, [id]: true }));
  }

  const items = data.items;

  useEffect(() => {
    if (onFiltradosCountChange) onFiltradosCountChange(items.length);
  }, [items.length, onFiltradosCountChange]);

  const handleImprimir = useCallback(async () => {
    setImprimiendo(true);
  }, []);

  const handleImprimirRef = useRef(handleImprimir);
  useEffect(() => {
    handleImprimirRef.current = handleImprimir;
  }, [handleImprimir]);

  const stocksEditadosRef = useRef(stocksEditados);
  useEffect(() => {
    stocksEditadosRef.current = stocksEditados;
  }, [stocksEditados]);

  const confirmadosSesionRef = useRef(confirmadosSesion);
  useEffect(() => {
    confirmadosSesionRef.current = confirmadosSesion;
  }, [confirmadosSesion]);

  const itemMetaRef = useRef<Record<string, ItemStockControlMeta>>({});
  useEffect(() => {
    for (const i of data.items) {
      itemMetaRef.current[i.id] = { codItem: i.codItem, stock: i.stock };
    }
  }, [idsKey, data.items]);

  useImperativeHandle(ref, () => ({
    openPrint: () => handleImprimirRef.current(),
  }));

  const sucursalSeleccionada = sucursalActual !== null;
  const sucursalLabel = sucursalActual
    ? SUCURSALES.find((s) => s.value === sucursalActual)?.label ?? sucursalActual
    : "";

  return (
    <>
      <div className="contenedor-tabla-gestion no-scroll-x">
        {!sucursalSeleccionada ? (
          <TableEmptyState
            placement="blockedPanel"
            textSize="sm"
            maxWidth="full"
            message="Seleccioná una sucursal para ver el stock."
          />
        ) : (
          <Table variant="compact">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40%]">DESCRIPCIÓN</TableHead>
                <TableHead className="w-[30%]">STOCK</TableHead>
                <TableHead className="w-[15%]">VARIACIÓN</TableHead>
                <TableHead className="w-[15%]">ÚLT. CONTROL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className={cn(
                      tableEmptyStateContainerVariants({
                        placement: "tableCellTall",
                        textSize: "xs",
                      })
                    )}
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
              {items.map((item) => {
                const meta = itemMetaRef.current[item.id];
                const confirmado = !!confirmadosSesion[item.id];
                const controladoSesion = itemControladoEnSesion(
                  item.id,
                  stocksEditados,
                  meta,
                  confirmado
                );
                const fechaPersistida =
                  ultimosControles[item.id] ?? item.ultimaExportacionExcel;
                const tieneVariacion = Boolean(
                  getVariacionStock(item.stock, stocksEditados[item.id])
                );

                return (
                  <TableRow key={item.id}>
                    <TableCell className="celda-datos w-[40%] min-w-0 overflow-hidden">
                      {item.descripcion}
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums w-[30%]">
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Disminuir stock"
                          onClick={() => ajustarStockUnidad(item.id, item.stock, -1)}
                        >
                          -
                        </Button>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={stocksEditados[item.id] ?? ""}
                          onChange={(e) => handleCambioStock(item.id, e.target.value)}
                          className="h-6 w-14 self-center text-center text-sm font-normal"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Aumentar stock"
                          onClick={() => ajustarStockUnidad(item.id, item.stock, 1)}
                        >
                          +
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={tieneVariacion}
                          className={cn(
                            TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
                            confirmado && "ring-2 ring-primary ring-offset-1"
                          )}
                          aria-label={
                            confirmado
                              ? "Quitar confirmación de control"
                              : tieneVariacion
                                ? "No se puede confirmar: hay variación de stock"
                                : "Confirmar control sin variación"
                          }
                          aria-pressed={confirmado}
                          title={
                            tieneVariacion
                              ? "Igualá el valor al stock original para confirmar sin variación"
                              : undefined
                          }
                          onClick={() => toggleConfirmacionControl(item.id, item.stock)}
                        >
                          <Check className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums w-[15%]">
                      {(() => {
                        if (confirmado) {
                          return (
                            <span className="flex justify-center text-foreground tabular-nums">
                              0
                            </span>
                          );
                        }
                        const variacion = getVariacionStock(
                          item.stock,
                          stocksEditados[item.id]
                        );
                        if (!variacion) return "";
                        return (
                          <div className="flex items-center justify-center gap-1">
                            {variacion.sube ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
                            )}
                            <span className="text-foreground">{variacion.deltaAbs}</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums w-[15%]">
                      {fechaPersistida ? (
                        fmtFecha(fechaPersistida)
                      ) : controladoSesion ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
                          Pendiente
                        </span>
                      ) : (
                        ""
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {imprimiendo && (
        <PrintStock
          items={items}
          sucursal={sucursalLabel}
          onClose={() => setImprimiendo(false)}
        />
      )}
    </>
  );
});

export default TablaStock;
