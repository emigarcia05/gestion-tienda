import {
  type Prisma,
  type StockComprobanteTipo,
  type StockMovimientoCategoria,
  type StockMovimientoTipo,
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
  personalId?: number;
  comprobanteVtaId?: string;
  lineas: LineaStockMovimientoInput[];
};

export type StockMovimientoFila = {
  id: string;
  fechaIso: string;
  fechaMs: number;
  tipoMovimiento: StockMovimientoTipo;
  tipoEtiqueta: string;
  categoriaMovimiento: StockMovimientoCategoria;
  categoriaEtiqueta: string;
  usuarioNombre: string;
  /** Cliente (venta/NC), proveedor (compra) o par de sucursales (transf.). */
  contraparteNombre: string;
  item: string;
  cantidad: number;
  /** Header `stock_comprobantes.id`. */
  stockComprobanteId: string;
  stockComprobanteTipo: StockComprobanteTipo;
  /** Si hay venta/NC vinculada, abre el detalle de factura. */
  comprobanteVtaId: string | null;
};

const COMPROBANTE_TIPO_ETIQUETA: Record<StockComprobanteTipo, string> = {
  VENTA: "VENTA",
  NOTA_CREDITO: "NOTA DE CRÉDITO",
  COMPRA: "COMPRA",
  AJUSTE_STOCK: "AJUSTE STOCK",
  TRANSFERENCIA_ENTRE_DEPOSITOS: "TRANSFERENCIA ENTRE DEPÓSITOS",
};

export type StockComprobanteDetalleLinea = {
  id: string;
  tipoEtiqueta: string;
  categoriaEtiqueta: string;
  item: string;
  cantidad: number;
  sucursalCodigo: string;
};

export type StockComprobanteDetalle = {
  id: string;
  tipo: StockComprobanteTipo;
  tipoEtiqueta: string;
  fechaIso: string;
  fechaMs: number;
  usuarioNombre: string;
  sucursalOrigen: string;
  sucursalDestino: string;
  comprobanteVtaId: string | null;
  lineas: StockComprobanteDetalleLinea[];
};

const TIPO_ETIQUETA: Record<StockMovimientoTipo, string> = {
  INGRESO: "INGRESO",
  EGRESO: "EGRESO",
};

const CATEGORIA_ETIQUETA: Record<StockMovimientoCategoria, string> = {
  VENTA: "VENTA",
  NOTA_CREDITO: "NOTA DE CRÉDITO",
  AJUSTE_STOCK: "AJUSTE STOCK",
  TRANSF_INTERNA: "TRANS. INTERNA",
  COMPRA: "COMPRA",
};

const LISTADO_MOVIMIENTOS_MAX = 2000;

/** Ventas/NC anteriores no escriben ledger (sin backfill). */
const STOCK_VTA_DESDE = new Date("2026-10-04T00:00:00.000Z");

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
  TRANSFERENCIA_ENTRE_DEPOSITOS: new Set(["TRANSF_INTERNA"]),
};

const TIPO_FIJO_POR_CATEGORIA: Partial<
  Record<StockMovimientoCategoria, StockMovimientoTipo>
