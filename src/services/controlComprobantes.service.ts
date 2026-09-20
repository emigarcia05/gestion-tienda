import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  expandirCuotasComprobante,
  formatPlanPlazosLabel,
  resolverPlazosEfectivos,
  type PlanPlazosPago,
} from "@/lib/comprobanteCuotasPlazoPago";
import type { ServiceResult } from "@/types/service.types";

export interface ControlComprobanteFila {
  id: string;
  fechaComp: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  sucursalNombre: string;
  comprobante: string;
  total: Prisma.Decimal;
  montoAplicado: Prisma.Decimal;
  /** Suma de saldos de cuotas ya vencidas (FIFO). */
  vencimientoSaldo: Prisma.Decimal;
  controlado: boolean;
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
  proveedorPlazo1Dias: number | null;
  proveedorPlazo2Dias: number | null;
  proveedorPlazo3Dias: number | null;
  proveedorPlazo4Dias: number | null;
  /** Plazos efectivos, ej. "30, 60, 90". */
  planPlazosLabel: string;
  /** Primera fecha de vencimiento con saldo &gt; 0 (o última cuota si todo pagado). */
  fechaVenc: string;
}

type ControlComprobanteRaw = {
  id: string;
  fechaComp: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  sucursalNombre: string;
  comprobante: string;
  total: Prisma.Decimal;
  montoAplicado: Prisma.Decimal;
  controlado: boolean;
  plazoPago1Dias: number | null;
  plazoPago2Dias: number | null;
  plazoPago3Dias: number | null;
  plazoPago4Dias: number | null;
  proveedorPlazo1Dias: number | null;
  proveedorPlazo2Dias: number | null;
  proveedorPlazo3Dias: number | null;
  proveedorPlazo4Dias: number | null;
  hoy: string;
};

function planFromCols(
  p1: number | null,
  p2: number | null,
  p3: number | null,
  p4: number | null
): PlanPlazosPago {
  return { plazo1: p1, plazo2: p2, plazo3: p3, plazo4: p4 };
}

/**
 * Lista comprobantes; vencimiento = suma de saldos de cuotas con fecha_venc &lt; hoy.
 */
export async function listarControlComprobantes(): Promise<ControlComprobanteFila[]> {
  const rows = await prisma.$queryRaw<ControlComprobanteRaw[]>`
    SELECT
      c.id AS id,
      c.fecha_comp::text AS "fechaComp",
      p.nombre AS "proveedorNombre",
      COALESCE(p.prefijo, '') AS "proveedorPrefijo",
      COALESCE(s.nombre, c.id_sucursal_empresa) AS "sucursalNombre",
      c.comprobante AS comprobante,
      c.total AS total,
      c.monto_aplicado AS "montoAplicado",
      c.controlado AS controlado,
      c.plazo_pago_1_dias AS "plazoPago1Dias",
      c.plazo_pago_2_dias AS "plazoPago2Dias",
      c.plazo_pago_3_dias AS "plazoPago3Dias",
      c.plazo_pago_4_dias AS "plazoPago4Dias",
      p.plazo_pago_1_dias AS "proveedorPlazo1Dias",
      p.plazo_pago_2_dias AS "proveedorPlazo2Dias",
      p.plazo_pago_3_dias AS "proveedorPlazo3Dias",
      p.plazo_pago_4_dias AS "proveedorPlazo4Dias",
      ((NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)::text AS hoy
    FROM fin_compras_comprobante c
    INNER JOIN global_proveedores p ON p.id_proveedor_dux = c.id_proveedor
    LEFT JOIN sucursales s ON COALESCE(s.id_dux, '') = c.id_sucursal_empresa
    ORDER BY c.fecha_comp ASC, COALESCE(p.prefijo, p.nombre) ASC, c.comprobante ASC
  `;

  return rows.map((r) => {
    const override = planFromCols(
      r.plazoPago1Dias,
      r.plazoPago2Dias,
      r.plazoPago3Dias,
      r.plazoPago4Dias
    );
    const proveedor = planFromCols(
      r.proveedorPlazo1Dias,
      r.proveedorPlazo2Dias,
      r.proveedorPlazo3Dias,
      r.proveedorPlazo4Dias
    );
    const plazos = resolverPlazosEfectivos(override, proveedor);
    const cuotas = expandirCuotasComprobante({
      fechaCompIso: r.fechaComp,
      total: Number(r.total),
      montoAplicado: Number(r.montoAplicado),
      override,
      proveedor,
      soloConSaldo: false,
    });
    const hoy = r.hoy.slice(0, 10);
    const vencidas = cuotas.filter((c) => c.saldoCuota > 0 && c.fechaVencIso < hoy);
    const vencimientoSaldo = vencidas.reduce((acc, c) => acc + c.saldoCuota, 0);
    const conSaldo = cuotas.filter((c) => c.saldoCuota > 0);
    const fechaVenc =
      conSaldo[0]?.fechaVencIso ?? cuotas[cuotas.length - 1]?.fechaVencIso ?? r.fechaComp.slice(0, 10);

    return {
      id: r.id,
      fechaComp: r.fechaComp,
      proveedorNombre: r.proveedorNombre,
      proveedorPrefijo: r.proveedorPrefijo,
      sucursalNombre: r.sucursalNombre,
      comprobante: r.comprobante,
      total: r.total,
      montoAplicado: r.montoAplicado,
      vencimientoSaldo: new Prisma.Decimal(vencimientoSaldo.toFixed(2)),
      controlado: r.controlado,
      plazoPago1Dias: r.plazoPago1Dias,
      plazoPago2Dias: r.plazoPago2Dias,
      plazoPago3Dias: r.plazoPago3Dias,
      plazoPago4Dias: r.plazoPago4Dias,
      proveedorPlazo1Dias: r.proveedorPlazo1Dias,
      proveedorPlazo2Dias: r.proveedorPlazo2Dias,
      proveedorPlazo3Dias: r.proveedorPlazo3Dias,
      proveedorPlazo4Dias: r.proveedorPlazo4Dias,
      planPlazosLabel: formatPlanPlazosLabel(plazos),
      fechaVenc,
    };
  });
}

export async function actualizarControladoComprobante(
  id: string,
  controlado: boolean
): Promise<ServiceResult<void>> {
  try {
    await prisma.comprobanteProveedor.update({
      where: { id },
      data: { controlado },
    });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el estado de controlado.";
    return { success: false, error: message };
  }
}

export async function actualizarPlazoPagoComprobante(
  id: string,
  plan: PlanPlazosPago | null
): Promise<ServiceResult<void>> {
  try {
    await prisma.comprobanteProveedor.update({
      where: { id },
      data: plan
        ? {
            plazoPago1Dias: plan.plazo1,
            plazoPago2Dias: plan.plazo2,
            plazoPago3Dias: plan.plazo3,
            plazoPago4Dias: plan.plazo4,
          }
        : {
            plazoPago1Dias: null,
            plazoPago2Dias: null,
            plazoPago3Dias: null,
            plazoPago4Dias: null,
          },
    });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el plazo de pago.";
    return { success: false, error: message };
  }
}
