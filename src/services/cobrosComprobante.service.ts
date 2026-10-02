import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { esCobroNotaCreditoNombre, FACTURA_COBRO_NOTA_CREDITO_LABEL } from "@/lib/factura";
import { formatoNroComprobante } from "@/lib/facturaFiscal";
import type { ServiceResult } from "@/types/service.types";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Snapshot de cobro para UI de factura (misma forma que el ex `comprobantes_vtas_cobros`). */
export type CobroComprobanteFila = {
  id: string;
  comprobanteId: string;
  createdAt: Date;
  orden: number;
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  montoCents: number;
  esCuentaCorriente: boolean;
  plazoDias: number | null;
  clienteCobroId: string | null;
  notaCreditoId: string | null;
  personalNombre: string;
};

function fechaNegocioLocal(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/**
 * Pesos que quedan de un pago de cliente (`clientes_cobros`) sin imputar a ventas.
 * El ledger guarda pesos enteros: el total se redondea igual que al impactar tesorería.
 */
export function leftoverClienteCobroDesdeMovimientos(
  montoCents: number,
  imputaciones: readonly { monto: number }[]
): number {
  const totalPesos = Math.round(montoCents / 100);
  const usado = imputaciones.reduce((acc, fila) => acc + fila.monto, 0);
  return Math.max(0, totalPesos - usado);
}

/** Suma en pesos de cobros que bajan el saldo de la venta (COBRO + imputación NC). */
export async function sumarImpCobradoDesdeMovimientos(
  comprobanteId: string,
  db: DbClient = prisma
): Promise<number> {
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      comprobanteId,
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
    },
    select: { monto: true },
  });
  return rows.reduce((acc, r) => acc + r.monto, 0);
}

export async function siguienteOrdenCobroComprobante(
  comprobanteId: string,
  db: DbClient = prisma
): Promise<number> {
  const last = await db.tesoreriaMovimiento.findFirst({
    where: { comprobanteId },
    orderBy: [{ orden: "desc" }, { createdAt: "desc" }],
    select: { orden: true },
  });
  return (last?.orden ?? -1) + 1;
}

const COBRO_FILA_SELECT = {
  id: true,
  createdAt: true,
  orden: true,
  monto: true,
  comprobanteId: true,
  clienteCobroId: true,
  notaCreditoId: true,
  pago: { select: { nombre: true } },
  entidad: { select: { nombre: true } },
  cuota: { select: { cuotas: true } },
  personal: { select: { nombrePersonal: true } },
  notaCredito: {
    select: { ptoVenta: true, cbteNro: true },
  },
} as const;

type CobroFilaRow = Prisma.TesoreriaMovimientoGetPayload<{
  select: typeof COBRO_FILA_SELECT;
}>;

function mapCobroFila(row: CobroFilaRow, idx: number): CobroComprobanteFila {
  const esNc = row.notaCreditoId != null && row.pago == null;
  const pagoNombre = esNc
    ? FACTURA_COBRO_NOTA_CREDITO_LABEL
    : (row.pago?.nombre ?? "").toLocaleUpperCase("es-AR");
  const entidadNombre = esNc
    ? formatoNroComprobante(
        row.notaCredito?.ptoVenta ?? "",
        row.notaCredito?.cbteNro ?? null
      )
    : (row.entidad?.nombre ?? "").toLocaleUpperCase("es-AR");
  return {
    id: row.id,
    comprobanteId: row.comprobanteId ?? "",
    createdAt: row.createdAt,
    orden: row.orden ?? idx,
    pagoNombre,
    entidadNombre,
    cuotaEtiqueta: row.cuota?.cuotas ?? null,
    montoCents: row.monto * 100,
    esCuentaCorriente: false,
    plazoDias: null,
    clienteCobroId: row.clienteCobroId,
    notaCreditoId: row.notaCreditoId,
    personalNombre:
      row.personal?.nombrePersonal.trim().toLocaleUpperCase("es-AR") ?? "",
  };
}

/** Cobros (COBRO + imputación NC + devolución) de varios comprobantes, agrupados por id. */
export async function listarCobrosDeComprobantes(
  comprobanteIds: readonly string[],
  db: DbClient = prisma
): Promise<Map<string, CobroComprobanteFila[]>> {
  const out = new Map<string, CobroComprobanteFila[]>();
  const ids = [...new Set(comprobanteIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      comprobanteId: { in: ids },
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
    },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    select: COBRO_FILA_SELECT,
  });
  rows.forEach((row, idx) => {
    const fila = mapCobroFila(row, idx);
    const lista = out.get(fila.comprobanteId);
    if (lista) lista.push(fila);
    else out.set(fila.comprobanteId, [fila]);
  });
  return out;
}

export async function listarCobrosDeComprobante(
  comprobanteId: string,
  db: DbClient = prisma
): Promise<CobroComprobanteFila[]> {
  const mapa = await listarCobrosDeComprobantes([comprobanteId], db);
  return mapa.get(comprobanteId) ?? [];
}

