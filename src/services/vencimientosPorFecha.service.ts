import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SQL_CTE_CUOTAS_MERCADERIA } from "@/lib/comprobanteCuotasPlazoPago";

/** Valor fijo de columna **Detalle** para vencimientos de comprobantes (mercadería). */
export const FLUJO_FONDO_DETALLE_MERCADERIA = "MERCADERÍA" as const;

/**
 * Líneas de **cuota** con saldo pendiente cuya fecha de vencimiento cae en `[fechaDesde, fechaHasta]`.
 * Plan hasta 4 plazos; cuotas iguales; pagos FIFO.
 */
export interface VencimientoPorFechaLinea {
  fechaVenc: string;
  nombre: string;
  /** Abreviatura de 3 letras (`proveedores.prefijo`). Vacío si no tiene. */
  prefijo: string | null;
  saldo: Prisma.Decimal;
  comprobanteId: string;
  /** `fecha_comp` (yyyy-mm-dd). Orden y desempate con gastos. */
  fechaComp: string;
}

export async function listarVencimientosEnRango(
  fechaDesde: string,
  fechaHasta: string
): Promise<VencimientoPorFechaLinea[]> {
  const rows = await prisma.$queryRaw<VencimientoPorFechaLinea[]>`
    WITH ${Prisma.raw(SQL_CTE_CUOTAS_MERCADERIA)}
    SELECT
      cm.fecha_venc::text AS "fechaVenc",
      cm.nombre AS nombre,
      gp.prefijo AS prefijo,
      cm.saldo_cuota AS saldo,
      (cm.id::text || ':' || cm.nro_cuota::text) AS "comprobanteId",
      cm.fecha_comp::text AS "fechaComp"
    FROM cuotas_mercaderia cm
    LEFT JOIN proveedores gp ON gp.nombre = cm.nombre
    WHERE cm.saldo_cuota > 0
      AND cm.fecha_venc >= ${fechaDesde}::date
      AND cm.fecha_venc <= ${fechaHasta}::date
    ORDER BY cm.fecha_venc ASC, cm.nombre ASC, cm.nro_cuota ASC
  `;
  return rows;
}

/**
 * Fila de **Detalle del día** (comprobante o imputación de balance) y orden estable.
 * Orden: proveedor, detalle, `sortFecha` (fecha devengo o `fecha_comp`), `sortId`.
 */
export type FlujoFondoDetalleDiaFila = {
  fechaDevengadaIso: string;
  fechaVencimientoIso: string;
  /** Nombre en MAYÚSCULAS. El filtro y el tooltip usan este valor. */
  proveedor: string;
  /** Prefijo de 3 letras. Vacío si el proveedor no tiene. */
  proveedorPrefijo?: string;
  detalle: string;
  monto: number;
  sortFecha: string;
  sortId: string;
};

export function ordenarDetallesFlujoDia(
  filas: FlujoFondoDetalleDiaFila[]
): FlujoFondoDetalleDiaFila[] {
  return [...filas].sort((a, b) => {
    const p = a.proveedor.localeCompare(b.proveedor, "es");
    if (p !== 0) return p;
    const d = a.detalle.localeCompare(b.detalle, "es");
    if (d !== 0) return d;
    const f = a.sortFecha.localeCompare(b.sortFecha);
    if (f !== 0) return f;
    return a.sortId.localeCompare(b.sortId);
  });
}

/**
 * Suma de saldos de cuotas cuya fecha de vencimiento es estrictamente anterior a `fechaIso`.
 */
export async function sumarSaldoVencimientosConFechaVencAnteriorA(
  fechaIso: string
): Promise<number> {
  const rows = await prisma.$queryRaw<[{ total: Prisma.Decimal | null }]>`
    WITH ${Prisma.raw(SQL_CTE_CUOTAS_MERCADERIA)}
    SELECT COALESCE(SUM(cm.saldo_cuota), 0)::numeric AS total
    FROM cuotas_mercaderia cm
    WHERE cm.saldo_cuota > 0
      AND cm.fecha_venc < ${fechaIso}::date
  `;
  return Number(rows[0]?.total ?? 0);
}
