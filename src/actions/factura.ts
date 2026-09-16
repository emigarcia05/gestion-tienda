"use server";

import { revalidatePath } from "next/cache";
import { requireFacturacionLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import type { FacturaEmitirResultado } from "@/lib/factura";
import type { ClienteItem } from "@/lib/envios";
import type { ActionResult } from "@/lib/types";
import {
  buscarClientesFacturaSchema,
  buscarProductosFacturaSchema,
  emitirFacturaComprobanteSchema,
  facturaComprobanteIdSchema,
} from "@/lib/validations/factura";
import { crearClienteSchema } from "@/lib/validations/envios";
import { buscarClientesParaFactura, crearCliente } from "@/services/clientes.service";
import {
  buscarProductosParaFactura,
  type ProductoFacturaBusquedaItem,
} from "@/services/facturaProductos.service";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";
import { REVALIDATE_ENVIOS } from "@/lib/gestionProductosRoutes";

function revalidateFacturacion(): void {
  revalidatePath(FACTURACION_ROUTES.factura.crear);
  revalidatePath(FACTURACION_ROUTES.factura.facturas);
  revalidatePath(FACTURACION_ROUTES.factura.presupuestos);
}

/** Alta de cliente desde Factura · Crear (`requireFacturacionLectura`). */
export async function crearClienteFacturaAction(
  raw: unknown
): Promise<ActionResult<ClienteItem>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = crearClienteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  if (normalizarNombreVacio(parsed.data.nombreCompleto)) {
    return { ok: false, error: "Ingresá el nombre." };
  }

  try {
    const res = await crearCliente(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    for (const path of REVALIDATE_ENVIOS) {
      revalidatePath(path);
    }
    revalidateFacturacion();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearClienteFacturaAction]", e);
    return { ok: false, error: "No se pudo crear el cliente." };
  }
}

function normalizarNombreVacio(nombre: string): boolean {
  return nombre.trim() === "";
}

export async function buscarClientesFacturaAction(
  raw: unknown
): Promise<ActionResult<{ items: ClienteItem[] }>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = buscarClientesFacturaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  return fromServiceResult(
    await buscarClientesParaFactura({
      q: parsed.data.q,
      take: parsed.data.take,
    })
  );
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
    const { emitirFacturaComprobante } = await import(
      "@/services/facturaComprobantes.service"
    );
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
    const { emitirNotaCreditoDesdeComprobante } = await import(
      "@/services/facturaComprobantes.service"
    );
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
    const { consultarFacturaComprobanteArca } = await import(
      "@/services/facturaComprobantes.service"
    );
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
    const { obtenerFacturaComprobantePdfDatos } = await import(
      "@/services/facturaComprobantes.service"
    );
    return fromServiceResult(await obtenerFacturaComprobantePdfDatos(parsed.data.id));
  } catch (e) {
    console.error("[obtenerFacturaComprobantePdfAction]", e);
    return { ok: false, error: "No se pudo leer el comprobante." };
  }
}
