/**
 * Cx. Financiero de cobros de venta (`bal_cx_financiero`): una fila por movimiento de tesorería
 * de cobro (INGRESO) o devolución de NC (EGRESO) con comprobante, caja, forma de pago y
 * `costo_financiero` > 0. El % es el snapshot del movimiento (no se recalcula si cambia
 * `cobros_cx_fin`); las filas se borran en cascada con el movimiento o el comprobante.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Recalcula las filas de Cx Fin de esos movimientos (borra y vuelve a crear). Llamar en la misma
 * transacción después de crear un cobro o de reasignar/partir un anticipo a una venta.
 */
export async function sincronizarCxFinancieroDeMovimientos(
  movimientoIds: readonly string[],
  db: DbClient = prisma
): Promise<void> {
  const ids = [...new Set(movimientoIds.filter(Boolean))];
  if (ids.length === 0) return;
  const movimientos = await db.tesoreriaMovimiento.findMany({
    where: {
      id: { in: ids },
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
      cajaId: { not: null },
      comprobanteId: { not: null },
      pagoId: { not: null },
      costoFinanciero: { gt: 0 },
    },
    select: {
      id: true,
      tipoMovimiento: true,
      comprobanteId: true,
      sucursalId: true,
      fechaRegistro: true,
      pagoId: true,
      entidadId: true,
      cuotaId: true,
      monto: true,
      costoFinanciero: true,
    },
  });
  const filas: Prisma.BalCxFinancieroCreateManyInput[] = [];
  for (const m of movimientos) {
    if (!m.comprobanteId || !m.pagoId || !m.costoFinanciero || m.monto <= 0) continue;
    const pct = Number(m.costoFinanciero);
    filas.push({
      tesoreriaMovimientoId: m.id,
      tipoMovimiento: m.tipoMovimiento,
      comprobanteVtaId: m.comprobanteId,
      sucursalId: m.sucursalId,
      fecha: m.fechaRegistro,
      pagoId: m.pagoId,
      entidadId: m.entidadId,
      cuotaId: m.cuotaId,
      montoCobrado: m.monto,
      costoPct: m.costoFinanciero,
      cxTotal: new Prisma.Decimal(redondear2((m.monto * pct) / 100).toFixed(2)),
    });
  }
  await db.balCxFinanciero.deleteMany({ where: { tesoreriaMovimientoId: { in: ids } } });
  if (filas.length > 0) {
    await db.balCxFinanciero.createMany({ data: filas });
  }
}
