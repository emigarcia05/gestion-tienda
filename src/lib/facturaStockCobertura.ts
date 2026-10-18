import type { ProductoFacturaStockSucursal } from "@/services/facturaProductos.service";

/** Azul: alcanza en la sucursal activa. Amarillo: alcanza sumando sucursales. Rojo: no alcanza. */
export type EstadoCoberturaStock = "sucursal_activa" | "otras_sucursales" | "insuficiente";

export type AporteStockSucursal = {
  codigo: string;
  nombre: string;
  stock: number;
  /** Unidades a traer desde esta sucursal para cubrir el faltante de la activa. */
  aTraer: number;
};

export type CoberturaStock = {
  estado: EstadoCoberturaStock;
  cantidad: number;
  stockActiva: number;
  nombreActiva: string | null;
  /** Suma de saldos positivos (un saldo negativo no resta stock de otra sucursal). */
  totalDisponible: number;
  faltanteActiva: number;
  /** Lo que sigue faltando después de usar todas las sucursales. */
  faltanteTotal: number;
  aportes: AporteStockSucursal[];
};

function unDecimal(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function disponible(n: number): number {
  const x = unDecimal(n);
  return x > 0 ? x : 0;
}

function mismoCodigo(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Compara la cantidad de la línea con el stock por sucursal.
 * La sucursal activa es la del usuario de pestaña.
 */
export function evaluarCoberturaStock(params: {
  cantidad: number;
  sucursalCodigo: string | null;
  stockPorSucursal: readonly ProductoFacturaStockSucursal[];
}): CoberturaStock {
  const cantidad = Math.max(0, unDecimal(params.cantidad));
  const filas = params.stockPorSucursal;
  const activa =
    params.sucursalCodigo != null
      ? (filas.find((f) => mismoCodigo(f.codigo, params.sucursalCodigo ?? "")) ?? null)
      : null;
  const stockActiva = activa ? disponible(activa.stock) : 0;
  const totalDisponible = unDecimal(filas.reduce((acc, f) => acc + disponible(f.stock), 0));
  const faltanteActiva = unDecimal(Math.max(0, cantidad - stockActiva));
  const faltanteTotal = unDecimal(Math.max(0, cantidad - totalDisponible));

  const otras = filas
    .filter((f) => activa == null || !mismoCodigo(f.codigo, activa.codigo))
    .filter((f) => disponible(f.stock) > 0)
    .sort((a, b) => disponible(b.stock) - disponible(a.stock) || a.nombre.localeCompare(b.nombre, "es"));

  let restante = faltanteActiva;
  const aportes: AporteStockSucursal[] = [];
  for (const fila of otras) {
    if (restante <= 0) break;
    const puede = disponible(fila.stock);
    const aTraer = unDecimal(Math.min(puede, restante));
    if (aTraer <= 0) continue;
    aportes.push({
      codigo: fila.codigo,
      nombre: fila.nombre,
      stock: fila.stock,
      aTraer,
    });
    restante = unDecimal(restante - aTraer);
  }

  const estado: EstadoCoberturaStock =
    faltanteActiva <= 0 ? "sucursal_activa" : faltanteTotal <= 0 ? "otras_sucursales" : "insuficiente";

  return {
    estado,
    cantidad,
    stockActiva,
    nombreActiva: activa?.nombre ?? null,
    totalDisponible,
    faltanteActiva,
    faltanteTotal,
    aportes,
  };
}