> = {
  VENTA: "EGRESO",
  NOTA_CREDITO: "INGRESO",
  COMPRA: "INGRESO",
  // TRANSF_INTERNA y AJUSTE_STOCK: ingreso o egreso según la línea
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

function validarLineasStock(
  input: RegistrarStockMovimientosInput
): ServiceResult<void> {
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
  return { success: true, data: undefined };
}

async function persistirStockMovimientosEn(
  db: Prisma.TransactionClient,
  input: RegistrarStockMovimientosInput
): Promise<ServiceResult<RegistrarStockMovimientosResult>> {
  const validado = validarLineasStock(input);
  if (!validado.success) return validado;
  const comprobante = await db.stockComprobante.create({
    data: {
      tipo: input.comprobanteTipo,
      sucursalId: input.sucursalId,
      sucursalDestinoId: input.sucursalDestinoId ?? null,
      personalId: input.personalId ?? null,
      comprobanteVtaId: input.comprobanteVtaId ?? null,
    },
    select: { id: true },
  });
  await db.stockMovimiento.createMany({
    data: input.lineas.map((l) => ({
      tipoMovimiento: l.tipoMovimiento,
      categoriaMovimiento: l.categoriaMovimiento,
      codItem: l.codItem.trim(),
      sucursalId: l.sucursalId,
      cantidad: redondearCantidadUnDecimal(l.cantidad),
      comprobanteRelacionadoId: comprobante.id,
      usuarioId: input.personalId ?? null,
    })),
  });
  return {
    success: true,
    data: { comprobanteId: comprobante.id, movimientos: input.lineas.length },
  };
}

async function persistirStockMovimientosStandalone(
  input: RegistrarStockMovimientosInput
): Promise<ServiceResult<RegistrarStockMovimientosResult>> {
  const validado = validarLineasStock(input);
  if (!validado.success) return validado;
  const comprobante = await prisma.stockComprobante.create({
    data: {
      tipo: input.comprobanteTipo,
      sucursalId: input.sucursalId,
      sucursalDestinoId: input.sucursalDestinoId ?? null,
      personalId: input.personalId ?? null,
      comprobanteVtaId: input.comprobanteVtaId ?? null,
      movimientos: {
        createMany: {
          data: input.lineas.map((l) => ({
            tipoMovimiento: l.tipoMovimiento,
            categoriaMovimiento: l.categoriaMovimiento,
            codItem: l.codItem.trim(),
            sucursalId: l.sucursalId,
            cantidad: redondearCantidadUnDecimal(l.cantidad),
            usuarioId: input.personalId ?? null,
          })),
        },
      },
    },
    select: { id: true },
  });
  return {
    success: true,
    data: { comprobanteId: comprobante.id, movimientos: input.lineas.length },
  };
}

/**
 * Crea el comprobante justificante y las líneas del ledger.
 * `cantidad` positiva; el signo lo da `tipoMovimiento`.
 * Sin `db`: un solo `create` anidado (el pooler Neon no sostiene `$transaction` interactiva).
 */
export async function registrarStockMovimientos(
  input: RegistrarStockMovimientosInput,
  db?: Prisma.TransactionClient
): Promise<ServiceResult<RegistrarStockMovimientosResult>> {
  try {
    if (db) return persistirStockMovimientosEn(db, input);
    return persistirStockMovimientosStandalone(input);
  } catch (e) {
    console.error("[registrarStockMovimientos]", e);
    return { success: false, error: "Error al registrar movimientos de stock." };
  }
}

export type ConfirmarAjusteControlStockInput = {
  sucursalCodigo: string;
  personalId: number;
  lineas: Array<{
    codItem: string;
    cantidad: number;
    tipoMovimiento: StockMovimientoTipo;
  }>;
};

/** Ajuste de Control Stock: un comprobante `AJUSTE_STOCK` + líneas INGRESO/EGRESO. */
export async function confirmarAjusteControlStock(
  input: ConfirmarAjusteControlStockInput
): Promise<ServiceResult<RegistrarStockMovimientosResult>> {
  const sucursalId = await obtenerSucursalIdPorCodigo(input.sucursalCodigo);
  if (!sucursalId) {
    return { success: false, error: "La sucursal del usuario no existe." };
  }
  return registrarStockMovimientos({
    comprobanteTipo: "AJUSTE_STOCK",
    sucursalId,
    personalId: input.personalId,
    lineas: input.lineas.map((linea) => ({
      tipoMovimiento: linea.tipoMovimiento,
      categoriaMovimiento: "AJUSTE_STOCK",
      codItem: linea.codItem,
      sucursalId,
      cantidad: linea.cantidad,
    })),
  });
}

function ledgerDesdeTipoComprobanteVta(
  tipoComprobante: string
): {
  comprobanteTipo: StockComprobanteTipo;
  tipoMovimiento: StockMovimientoTipo;
  categoriaMovimiento: StockMovimientoCategoria;
} | null {
  if (tipoComprobante === "factura_fiscal" || tipoComprobante === "factura_no_fiscal") {
    return {
      comprobanteTipo: "VENTA",
      tipoMovimiento: "EGRESO",
      categoriaMovimiento: "VENTA",
    };
  }
  if (
    tipoComprobante === "nota_credito_fiscal" ||
    tipoComprobante === "nota_credito_no_fiscal"
  ) {
    return {
      comprobanteTipo: "NOTA_CREDITO",
      tipoMovimiento: "INGRESO",
      categoriaMovimiento: "NOTA_CREDITO",
    };
  }
  return null;
}

async function marcarStockAplicado(
  db: Prisma.TransactionClient,
  comprobanteId: string
): Promise<void> {
  await db.comprobanteVta.update({
    where: { id: comprobanteId },
    data: { stockAplicado: true },
  });
}

/**
 * Idempotente: venta/NC autorizada → ledger + `stock_aplicado`.
 * Presupuesto y tipos sin efecto no escriben movimientos.
 */
export async function aplicarStockDesdeComprobanteVta(
  comprobanteId: string,
  db?: Prisma.TransactionClient
): Promise<ServiceResult<{ movimientos: number }>> {
  const run = async (tx: Prisma.TransactionClient) => {
    const row = await tx.comprobanteVta.findUnique({
      where: { id: comprobanteId },
      select: {
        id: true,
        tipoComprobante: true,
        estado: true,
        stockAplicado: true,
        personalId: true,
        createdAt: true,
        personal: { select: { sucursalPorDefecto: true } },
        items: { select: { codTienda: true, cantidad: true } },
      },
    });
    if (!row) return { success: false as const, error: "El comprobante no existe." };
    if (row.stockAplicado) return { success: true as const, data: { movimientos: 0 } };
    if (row.estado !== "autorizado") {
      return { success: true as const, data: { movimientos: 0 } };
    }
    if (row.createdAt < STOCK_VTA_DESDE) {
      return { success: true as const, data: { movimientos: 0 } };
    }

    const ledger = ledgerDesdeTipoComprobanteVta(row.tipoComprobante);
    if (!ledger) {
      return { success: true as const, data: { movimientos: 0 } };
    }

    const ya = await tx.stockComprobante.findFirst({
      where: { comprobanteVtaId: row.id },
      select: { id: true },
    });
    if (ya) {
      await marcarStockAplicado(tx, row.id);
      return { success: true as const, data: { movimientos: 0 } };
    }

    const sucursalCodigo = row.personal?.sucursalPorDefecto?.trim() ?? "";
    if (!sucursalCodigo) {
      return {
        success: false as const,
        error: "El usuario del comprobante no tiene sucursal para aplicar stock.",
      };
    }
    const sucursalId = await obtenerSucursalIdPorCodigo(sucursalCodigo);
    if (!sucursalId) {
      return {
        success: false as const,
        error: "La sucursal del usuario no existe.",
      };
    }

    const lineas = row.items
      .map((item) => ({
        tipoMovimiento: ledger.tipoMovimiento,
        categoriaMovimiento: ledger.categoriaMovimiento,
        codItem: item.codTienda.trim(),
        sucursalId,
        cantidad: redondearCantidadUnDecimal(cantidadDesdePrisma(item.cantidad)),
      }))
      .filter((l) => l.codItem.length > 0 && l.cantidad > 0);

    if (lineas.length === 0) {
      await marcarStockAplicado(tx, row.id);
      return { success: true as const, data: { movimientos: 0 } };
    }

    const reg = await persistirStockMovimientosEn(tx, {
      comprobanteTipo: ledger.comprobanteTipo,
      sucursalId,
      personalId: row.personalId ?? undefined,
      comprobanteVtaId: row.id,
      lineas,
    });
    if (!reg.success) return reg;
    await marcarStockAplicado(tx, row.id);
    return { success: true as const, data: { movimientos: reg.data.movimientos } };
  };

  try {
    if (db) return run(db);
    return await prisma.$transaction((tx) => run(tx));
  } catch (e) {
    console.error("[aplicarStockDesdeComprobanteVta]", e);
    return { success: false, error: "No se pudo registrar el stock del comprobante." };
  }
}

/** Borra el header y las líneas del ledger de esa venta/NC (p. ej. al eliminar un no fiscal). */
export async function revertirStockDeComprobanteVta(
  comprobanteVtaId: string,
  db?: Prisma.TransactionClient
): Promise<void> {
  const run = async (tx: Prisma.TransactionClient) => {
    const headers = await tx.stockComprobante.findMany({
      where: { comprobanteVtaId },
      select: { id: true },
    });
    for (const header of headers) {
      await tx.stockMovimiento.deleteMany({
        where: { comprobanteRelacionadoId: header.id },
      });
      await tx.stockComprobante.delete({ where: { id: header.id } });
    }
    await tx.comprobanteVta.updateMany({
      where: { id: comprobanteVtaId },
      data: { stockAplicado: false },
    });
  };
  if (db) {
    await run(db);
    return;
  }
  await prisma.$transaction((tx) => run(tx));
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

/** Ledger de la sucursal (código `guaymallen` | `maipu`), más recientes primero. */
export async function listarStockMovimientosPorSucursalCodigo(
  sucursalCodigo: string
): Promise<StockMovimientoFila[]> {
  const sucursalId = await obtenerSucursalIdPorCodigo(sucursalCodigo);
  if (!sucursalId) return [];

  const rows = await prisma.stockMovimiento.findMany({
    where: { sucursalId },
    orderBy: { createdAt: "desc" },
    take: LISTADO_MOVIMIENTOS_MAX,
    select: {
      id: true,
      tipoMovimiento: true,
      categoriaMovimiento: true,
      cantidad: true,
      createdAt: true,
      usuarioId: true,
      prodTienda: { select: { descripcionTienda: true, codTienda: true } },
      comprobante: {
        select: {
          id: true,
          tipo: true,
          comprobanteVtaId: true,
          personalId: true,
          personal: { select: { nombrePersonal: true } },
          sucursal: { select: { codigo: true, nombre: true } },
          sucursalDestino: { select: { codigo: true, nombre: true } },
          comprobanteVta: { select: { receptorNombre: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const item =
      row.prodTienda.descripcionTienda?.trim() || row.prodTienda.codTienda;
    const usuarioNombre =
      row.comprobante.personal?.nombrePersonal.trim() || "";
    const contraparteNombre = contraparteDesdeComprobante(row.comprobante);
    const categoriaEtiqueta =
      CATEGORIA_ETIQUETA[row.categoriaMovimiento] ??
      String(row.categoriaMovimiento);
    return {
      id: row.id,
      fechaIso: row.createdAt.toISOString(),
      fechaMs: row.createdAt.getTime(),
      tipoMovimiento: row.tipoMovimiento,
      tipoEtiqueta: TIPO_ETIQUETA[row.tipoMovimiento] ?? String(row.tipoMovimiento),
      categoriaMovimiento: row.categoriaMovimiento,
      categoriaEtiqueta,
      usuarioNombre,
      contraparteNombre,
      item,
      cantidad: cantidadDesdePrisma(row.cantidad),
      stockComprobanteId: row.comprobante.id,
      stockComprobanteTipo: row.comprobante.tipo,
      comprobanteVtaId: row.comprobante.comprobanteVtaId,
    };
  });
}

function etiquetaSucursal(s: {
  codigo: string;
  nombre: string | null;
} | null): string {
  if (!s) return "";
  return (s.nombre?.trim() || s.codigo.trim()).toUpperCase();
}

function contraparteDesdeComprobante(comprobante: {
  tipo: StockComprobanteTipo;
  comprobanteVta: { receptorNombre: string } | null;
  sucursal: { codigo: string; nombre: string | null };
  sucursalDestino: { codigo: string; nombre: string | null } | null;
}): string {
  if (
    comprobante.tipo === "VENTA" ||
    comprobante.tipo === "NOTA_CREDITO"
  ) {
    return comprobante.comprobanteVta?.receptorNombre.trim() ?? "";
  }
  if (comprobante.tipo === "TRANSFERENCIA_ENTRE_DEPOSITOS") {
    const origen = etiquetaSucursal(comprobante.sucursal);
    const destino = etiquetaSucursal(comprobante.sucursalDestino);
    if (origen && destino) return `${origen} → ${destino}`;
    return origen || destino;
  }
  return "";
}

/** Detalle del justificante de stock (ajuste, transferencia, compra, o fallback). */
export async function obtenerStockComprobanteDetalle(
  stockComprobanteId: string
): Promise<ServiceResult<StockComprobanteDetalle>> {
  const id = stockComprobanteId.trim();
  if (!id) {
    return { success: false, error: "Comprobante de stock inválido." };
  }
  try {
    const row = await prisma.stockComprobante.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        createdAt: true,
        comprobanteVtaId: true,
        personal: { select: { nombrePersonal: true } },
        sucursal: { select: { codigo: true, nombre: true } },
        sucursalDestino: { select: { codigo: true, nombre: true } },
        movimientos: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            tipoMovimiento: true,
            categoriaMovimiento: true,
            cantidad: true,
            prodTienda: { select: { descripcionTienda: true, codTienda: true } },
            sucursal: { select: { codigo: true } },
          },
        },
      },
    });
    if (!row) {
      return { success: false, error: "El comprobante de stock no existe." };
    }
    return {
      success: true,
      data: {
        id: row.id,
        tipo: row.tipo,
        tipoEtiqueta: COMPROBANTE_TIPO_ETIQUETA[row.tipo],
        fechaIso: row.createdAt.toISOString(),
        fechaMs: row.createdAt.getTime(),
        usuarioNombre: row.personal?.nombrePersonal.trim() ?? "",
        sucursalOrigen: etiquetaSucursal(row.sucursal),
        sucursalDestino: etiquetaSucursal(row.sucursalDestino),
        comprobanteVtaId: row.comprobanteVtaId,
        lineas: row.movimientos.map((m) => ({
          id: m.id,
          tipoEtiqueta: TIPO_ETIQUETA[m.tipoMovimiento],
          categoriaEtiqueta: CATEGORIA_ETIQUETA[m.categoriaMovimiento],
          item:
            m.prodTienda.descripcionTienda?.trim() || m.prodTienda.codTienda,
          cantidad: cantidadDesdePrisma(m.cantidad),
          sucursalCodigo: m.sucursal.codigo.trim().toUpperCase(),
        })),
      },
    };
  } catch (e) {
    console.error("[obtenerStockComprobanteDetalle]", e);
    return { success: false, error: "No se pudo cargar el comprobante de stock." };
  }
}
