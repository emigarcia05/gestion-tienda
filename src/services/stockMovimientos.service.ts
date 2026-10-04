import type {
  StockComprobanteTipo,
  StockMovimientoCategoria,
  StockMovimientoTipo,
} from "@prisma/client";
import { cantidadDesdePrisma, redondearCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export type LineaStockMovimientoInput = {
  tipoMovimiento: StockMovimientoTipo;
  categoriaMovimiento: StockMovimientoCategoria;
  codItem: string;
  sucursalId: string;
  cantidad: number;
};

export type RegistrarStockMovimientosInput = {
  comprobanteTipo: StockComprobanteTipo;
  sucursalId: string;
  sucursalDestinoId?: string;
  lineas: LineaStockMovimientoInput[];
};

export type RegistrarStockMovimientosResult = {
  comprobanteId: string;
  movimientos: number;
};

const CATEGORIA_POR_COMPROBANTE: Record<
  StockComprobanteTipo,
  ReadonlySet<StockMovimientoCategoria>
> = {
  VENTA: new Set(["VENTA"]),
  NOTA_CREDITO: new Set(["NOTA_CREDITO"]),
  COMPRA: new Set(["COMPRA"]),
  AJUSTE_STOCK: new Set(["AJUSTE_STOCK"]),
  TRANSFERENCIA_ENTRE_DEPOSITOS: new Set([
    "TRANSF_DEPO_INGRESO",
    "TRANSF_DEPO_EGRESO",
  ]),
};

const TIPO_FIJO_POR_CATEGORIA: Partial<
  Record<StockMovimientoCategoria, StockMovimientoTipo>
> = {
  VENTA: "EGRESO",
  NOTA_CREDITO: "INGRESO",
  COMPRA: "INGRESO",
  TRANSF_DEPO_INGRESO: "INGRESO",
  TRANSF_DEPO_EGRESO: "EGRESO",
};

export function claveSaldoStock(codItem: string, sucursalId: string): string {
  return `${codItem.trim()}\0${sucursalId}`;
}

export async function obtenerSucursalIdPorCodigo(
  codigo: string
): Promise<string | null> {
  const row = await prisma.sucursal.findUnique({
    where: { codigo: codigo.trim().toLowerCase() },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Crea el comprobante justificante y las líneas del ledger.
 * `cantidad` positiva; el signo lo da `tipoMovimiento`.
 */
export async function registrarStockMovimientos(
  input: RegistrarStockMovimientosInput
): Promise<ServiceResult<RegistrarStockMovimientosResult>> {
  try {
    if (input.lineas.length === 0) {
      return { success: false, error: "No hay líneas de stock." };
    }
    const categoriasOk = CATEGORIA_POR_COMPROBANTE[input.comprobanteTipo];
    for (const linea of input.lineas) {
      if (!categoriasOk.has(linea.categoriaMovimiento)) {
        return {
          success: false,
          error: "La categoría no corresponde al tipo de comprobante.",
        };
      }
      const tipoFijo = TIPO_FIJO_POR_CATEGORIA[linea.categoriaMovimiento];
      if (tipoFijo && linea.tipoMovimiento !== tipoFijo) {
        return {
          success: false,
          error: "El tipo de movimiento no corresponde a la categoría.",
        };
      }
      const cant = redondearCantidadUnDecimal(linea.cantidad);
      if (cant <= 0) {
        return { success: false, error: "La cantidad debe ser mayor a 0." };
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const comprobante = await tx.stockComprobante.create({
        data: {
          tipo: input.comprobanteTipo,
          sucursalId: input.sucursalId,
          sucursalDestinoId: input.sucursalDestinoId ?? null,
        },
        select: { id: true },
      });
      await tx.stockMovimiento.createMany({
        data: input.lineas.map((l) => ({
          tipoMovimiento: l.tipoMovimiento,
          categoriaMovimiento: l.categoriaMovimiento,
          codItem: l.codItem.trim(),
          sucursalId: l.sucursalId,
          cantidad: redondearCantidadUnDecimal(l.cantidad),
          comprobanteRelacionadoId: comprobante.id,
        })),
      });
      return comprobante.id;
    });

    return {
      success: true,
      data: { comprobanteId: created, movimientos: input.lineas.length },
    };
  } catch (e) {
    console.error("[registrarStockMovimientos]", e);
    return { success: false, error: "Error al registrar movimientos de stock." };
  }
}

/** Saldo = ingresos − egresos de `cod_item` en la sucursal. */
export async function saldoStockItemSucursal(
  codItem: string,
  sucursalId: string
): Promise<number> {
  const map = await buildMapSaldoStockPorSucursal([codItem], sucursalId);
  return map.get(codItem.trim()) ?? 0;
}

/** Mapa `cod_item` → saldo (0 si no hay movimientos). */
export async function buildMapSaldoStockPorSucursal(
  codItems: string[],
  sucursalId: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unicos = [...new Set(codItems.map((c) => c.trim()).filter(Boolean))];
  for (const c of unicos) map.set(c, 0);
  if (unicos.length === 0) return map;

  const rows = await prisma.stockMovimiento.groupBy({
    by: ["codItem", "tipoMovimiento"],
    where: { sucursalId, codItem: { in: unicos } },
    _sum: { cantidad: true },
  });
  for (const r of rows) {
    const prev = map.get(r.codItem) ?? 0;
    const cant = cantidadDesdePrisma(r._sum.cantidad);
    map.set(
      r.codItem,
      r.tipoMovimiento === "INGRESO" ? prev + cant : prev - cant
    );
  }
  return map;
}

/** Mapa `${codItem}\\0${sucursalId}` → saldo. */
export async function buildMapSaldoStockItemsSucursales(
  codItems: string[],
  sucursalIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const items = [...new Set(codItems.map((c) => c.trim()).filter(Boolean))];
  const sucursales = [...new Set(sucursalIds.filter(Boolean))];
  for (const item of items) {
    for (const suc of sucursales) {
      map.set(claveSaldoStock(item, suc), 0);
    }
  }
  if (items.length === 0 || sucursales.length === 0) return map;

  const rows = await prisma.stockMovimiento.groupBy({
    by: ["codItem", "sucursalId", "tipoMovimiento"],
    where: { sucursalId: { in: sucursales }, codItem: { in: items } },
    _sum: { cantidad: true },
  });
  for (const r of rows) {
    const key = claveSaldoStock(r.codItem, r.sucursalId);
    const prev = map.get(key) ?? 0;
    const cant = cantidadDesdePrisma(r._sum.cantidad);
    map.set(
      key,
      r.tipoMovimiento === "INGRESO" ? prev + cant : prev - cant
    );
  }
  return map;
}
