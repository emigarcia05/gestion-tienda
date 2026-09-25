"use server";

import { revalidatePath } from "next/cache";
import { requireFacturacionLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import type {
  CuentaCorrienteClienteDatos,
  FacturaCobroDetalle,
  FacturaComprobanteCobroItem,
  FacturaNcCobroVista,
  FacturaComprobanteDuplicarBorrador,
  FacturaEmitirResultado,
  FacturaVentaPendientePago,
} from "@/lib/factura";
import type { ClienteListaItem } from "@/lib/envios";
import type { ActionResult } from "@/lib/types";
import {
  buscarClientesFacturaSchema,
  buscarProductosFacturaSchema,
  compartirLinkCuentaCorrienteSchema,
  obtenerCuentaCorrienteClienteSchema,
  emitirFacturaComprobanteSchema,
  emitirNotaCreditoFacturaSchema,
  convertirComprobanteNoFiscalEnFiscalSchema,
  facturaComprobanteIdSchema,
  guardarDiasVencimientoFacturaSchema,
  registrarCobroComprobanteFacturaSchema,
  asignarNotaCreditoComoCobroSchema,
  asignarClienteCobroComoCobroSchema,
  registrarPagoCuentaCorrienteSchema,
} from "@/lib/validations/factura";
import { rutaCuentaCorrientePublica } from "@/lib/cuentaCorrientePublica";
import {
  buscarClientesParaFactura,
  obtenerCuentaCorrienteCliente,
  obtenerOCrearTokenCuentaCorriente,
} from "@/services/clientes.service";
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
  revalidatePath(FACTURACION_ROUTES.clientes.cuentaCorriente);
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

export async function obtenerCuentaCorrienteClienteAction(
  raw: unknown
): Promise<ActionResult<CuentaCorrienteClienteDatos>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = obtenerCuentaCorrienteClienteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  return fromServiceResult(
    await obtenerCuentaCorrienteCliente(parsed.data.clienteId)
  );
}

export async function compartirLinkCuentaCorrienteAction(
  raw: unknown
): Promise<ActionResult<{ path: string }>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;

  const parsed = compartirLinkCuentaCorrienteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  const out = await obtenerOCrearTokenCuentaCorriente(parsed.data.clienteId);
  if (!out.success) return { ok: false, error: out.error };
  return { ok: true, data: { path: rutaCuentaCorrientePublica(out.data.token) } };
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

  const parsed = emitirNotaCreditoFacturaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const { emitirNotaCreditoDesdeComprobante } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(
      await emitirNotaCreditoDesdeComprobante(
        parsed.data.id,
        parsed.data.personalId
      )
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

export async function listarCobrosComprobanteFacturaAction(
  raw: unknown
): Promise<
  ActionResult<{ items: FacturaComprobanteCobroItem[]; saldoPendiente: number | null }>
> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { listarCobrosComprobanteVta } = await import(
      "@/services/facturaComprobantesListado.service"
    );
    const data = await listarCobrosComprobanteVta(parsed.data.id);
    return { ok: true, data };
  } catch (e) {
    console.error("[listarCobrosComprobanteFacturaAction]", e);
    return { ok: false, error: "No se pudieron listar los cobros." };
  }
}

export async function listarVistaCobroNotaCreditoAction(
  raw: unknown
): Promise<ActionResult<FacturaNcCobroVista>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { listarVistaCobroNotaCredito } = await import(
      "@/services/facturaComprobantesListado.service"
    );
    const data = await listarVistaCobroNotaCredito(parsed.data.id);
    if (!data) return { ok: false, error: "No se encontró la nota de crédito." };
    return { ok: true, data };
  } catch (e) {
    console.error("[listarVistaCobroNotaCreditoAction]", e);
    return { ok: false, error: "No se pudieron cargar las imputaciones." };
  }
}

export async function asignarNotaCreditoComoCobroAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = asignarNotaCreditoComoCobroSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { asignarNotaCreditoComoCobro } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(await asignarNotaCreditoComoCobro(parsed.data));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[asignarNotaCreditoComoCobroAction]", e);
    return { ok: false, error: "No se pudo asignar la nota de crédito." };
  }
}

export async function asignarClienteCobroComoCobroAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = asignarClienteCobroComoCobroSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { asignarClienteCobroComoCobro } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(await asignarClienteCobroComoCobro(parsed.data));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[asignarClienteCobroComoCobroAction]", e);
    return { ok: false, error: "No se pudo asignar el cobro." };
  }
}

export async function obtenerDetalleCobroComprobanteAction(
  raw: unknown
): Promise<ActionResult<FacturaCobroDetalle>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { obtenerDetalleCobroComprobante } = await import(
      "@/services/facturaComprobantesListado.service"
    );
    return fromServiceResult(await obtenerDetalleCobroComprobante(parsed.data.id));
  } catch (e) {
    console.error("[obtenerDetalleCobroComprobanteAction]", e);
    return { ok: false, error: "No se pudo leer el cobro." };
  }
}

export async function registrarCobroComprobanteFacturaAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = registrarCobroComprobanteFacturaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { registrarCobroComprobanteVta } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(await registrarCobroComprobanteVta(parsed.data));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[registrarCobroComprobanteFacturaAction]", e);
    return { ok: false, error: "No se pudo registrar el cobro." };
  }
}

export async function listarVentasPendientesPagoCuentaCorrienteAction(
  raw: unknown
): Promise<ActionResult<{ ventas: FacturaVentaPendientePago[] }>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = obtenerCuentaCorrienteClienteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { listarVentasPendientesPagoCuentaCorriente } = await import(
      "@/services/facturaComprobantesListado.service"
    );
    const ventas = await listarVentasPendientesPagoCuentaCorriente(
      parsed.data.clienteId
    );
    return { ok: true, data: { ventas } };
  } catch (e) {
    console.error("[listarVentasPendientesPagoCuentaCorrienteAction]", e);
    return { ok: false, error: "No se pudieron listar los comprobantes con saldo." };
  }
}

export async function registrarPagoCuentaCorrienteAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = registrarPagoCuentaCorrienteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { registrarPagoCuentaCorriente } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(await registrarPagoCuentaCorriente(parsed.data));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[registrarPagoCuentaCorrienteAction]", e);
    return { ok: false, error: "No se pudo registrar el pago." };
  }
}

export async function obtenerBorradorDuplicarComprobanteAction(
  raw: unknown
): Promise<ActionResult<FacturaComprobanteDuplicarBorrador>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { obtenerBorradorDuplicarComprobante } = await import(
      "@/services/facturaComprobantes.service"
    );
    return fromServiceResult(await obtenerBorradorDuplicarComprobante(parsed.data.id));
  } catch (e) {
    console.error("[obtenerBorradorDuplicarComprobanteAction]", e);
    return { ok: false, error: "No se pudo duplicar el comprobante." };
  }
}

export async function eliminarComprobanteNoFiscalAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = facturaComprobanteIdSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { eliminarComprobanteNoFiscal } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(await eliminarComprobanteNoFiscal(parsed.data.id));
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[eliminarComprobanteNoFiscalAction]", e);
    return { ok: false, error: "No se pudo eliminar el comprobante." };
  }
}

export async function convertirComprobanteNoFiscalEnFiscalAction(
  raw: unknown
): Promise<ActionResult<FacturaEmitirResultado>> {
  const gate = await requireFacturacionLectura();
  if (gate) return gate;
  const parsed = convertirComprobanteNoFiscalEnFiscalSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { convertirComprobanteNoFiscalEnFiscal } = await import(
      "@/services/facturaComprobantes.service"
    );
    const out = fromServiceResult(
      await convertirComprobanteNoFiscalEnFiscal(parsed.data)
    );
    if (!out.ok) return out;
    revalidateFacturacion();
    return out;
  } catch (e) {
    console.error("[convertirComprobanteNoFiscalEnFiscalAction]", e);
    return { ok: false, error: "No se pudo convertir el comprobante en fiscal." };
  }
}
