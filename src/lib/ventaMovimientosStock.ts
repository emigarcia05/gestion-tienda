import { evaluarCoberturaStock } from "@/lib/facturaStockCobertura";
import { sucursalPorDefectoSchema } from "@/lib/validations/globalPersonal";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import type { ProductoFacturaStockSucursal } from "@/services/facturaProductos.service";

/** Proveedor al que se puede dirigir la compra de un ítem (vínculo habilitado). */
export type ProveedorCompraVentaItem = {
  codExt: string;
  proveedor: string;
  pxCompra: number;
  /** Es el CX elegido del ítem (`prod_lista.costo_compra_cod_ext`). */
  esCxElegido: boolean;
};

export type ItemMovimientoVenta = {
  codTienda: string;
  descripcion: string;
  cantidad: number;
};

/** Ítems a pedir a otra sucursal (origen de la transferencia; destino = sucursal de la venta). */
export type TransferenciaVentaGrupo = {
  origenCodigo: SucursalTransf;
  origenNombre: string;
  items: ItemMovimientoVenta[];
};

export type PlanMovimientosVenta = {
  transferencias: TransferenciaVentaGrupo[];
  compras: ItemMovimientoVenta[];
};

export function planMovimientosVentaVacio(plan: PlanMovimientosVenta | null): boolean {
  return plan == null || (plan.transferencias.length === 0 && plan.compras.length === 0);
}

function unDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Misma regla que la sección **MOVIMIENTOS** de `FacturaProductoStockModal` (`evaluarCoberturaStock`),
 * con las líneas agrupadas por `cod_tienda`. Debe calcularse con el stock **previo** a emitir la venta.
 * Un aporte desde una sucursal que no admite transferencias pasa a COMPRAS.
 */
export function armarPlanMovimientosVenta(params: {
  lineas: readonly { codTienda: string; descripcion: string; cantidad: number }[];
  sucursalCodigo: string | null;
  stockPorCod: Readonly<Record<string, readonly ProductoFacturaStockSucursal[]>>;
}): PlanMovimientosVenta {
  const destino = sucursalPorDefectoSchema.safeParse(params.sucursalCodigo);
  if (!destino.success) return { transferencias: [], compras: [] };

  const porCod = new Map<string, ItemMovimientoVenta>();
  for (const l of params.lineas) {
    const cod = l.codTienda.trim();
    if (!cod || !(l.cantidad > 0)) continue;
    const previo = porCod.get(cod);
    if (previo) previo.cantidad = unDecimal(previo.cantidad + l.cantidad);
    else porCod.set(cod, { codTienda: cod, descripcion: l.descripcion.trim(), cantidad: unDecimal(l.cantidad) });
  }

  const grupos = new Map<SucursalTransf, TransferenciaVentaGrupo>();
  const compras: ItemMovimientoVenta[] = [];
  for (const item of porCod.values()) {
    const filas = params.stockPorCod[item.codTienda];
    if (!filas) continue;
    const cobertura = evaluarCoberturaStock({
      cantidad: item.cantidad,
      sucursalCodigo: destino.data,
      stockPorSucursal: filas,
    });
    if (cobertura.estado === "sucursal_activa") continue;

    let aComprar = cobertura.faltanteTotal;
    for (const aporte of cobertura.aportes) {
      const origen = sucursalPorDefectoSchema.safeParse(aporte.codigo.trim().toLowerCase());
      if (!origen.success || origen.data === destino.data) {
        aComprar = unDecimal(aComprar + aporte.aTraer);
        continue;
      }
      const grupo = grupos.get(origen.data) ?? {
        origenCodigo: origen.data,
        origenNombre: aporte.nombre,
        items: [],
      };
      grupo.items.push({ ...item, cantidad: aporte.aTraer });
      grupos.set(origen.data, grupo);
    }
    if (aComprar > 0) compras.push({ ...item, cantidad: aComprar });
  }

  return { transferencias: [...grupos.values()], compras };
}
