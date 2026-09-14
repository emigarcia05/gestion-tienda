"use server";

import { revalidatePath } from "next/cache";
import { requireFacturacionLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import type { FacturaEmitirResultado } from "@/lib/factura";
import type { ActionResult } from "@/lib/types";
import {
  buscarProductosFacturaSchema,
  emitirFacturaComprobanteSchema,
  facturaComprobanteIdSchema,
} from "@/lib/validations/factura";
import {
  buscarProductosParaFactura,
  type ProductoFacturaBusquedaItem,
} from "@/services/facturaProductos.service";
import {
  consultarFacturaComprobanteArca,
  emitirFacturaComprobante,
  emitirNotaCreditoDesdeComprobante,
  obtenerFacturaComprobantePdfDatos,
  type FacturaComprobantePdfDatos,
} from "@/services/facturaComprobantes.service";

function revalidateFacturacion(): void {
  revalidatePath(FACTURACION_ROUTES.factura.crear);
  revalidatePath(FACTURACION_ROUTES.factura.facturas);
  revalidatePath(FACTURACION_ROUTES.factura.presupuestos);
}

export async function buscarProductosFacturaAction(
  raw: unknown
): Promise<ActionResult<{ items: ProductoFacturaBusquedaItem[] }>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = buscarProductosFacturaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const res = await buscarProductosParaFactura({
    q: parsed.data.q,
    take: parsed.data.take,
    sucursalCodigo: parsed.data.sucursalCodigo,
  });
  return fromServiceResult(res);
}

export async function emitirFacturaComprobanteAction(
  raw: unknown
): Promise<ActionResult<FacturaEmitirResultado>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = emitirFacturaComprobanteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const out = fromServiceResult(await emitirFacturaComprobante(parsed.data));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[emitirFacturaComprobanteAction]", e);
    return { ok: false, error: "No se pudo emitir el comprobante." };
  }
}

export async function emitirNotaCreditoFacturaAction(
  raw: unknown
): Promise<ActionResult<FacturaEmitirResultado>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const out = fromServiceResult(
      await emitirNotaCreditoDesdeComprobante(parsed.data.id)
    );
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[emitirNotaCreditoFacturaAction]", e);
    return { ok: false, error: "No se pudo emitir la nota de crédito." };
  }
}

export async function consultarFacturaComprobanteArcaAction(
  raw: unknown
): Promise<ActionResult<FacturaEmitirResultado>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const out = fromServiceResult(await consultarFacturaComprobanteArca(parsed.data.id));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[consultarFacturaComprobanteArcaAction]", e);
    return { ok: false, error: "No se pudo consultar el comprobante en ARCA." };
  }
}

export async function obtenerFacturaComprobantePdfAction(
  raw: unknown
): Promise<ActionResult<FacturaComprobantePdfDatos>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    return fromServiceResult(await obtenerFacturaComprobantePdfDatos(parsed.data.id));
  } catch (e) {
    console.error("[obtenerFacturaComprobantePdfAction]", e);
    return { ok: false, error: "No se pudo leer el comprobante." };
  }
}
