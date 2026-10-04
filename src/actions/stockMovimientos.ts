"use server";

import { requireStockAcceso } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import {
  confirmarAjusteControlStockSchema,
  listarStockMovimientosSucursalSchema,
} from "@/lib/validations/stockMovimientos";
import {
  confirmarAjusteControlStock,
  listarStockMovimientosPorSucursalCodigo,
  type RegistrarStockMovimientosResult,
  type StockMovimientoFila,
} from "@/services/stockMovimientos.service";

export type { StockMovimientoFila };

export async function listarStockMovimientosSucursalAction(
  raw: unknown
): Promise<ActionResult<StockMovimientoFila[]>> {
  const gate = await requireStockAcceso();
  if (gate) return gate;
  const parsed = listarStockMovimientosSucursalSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const filas = await listarStockMovimientosPorSucursalCodigo(
      parsed.data.sucursalCodigo
    );
    return { ok: true, data: filas };
  } catch (e) {
    console.error("[listarStockMovimientosSucursalAction]", e);
    return { ok: false, error: "No se pudieron cargar los movimientos." };
  }
}

export async function confirmarAjusteControlStockAction(
  raw: unknown
): Promise<ActionResult<RegistrarStockMovimientosResult>> {
  const gate = await requireStockAcceso();
  if (gate) return gate;
  const parsed = confirmarAjusteControlStockSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await confirmarAjusteControlStock(parsed.data);
  return fromServiceResult(res);
}
