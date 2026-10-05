"use server";

import { requireStockAcceso } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import {
  confirmarAjusteControlStockSchema,
  obtenerStockComprobanteDetalleSchema,
} from "@/lib/validations/stockMovimientos";
import {
  confirmarAjusteControlStock,
  obtenerStockComprobanteDetalle,
  type RegistrarStockMovimientosResult,
  type StockComprobanteDetalle,
  type StockMovimientoFila,
} from "@/services/stockMovimientos.service";

export type { StockComprobanteDetalle, StockMovimientoFila };

/**
 * Evita que excepciones no atrapadas lleguen al cliente como
 * "An error occurred in the Server Components render… digest…".
 */
async function ejecutarActionSegura<T>(
  scope: string,
  fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[stockMovimientos][action][${scope}]`, msg);
    return { ok: false, error: "Error inesperado al procesar la solicitud." };
  }
}

export async function obtenerStockComprobanteDetalleAction(
  raw: unknown
): Promise<ActionResult<StockComprobanteDetalle>> {
  return ejecutarActionSegura("obtenerStockComprobanteDetalle", async () => {
    const gate = await requireStockAcceso();
    if (gate) return gate;
    const parsed = obtenerStockComprobanteDetalleSchema.safeParse(raw);
    if (!parsed.success) return zodFail(parsed.error);
    return fromServiceResult(
      await obtenerStockComprobanteDetalle(parsed.data.stockComprobanteId)
    );
  });
}

export async function confirmarAjusteControlStockAction(
  raw: unknown
): Promise<ActionResult<RegistrarStockMovimientosResult>> {
  return ejecutarActionSegura("confirmarAjusteControlStock", async () => {
    const gate = await requireStockAcceso();
    if (gate) return gate;
    const parsed = confirmarAjusteControlStockSchema.safeParse(raw);
    if (!parsed.success) return zodFail(parsed.error);
    return fromServiceResult(await confirmarAjusteControlStock(parsed.data));
  });
}
