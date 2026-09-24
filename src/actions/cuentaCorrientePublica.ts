"use server";

import { fromServiceResult, zodFail } from "@/lib/actionResult";
import type { CuentaCorrienteClienteDatos, FacturaCobroDetalle } from "@/lib/factura";
import type { ActionResult } from "@/lib/types";
import {
  cuentaCorrientePublicaComprobanteSchema,
  obtenerCuentaCorrientePublicaSchema,
} from "@/lib/validations/factura";
import {
  assertCobroCuentaCorrientePublica,
  assertComprobanteCuentaCorrientePublica,
  obtenerCuentaCorrientePublica,
} from "@/services/clientes.service";
import type { FacturaComprobantePdfDatos } from "@/services/facturaComprobantes.service";

export async function obtenerCuentaCorrientePublicaAction(
  raw: unknown
): Promise<ActionResult<CuentaCorrienteClienteDatos>> {
  const parsed = obtenerCuentaCorrientePublicaSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  return fromServiceResult(
    await obtenerCuentaCorrientePublica(parsed.data.token, parsed.data.clienteId)
  );
}

export async function obtenerFacturaComprobantePdfPublicoAction(
  raw: unknown
): Promise<ActionResult<FacturaComprobantePdfDatos>> {
  const parsed = cuentaCorrientePublicaComprobanteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const gate = await assertComprobanteCuentaCorrientePublica(
    parsed.data.token,
    parsed.data.id
  );
  if (!gate.success) return { ok: false, error: gate.error };
  try {
    const { obtenerFacturaComprobantePdfDatos } = await import(
      "@/services/facturaComprobantes.service"
    );
    return fromServiceResult(await obtenerFacturaComprobantePdfDatos(parsed.data.id));
  } catch (e) {
    console.error("[obtenerFacturaComprobantePdfPublicoAction]", e);
    return { ok: false, error: "No se pudo leer el comprobante." };
  }
}

export async function obtenerDetalleCobroComprobantePublicoAction(
  raw: unknown
): Promise<ActionResult<FacturaCobroDetalle>> {
  const parsed = cuentaCorrientePublicaComprobanteSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const gate = await assertCobroCuentaCorrientePublica(
    parsed.data.token,
    parsed.data.id
  );
  if (!gate.success) return { ok: false, error: gate.error };
  try {
    const { obtenerDetalleCobroComprobante } = await import(
      "@/services/facturaComprobantesListado.service"
    );
    return fromServiceResult(await obtenerDetalleCobroComprobante(parsed.data.id));
  } catch (e) {
    console.error("[obtenerDetalleCobroComprobantePublicoAction]", e);
    return { ok: false, error: "No se pudo leer el cobro." };
  }
}
