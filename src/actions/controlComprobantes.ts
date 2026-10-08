"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { fromServiceResult, zodFail } from "@/lib/actionResult";
import {
  actualizarPlazoPagoComprobanteSchema,
  actualizarPlazosPagosMercaderiaSchema,
  listarCatalogoPagoProveedorSchema,
  registrarPagoCuentaCorrienteProveedoresSchema,
  toggleControladoSchema,
} from "@/lib/validations/controlComprobantes";
import {
  actualizarControladoComprobante,
  actualizarPlazoPagoComprobante,
  listarComprobantesCompraPendientesPago,
  registrarPagoCuentaCorrienteProveedores,
} from "@/services/controlComprobantes.service";
import { listarCobrosCuotas } from "@/services/cobrosCuotas.service";
import { listarPagosCobroHabilitadosSucursal } from "@/services/cobrosPorSucursal.service";
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import type { FacturaVentaPendientePago } from "@/lib/factura";
import { actualizarPlazosPagosProveedoresMercaderia } from "@/services/proveedor.service";

function revalidateComprobantesFinanzas() {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/control-comprobantes");
  revalidatePath("/finanzas/venc-por-fecha");
  revalidatePath("/finanzas/tesoreria");
  revalidatePath("/finanzas/tesoreria/movimientos");
}

export async function actualizarControladoComprobanteAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para acceder a finanzas." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = toggleControladoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos para actualizar el comprobante." };
  }

  const result = await actualizarControladoComprobante(
    parsed.data.id,
    parsed.data.controlado
  );
  if (!result.success) return { ok: false, error: result.error };

  revalidateComprobantesFinanzas();

  return { ok: true, data: undefined };
}

export async function actualizarPlazoPagoComprobanteAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para acceder a finanzas." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = actualizarPlazoPagoComprobanteSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Plazo de pago inválido.";
    return { ok: false, error: msg };
  }

  const plan =
    parsed.data.modo === "default"
      ? null
      : {
          plazo1: parsed.data.plazo1,
          plazo2: parsed.data.plazo2,
          plazo3: parsed.data.plazo3,
          plazo4: parsed.data.plazo4,
        };

  const result = await actualizarPlazoPagoComprobante(parsed.data.id, plan);
  if (!result.success) return { ok: false, error: result.error };

  revalidateComprobantesFinanzas();

  return { ok: true, data: undefined };
}

export async function actualizarPlazosPagosMercaderiaAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para acceder a finanzas." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }

  const parsed = actualizarPlazosPagosMercaderiaSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Plazos de pago inválidos.";
    return { ok: false, error: msg };
  }

  const result = await actualizarPlazosPagosProveedoresMercaderia(
    parsed.data.items.map((item) => ({
      id: item.id,
      plazoPago1Dias: item.plazo1,
      plazoPago2Dias: item.plazo2,
      plazoPago3Dias: item.plazo3,
      plazoPago4Dias: item.plazo4,
    }))
  );
  if (!result.success) return { ok: false, error: result.error };

  revalidateComprobantesFinanzas();

  return { ok: true, data: undefined };
}

export async function listarCatalogoPagoProveedorAction(
  raw: unknown
): Promise<ActionResult<{ pagos: FinAnaCosFinaPagoItem[]; cuotas: CobrosCuotaItem[] }>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  const parsed = listarCatalogoPagoProveedorSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const [pagos, cuotas] = await Promise.all([
      listarPagosCobroHabilitadosSucursal(parsed.data.sucursalCodigo),
      listarCobrosCuotas(),
    ]);
    return { ok: true, data: { pagos, cuotas } };
  } catch (e) {
    console.error("[listarCatalogoPagoProveedorAction]", e);
    return { ok: false, error: "No se pudieron cargar las formas de pago." };
  }
}

export async function listarComprobantesCompraPendientesPagoAction(): Promise<
  ActionResult<{ comprobantes: FacturaVentaPendientePago[] }>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;
  try {
    const comprobantes = await listarComprobantesCompraPendientesPago();
    return { ok: true, data: { comprobantes } };
  } catch (e) {
    console.error("[listarComprobantesCompraPendientesPagoAction]", e);
    return { ok: false, error: "No se pudieron cargar los comprobantes." };
  }
}

export async function registrarPagoCuentaCorrienteProveedoresAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;
  const parsed = registrarPagoCuentaCorrienteProveedoresSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const res = await registrarPagoCuentaCorrienteProveedores(parsed.data);
  if (res.success) revalidateComprobantesFinanzas();
  return fromServiceResult(res);
}