/** Un cobro del ledger (id de `tesoreria_movimientos`) con la forma de UI; null si no es cobro de comprobante. */
export async function obtenerCobroDeComprobantePorId(
  movimientoId: string,
  db: DbClient = prisma
): Promise<CobroComprobanteFila | null> {
  const row = await db.tesoreriaMovimiento.findFirst({
    where: {
      id: movimientoId,
      comprobanteId: { not: null },
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
    },
    select: COBRO_FILA_SELECT,
  });
  return row ? mapCobroFila(row, 0) : null;
}

/** Imputaciones de una NC (filas en ventas con `nota_credito_id`). */
export async function listarImputacionesNotaCredito(
  notaCreditoId: string,
  db: DbClient = prisma
) {
  return db.tesoreriaMovimiento.findMany({
    where: {
      notaCreditoId,
      catMovimiento: "NOTA_CREDITO",
      cajaId: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      monto: true,
      comprobanteId: true,
      personal: { select: { nombrePersonal: true } },
      comprobante: {
        select: {
          id: true,
          ptoVenta: true,
          cbteNro: true,
          personal: { select: { nombrePersonal: true } },
        },
      },
    },
  });
}

export async function usadoImputadoNcPesos(
  notaCreditoId: string,
  db: DbClient = prisma
): Promise<number> {
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      notaCreditoId,
      catMovimiento: "NOTA_CREDITO",
      cajaId: null,
    },
    select: { monto: true },
  });
  return rows.reduce((acc, r) => acc + r.monto, 0);
}

/** Imputado por NC (id de NC → pesos) en lote. */
export async function usadoImputadoNcPesosPorIds(
  notaCreditoIds: readonly string[],
  db: DbClient = prisma
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(notaCreditoIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      notaCreditoId: { in: ids },
      catMovimiento: "NOTA_CREDITO",
      cajaId: null,
    },
    select: { notaCreditoId: true, monto: true },
  });
  for (const row of rows) {
    if (!row.notaCreditoId) continue;
    out.set(row.notaCreditoId, (out.get(row.notaCreditoId) ?? 0) + row.monto);
  }
  return out;
}

export async function usadoDevolucionNcPesos(
  ncComprobanteId: string,
  db: DbClient = prisma
): Promise<number> {
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      comprobanteId: ncComprobanteId,
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
      cajaId: { not: null },
    },
    select: { monto: true },
  });
  return rows.reduce((acc, r) => acc + r.monto, 0);
}

/** Devoluciones (cobros en la propia NC) por id de NC, en lote. */
export async function usadoDevolucionNcPesosPorIds(
  ncComprobanteIds: readonly string[],
  db: DbClient = prisma
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(ncComprobanteIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      comprobanteId: { in: ids },
      catMovimiento: { in: ["COBRO", "NOTA_CREDITO"] },
      cajaId: { not: null },
    },
    select: { comprobanteId: true, monto: true },
  });
  for (const row of rows) {
    if (!row.comprobanteId) continue;
    out.set(row.comprobanteId, (out.get(row.comprobanteId) ?? 0) + row.monto);
  }
  return out;
}

export async function crearImputacionNotaCreditoMovimiento(
  args: {
    ventaId: string;
    notaCreditoId: string;
    montoPesos: number;
    orden: number;
    fechaIso: string;
    personalId: number | null;
    sucursalId: string;
    observacion?: string;
  },
  db: DbClient = prisma
): Promise<ServiceResult<{ id: string }>> {
  if (args.montoPesos <= 0) {
    return { success: false, error: "El monto de la imputación tiene que ser mayor a cero." };
  }
  const fecha = fechaNegocioLocal(args.fechaIso);
  const created = await db.tesoreriaMovimiento.create({
    data: {
      cajaId: null,
      tipoMovimiento: "EGRESO",
      catMovimiento: "NOTA_CREDITO",
      monto: args.montoPesos,
      montoAcreditado: args.montoPesos,
      fechaRegistro: fecha,
      fechaAcreditacion: fecha,
      observacion: (args.observacion ?? "").trim(),
      pagoId: null,
      entidadId: null,
      cuotaId: null,
      cxFinId: null,
      sucursalId: args.sucursalId,
      personalId: args.personalId,
      comprobanteId: args.ventaId,
      orden: args.orden,
      notaCreditoId: args.notaCreditoId,
    },
    select: { id: true },
  });
  return { success: true, data: created };
}

export async function eliminarImputacionesNotaCredito(
  notaCreditoId: string,
  db: DbClient = prisma
): Promise<{ ventaId: string; montoPesos: number }[]> {
  const rows = await db.tesoreriaMovimiento.findMany({
    where: {
      notaCreditoId,
      catMovimiento: "NOTA_CREDITO",
      cajaId: null,
      comprobanteId: { not: null },
    },
    select: { id: true, comprobanteId: true, monto: true },
  });
  if (rows.length === 0) return [];
  const porVenta = new Map<string, number>();
  for (const row of rows) {
    if (!row.comprobanteId) continue;
    porVenta.set(
      row.comprobanteId,
      (porVenta.get(row.comprobanteId) ?? 0) + row.monto
    );
  }
  await db.tesoreriaMovimiento.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
  return [...porVenta.entries()].map(([ventaId, montoPesos]) => ({
    ventaId,
    montoPesos,
  }));
}

export function esFilaCobroNotaCredito(pagoNombre: string): boolean {
  return esCobroNotaCreditoNombre(pagoNombre);
}
