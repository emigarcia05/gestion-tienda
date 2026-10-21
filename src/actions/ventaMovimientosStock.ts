"use server";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import type { ProveedorCompraVentaItem } from "@/lib/ventaMovimientosStock";
import {
  confirmarCompraTintometricoVentaSchema,
  confirmarCompraUrgenteVentaSchema,
  listarProveedoresCompraVentaSchema,
} from "@/lib/validations/ventaMovimientosStock";
import { listarProveedoresCompraPorCodTiendas } from "@/services/ventaMovimientosStock.service";
import {
  sucursalPedidoHabilitada,
  sumarPedidoMercaderiaUrgenteItem,
  sumarPedidoTintometricoVentaItem,
} from "@/services/pedidosEnvio.service";
import { revalidatePedidosMercaderiaListados } from "@/lib/revalidatePedidosMercaderia";

function primerError(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

export async function listarProveedoresCompraVentaAction(
  raw: unknown
): Promise<ActionResult<Record<string, ProveedorCompraVentaItem[]>>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) return { ok: false, error: "Sin acceso." };
  const parsed = listarProveedoresCompraVentaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };
  const res = await listarProveedoresCompraPorCodTiendas(parsed.data.codTiendas);
  return res.success ? { ok: true, data: res.data } : { ok: false, error: res.error };
}

export async function confirmarCompraUrgenteVentaAction(
  raw: unknown
): Promise<ActionResult<{ cantTotal: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) return { ok: false, error: "Sin permisos para pedidos." };
  const parsed = confirmarCompraUrgenteVentaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };
  if (!(await sucursalPedidoHabilitada(parsed.data.sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }
  const res = await sumarPedidoMercaderiaUrgenteItem({
    sucursal: parsed.data.sucursal,
    codTienda: parsed.data.codTienda,
    listaPrecioProveedorId: parsed.data.listaPrecioProveedorId,
    cant: parsed.data.cantidad,
  });
  if (!res.success) return { ok: false, error: res.error };
  revalidatePedidosMercaderiaListados();
  return { ok: true, data: res.data };
}

export async function confirmarCompraTintometricoVentaAction(
  raw: unknown
): Promise<ActionResult<{ cantAgregada: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.pedidos.acceso)) return { ok: false, error: "Sin permisos para pedidos." };
  const parsed = confirmarCompraTintometricoVentaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };
  if (!(await sucursalPedidoHabilitada(parsed.data.sucursal))) {
    return { ok: false, error: "La sucursal no está habilitada para pedidos." };
  }
  const res = await sumarPedidoTintometricoVentaItem(parsed.data);
  if (!res.success) return { ok: false, error: res.error };
  revalidatePedidosMercaderiaListados();
  return { ok: true, data: res.data };
}
