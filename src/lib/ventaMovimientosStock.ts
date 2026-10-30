import { evaluarCoberturaStock } from "@/lib/facturaStockCobertura";
import { normalizarCodColor } from "@/lib/codColorTintometrico";
import { sucursalPorDefectoSchema } from "@/lib/validations/globalPersonal";
import type { SucursalTransf } from "@/lib/transfDepositosTypes";
import type { ProductoFacturaStockSucursal } from "@/services/facturaProductos.service";

/**
 * Proveedor al que se puede dirigir la compra de un ítem.
 * - `lista`: vínculo habilitado de `proveedores_prod_lista` → PEDIDO URGENTE (`id` = `cod_ext`).
 * - `tintometrico`: ítem rubro Tintométrico → proveedor con COEF. TINTOMÉTRICO > 1 → pedido TINTOMETRICO
 *   (`id` = `proveedores.id`).
 */
export type ProveedorCompraVentaItem =
  | {
      tipo: "lista";
      id: string;
      proveedor: string;
      pxCompra: number;
      /** Es el CX elegido del ítem (`prod_lista.costo_compra_cod_ext`). */
      esCxElegido: boolean;
    }
  | {
      tipo: "tintometrico";
      id: string;
      /** `proveedores.nombre`. */
      proveedor: string;
    };

/** Parte de la cantidad de un ítem tintométrico con su COD. COLOR. */
export type ColorMovimientoVenta = {
  codColor: string;
  codColorIdMarca: string | null;
  cantidad: number;
};

export type ItemMovimientoVenta = {
  codTienda: string;
  descripcion: string;
  cantidad: number;
  /** Líneas con COD. COLOR (tintométricos): reparto de `cantidad` por color. Vacío en el resto. */
  colores: ColorMovimientoVenta[];
};

export type TransferenciaVentaItem = ItemMovimientoVenta & {
  /** Stock disponible (≥ 0) en la sucursal origen: tope de la cantidad a transferir. */
  stockOrigen: number;
};

/** Ítems a pedir a otra sucursal (origen de la transferencia; destino = sucursal de la venta). */
export type TransferenciaVentaGrupo = {
  origenCodigo: SucursalTransf;
  origenNombre: string;
  items: TransferenciaVentaItem[];
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

function claveColor(c: { codColor: string; codColorIdMarca: string | null }): string {
  return `${c.codColor}|${c.codColorIdMarca ?? ""}`;
}

/** Suma colores iguales (mismo COD. COLOR y marca). */
export function sumarColoresMovimiento(
  a: readonly ColorMovimientoVenta[],
  b: readonly ColorMovimientoVenta[]
): ColorMovimientoVenta[] {
  const porClave = new Map<string, ColorMovimientoVenta>();
  for (const c of [...a, ...b]) {
    const previo = porClave.get(claveColor(c));
    if (previo) previo.cantidad = unDecimal(previo.cantidad + c.cantidad);
    else porClave.set(claveColor(c), { ...c });
  }
  return [...porClave.values()];
}

type ParteLinea = { codColor: string | null; codColorIdMarca: string | null; cantidad: number };

/** Reparte la cantidad del ítem entre fuentes (stock propio → sucursales → compra) en orden de línea. */
function crearRepartidorColores(partes: readonly ParteLinea[]): (cant: number) => ColorMovimientoVenta[] {
  const cola = partes.map((p) => ({ ...p }));
  return (cant) => {
    let tomados: ColorMovimientoVenta[] = [];
    let resto = unDecimal(cant);
    while (resto > 0 && cola.length > 0) {
      const p = cola[0]!;
      const t = unDecimal(Math.min(resto, p.cantidad));
      if (t > 0 && p.codColor) {
        tomados = sumarColoresMovimiento(tomados, [
          { codColor: p.codColor, codColorIdMarca: p.codColorIdMarca, cantidad: t },
        ]);
      }
      p.cantidad = unDecimal(p.cantidad - t);
      resto = unDecimal(resto - t);
      if (p.cantidad <= 0 || t <= 0) cola.shift();
    }
    return tomados;
  };
}

/**
 * Misma regla que la sección **MOVIMIENTOS** de `FacturaProductoStockModal` (`evaluarCoberturaStock`),
 * con las líneas agrupadas por `cod_tienda`. Debe calcularse con el stock **previo** a emitir la venta.
 * Un aporte desde una sucursal que no admite transferencias pasa a COMPRAS.
 */
export function armarPlanMovimientosVenta(params: {
  lineas: readonly {
    codTienda: string;
    descripcion: string;
    cantidad: number;
    codColor?: string | null;
    codColorIdMarca?: string | null;
  }[];
  sucursalCodigo: string | null;
  stockPorCod: Readonly<Record<string, readonly ProductoFacturaStockSucursal[]>>;
}): PlanMovimientosVenta {
  const destino = sucursalPorDefectoSchema.safeParse(params.sucursalCodigo);
  if (!destino.success) return { transferencias: [], compras: [] };

  const porCod = new Map<string, { item: ItemMovimientoVenta; partes: ParteLinea[] }>();
  for (const l of params.lineas) {
    const cod = l.codTienda.trim();
    if (!cod || !(l.cantidad > 0)) continue;
    const parte: ParteLinea = {
      codColor: normalizarCodColor(l.codColor),
      codColorIdMarca: l.codColorIdMarca?.trim() || null,
      cantidad: unDecimal(l.cantidad),
    };
    const previo = porCod.get(cod);
    if (previo) {
      previo.item.cantidad = unDecimal(previo.item.cantidad + parte.cantidad);
      previo.partes.push(parte);
    } else {
      porCod.set(cod, {
        item: { codTienda: cod, descripcion: l.descripcion.trim(), cantidad: parte.cantidad, colores: [] },
        partes: [parte],
      });
    }
  }

  const grupos = new Map<SucursalTransf, TransferenciaVentaGrupo>();
  const compras: ItemMovimientoVenta[] = [];
  for (const { item, partes } of porCod.values()) {
    const filas = params.stockPorCod[item.codTienda];
    if (!filas) continue;
    const cobertura = evaluarCoberturaStock({
      cantidad: item.cantidad,
      sucursalCodigo: destino.data,
      stockPorSucursal: filas,
    });
    if (cobertura.estado === "sucursal_activa") continue;

    const tomarColores = crearRepartidorColores(partes);
    tomarColores(item.cantidad - cobertura.faltanteActiva);

    let aComprar = cobertura.faltanteTotal;
    let coloresCompra: ColorMovimientoVenta[] = [];
    for (const aporte of cobertura.aportes) {
      const colores = tomarColores(aporte.aTraer);
      const origen = sucursalPorDefectoSchema.safeParse(aporte.codigo.trim().toLowerCase());
      if (!origen.success || origen.data === destino.data) {
        aComprar = unDecimal(aComprar + aporte.aTraer);
        coloresCompra = sumarColoresMovimiento(coloresCompra, colores);
        continue;
      }
      const grupo = grupos.get(origen.data) ?? {
        origenCodigo: origen.data,
        origenNombre: aporte.nombre,
        items: [],
      };
      grupo.items.push({
        ...item,
        cantidad: aporte.aTraer,
        colores,
        stockOrigen: Math.max(0, unDecimal(aporte.stock)),
      });
      grupos.set(origen.data, grupo);
    }
    coloresCompra = sumarColoresMovimiento(coloresCompra, tomarColores(cobertura.faltanteTotal));
    if (aComprar > 0) compras.push({ ...item, cantidad: aComprar, colores: coloresCompra });
  }

  return { transferencias: [...grupos.values()], compras };
}
