import {
  formatCantidadInputValor,
  fmtCantidad,
  parseCantidadUnDecimal,
  redondearCantidadUnDecimal,
} from "@/lib/cantidadUnDecimal";

export function formatStockInputValor(stock: number): string {
  return formatCantidadInputValor(stock);
}

export type AjusteControlStockLinea = {
  codItem: string;
  cantidad: number;
  tipoMovimiento: "INGRESO" | "EGRESO";
};

export type StockControlBase = { codItem: string; stock: number };

export function getVariacionStock(
  stockOriginal: number,
  stockEditadoRaw: string | undefined
): { deltaAbs: string; sube: boolean } | null {
  if (stockEditadoRaw === undefined || stockEditadoRaw === "") return null;
  const stockEditado = parseCantidadUnDecimal(stockEditadoRaw, { min: 0 });
  if (stockEditado == null) return null;
  const delta = redondearCantidadUnDecimal(stockEditado - stockOriginal);
  if (delta === 0) return null;
  return {
    deltaAbs: fmtCantidad(Math.abs(delta)),
    sube: delta > 0,
  };
}

/** Líneas de ajuste: diferencia entre el valor editado y el saldo base. */
export function lineasAjusteDesdeEdicion(
  stocksEditados: Record<string, string>,
  bases: Record<string, StockControlBase>
): AjusteControlStockLinea[] {
  const lineas: AjusteControlStockLinea[] = [];
  for (const [id, raw] of Object.entries(stocksEditados)) {
    const base = bases[id];
    if (!base) continue;
    const stockEditado = parseCantidadUnDecimal(raw, { min: 0 });
    if (stockEditado == null) continue;
    const delta = redondearCantidadUnDecimal(stockEditado - base.stock);
    if (delta === 0) continue;
    lineas.push({
      codItem: base.codItem,
      cantidad: Math.abs(delta),
      tipoMovimiento: delta > 0 ? "INGRESO" : "EGRESO",
    });
  }
  return lineas;
}
