"use server";

import { revalidatePath } from "next/cache";
import { requireFacturacionLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import type { FacturaEmitirResultado } from "@/lib/factura";
import type { ClienteListaItem } from "@/lib/envios";
import type { ActionResult } from "@/lib/types";
import {
  buscarClientesFacturaSchema,
  buscarProductosFacturaSchema,
  emitirFacturaComprobanteSchema,
  facturaComprobanteIdSchema,
  guardarDiasVencimientoFacturaSchema,
} from "@/lib/validations/factura";
import { buscarClientesParaFactura } from "@/services/clientes.service";
import {
  buscarProductosParaFactura,
  type ProductoFacturaBusquedaItem,
} from "@/services/facturaProductos.service";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";
import { listarCobrosCuotas } from "@/services/cobrosCuotas.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";

function revalidateFacturacion(): void {
  revalidatePath(FACTURACION_ROUTES.factura.crear);
  revalidatePath(FACTURACION_ROUTES.factura.facturas);
  revalidatePath(FACTURACION_ROUTES.factura.presupuestos);
}

export async function buscarClientesFacturaAction(
  raw: unknown
): Promise<ActionResult<{ items: ClienteListaItem[] }>> {
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

export async function listarCatalogoCobroFacturaAction(): Promise<
  ActionResult<{ pagos: FinAnaCosFinaPagoItem[]; cuotas: CobrosCuotaItem[] }>
> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  try {
    const [pagos, cuotas] = await Promise.all([
      listarFinAnaCosFinaPagos(),
      listarCobrosCuotas(),
    ]);
    return { ok: true, data: { pagos, cuotas } };
  } catch (e) {
    console.error("[listarCatalogoCobroFacturaAction]", e);
    return { ok: false, error: "No se pudieron cargar las formas de pago." };
  }
}

export async function guardarDiasVencimientoFacturaAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = guardarDiasVencimientoFacturaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { guardarDiasVencimientoComprobante } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(await guardarDiasVencimientoComprobante(parsed.data));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[guardarDiasVencimientoFacturaAction]", e);
    return { ok: false, error: "No se pudieron guardar los días de vencimiento." };
  }
}
