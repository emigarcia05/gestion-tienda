"use client";

import { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { esBorradorCantidadUnDecimal, parseCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import {
  formatStockInputValor,
  getVariacionStock,
  lineasAjusteDesdeEdicion,
  type AjusteControlStockLinea,
  type StockControlBase,
} from "@/lib/controlStockSesion";

export interface TablaStockHandle {
  openPrint: () => void;
  getAjustesPendientes: () => AjusteControlStockLinea[];
  marcarAjustesConfirmados: () => void;
}

interface Props {
  data: ControlStockData;
  sucursalActual: Sucursal | null;
  sucursalLabel: string;
  qActual: string;
  marcaActual: string;
  rubroActual: string;
  soloNegativoActual: boolean;
}

const TablaStock = forwardRef<TablaStockHandle, Props>(function TablaStock(
  {
    data,
    sucursalActual,
    sucursalLabel,
    qActual: _qActual,
    marcaActual: _marcaActual,
    rubroActual: _rubroActual,
    soloNegativoActual: _soloNegativoActual,
  },
  ref
) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const [stocksEditados, setStocksEditados] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const i of data.items) {
      m[i.id] = formatStockInputValor(i.stock);
    }
    return m;
  });
  const stocksEditadosRef = useRef(stocksEditados);
  useEffect(() => {
    stocksEditadosRef.current = stocksEditados;
  }, [stocksEditados]);

  const stockBaseRef = useRef<Record<string, StockControlBase>>((() => {
    const m: Record<string, StockControlBase> = {};
    for (const i of data.items) {
      m[i.id] = { codItem: i.codItem, stock: i.stock };
    }
    return m;
  })());
  const idsKey = data.items.map((i) => i.id).join("|");

  useEffect(() => {
    for (const item of data.items) {
      const prev = stockBaseRef.current[item.id];
      if (!prev) {
        stockBaseRef.current[item.id] = {
          codItem: item.codItem,
          stock: item.stock,
        };
        continue;
      }
      const sucio = getVariacionStock(
        prev.stock,
        stocksEditadosRef.current[item.id]
      );
      if (!sucio) {
        stockBaseRef.current[item.id] = {
          codItem: item.codItem,
          stock: item.stock,
        };
      }
    }
  }, [idsKey, data.items]);

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

  function handleCambioStock(id: string, value: string) {
    if (!esBorradorCantidadUnDecimal(value)) return;
    setStocksEditados((prev) => ({ ...prev, [id]: value }));
  }

  function ajustarStockUnidad(id: string, stockBase: number, delta: -1 | 1) {
    const raw = stocksEditadosRef.current[id];
    const parsed =
      raw !== undefined && raw !== ""
        ? parseCantidadUnDecimal(raw, { min: 0 })
        : stockBase;
    const base = parsed ?? stockBase;
    const next = Math.max(0, base + delta);
    setStocksEditados((prev) => ({ ...prev, [id]: formatStockInputValor(next) }));
  }

  const items = data.items;

  const handleImprimir = useCallback(async () => {
    setImprimiendo(true);
  }, []);

  const handleImprimirRef = useRef(handleImprimir);
  useEffect(() => {
    handleImprimirRef.current = handleImprimir;
  }, [handleImprimir]);

  useImperativeHandle(ref, () => ({
    openPrint: () => handleImprimirRef.current(),
    getAjustesPendientes: () =>
      lineasAjusteDesdeEdicion(stocksEditadosRef.current, stockBaseRef.current),
    marcarAjustesConfirmados: () => {
      for (const [id, raw] of Object.entries(stocksEditadosRef.current)) {
        const base = stockBaseRef.current[id];
        const parsed = parseCantidadUnDecimal(raw, { min: 0 });
        if (!base || parsed == null) continue;
        stockBaseRef.current[id] = { ...base, stock: parsed };
      }
    },
  }));

  const sucursalSeleccionada = sucursalActual !== null;

  return (
    <>
      <div className="contenedor-tabla-gestion no-scroll-x">
        {!sucursalSeleccionada ? (
          <TableEmptyState
            placement="blockedPanel"
            textSize="sm"
            maxWidth="full"
            message="Seleccioná un usuario en el slidenav para ver el stock de su sucursal."
          />
        ) : (
          <Table variant="compact">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[55%]">DESCRIPCIÓN</TableHead>
                <TableHead className="w-[30%]">STOCK</TableHead>
                <TableHead className="w-[15%]">VARIACIÓN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
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
                const variacion = getVariacionStock(
                  item.stock,
                  stocksEditados[item.id]
                );
                return (
                  <TableRow key={item.id}>
                    <TableCell className="celda-datos w-[55%] min-w-0 overflow-hidden">
                      {item.descripcion}
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums w-[30%]">
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
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
                          aria-label="Disminuir stock"
                          onClick={() => ajustarStockUnidad(item.id, item.stock, -1)}
                        >
                          -
                        </Button>
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
                      </div>
                    </TableCell>
                    <TableCell className="celda-datos tabular-nums w-[15%]">
                      {variacion ? (
                        <div className="flex items-center justify-center gap-1">
                          {variacion.sube ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
                          )}
                          <span className="text-foreground">{variacion.deltaAbs}</span>
                        </div>
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
