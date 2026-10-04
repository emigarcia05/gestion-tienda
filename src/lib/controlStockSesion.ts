import {
  formatCantidadInputValor,
  fmtCantidad,
  parseCantidadUnDecimal,
  redondearCantidadUnDecimal,
} from "@/lib/cantidadUnDecimal";

export type ItemStockControlMeta = { codItem: string; stock: number };

export function formatStockInputValor(stock: number): string {
  return formatCantidadInputValor(stock);
}

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

export function itemControladoEnSesion(
  id: string,
  stocksEditados: Record<string, string>,
  meta: ItemStockControlMeta | undefined,
  confirmado: boolean
): boolean {
  if (!meta) return false;
  if (confirmado) return true;
  return !!getVariacionStock(meta.stock, stocksEditados[id]);
}
