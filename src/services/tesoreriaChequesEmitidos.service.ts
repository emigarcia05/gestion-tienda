import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { etiquetaCajaTesoreria } from "@/lib/cajasTesoreriaTipos";
import { imputarPagoFifoVentas } from "@/lib/factura";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  prismaDateOnlyFromIsoYmd,
} from "@/lib/fechaArgentina";
import type { EmitirEcheqPagoProveedorInput } from "@/lib/validations/controlComprobantes";
import {
  aplicarImputacionesCompra,
  listarComprobantesCompraPendientesPago,
  validarMontoContraSaldoProveedor,
} from "@/services/controlComprobantes.service";
import { sucursalIdMovimientoOperador } from "@/services/tesoreriaMovimientos.service";
import type { ServiceResult } from "@/types";

export type CajaEmiteChequeOpcion = { id: string; etiqueta: string };

export type ChequeEmitidoFila = {
  id: string;
  numero: string;
  proveedorNombre: string;
  fechaEmisionIso: string;
  fechaPagoIso: string;
  monto: number;
  estado: "EMITIDO" | "ANULADO";
  /** EMITIDO con `fecha_pago` posterior a hoy (aún no se debitó). */
  puedeAnular: boolean;
};

export type ChequesEmitidosCaja = {
  cheques: ChequeEmitidoFila[];
  /** Σ EMITIDO con `fecha_pago` > hoy. */
  totalADebitar: number;
};

/** Columna DETALLE de Flujo de Fondos para un eCheq pendiente de débito. */
export const FLUJO_FONDO_DETALLE_ECHEQ = "ECHEQ";

/** eCheq EMITIDO pendiente de débito (VENCIMIENTOS de Flujo de Fondos). */
export type ChequeEmitidoFlujoFila = {
  id: string;
  numero: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  fechaEmisionIso: string;
  fechaPagoIso: string;
  monto: number;
};

const CAJA_ETIQUETA_SELECT = {
  titular: true,
  tipoCaja: true,
  entidad: { select: { nombre: true } },
  sucursal: { select: { nombre: true } },
} as const;

function roundArs2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hoyIso(): string {
  return dateToIsoYmdArgentina(new Date());
}

function fechaDb(iso: string): Date {
  const fecha = prismaDateOnlyFromIsoYmd(iso);
  if (!fecha) throw new Error("fecha-invalida");
  return fecha;
}

/** eCheqs EMITIDO de la caja con `fecha_pago` > hoy (impide quitar `emite_cheque`). */
export async function contarChequesEmitidosPendientesCaja(cajaId: string): Promise<number> {
  return prisma.tesoreriaChequeEmitido.count({
    where: { cajaId, estado: "EMITIDO", fechaPago: { gt: fechaDb(hoyIso()) } },
  });
}

/** Cajas con `emite_cheque` (origen posible de un eCheq). */
export async function listarCajasEmiteCheque(): Promise<CajaEmiteChequeOpcion[]> {
  const rows = await prisma.cajaTesoreria.findMany({
    where: { emiteCheque: true },
    select: { id: true, ...CAJA_ETIQUETA_SELECT },
  });
  return rows
    .map((row) => ({ id: row.id, etiqueta: etiquetaCajaTesoreria(row) }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/**
 * Pago cuenta corriente con eCheq propio:
 * imputa FIFO a los comprobantes del proveedor, registra el cheque y un EGRESO
 * PAGO_PROVEEDOR en la caja con `fecha_acreditacion = fecha_pago` (todo en una transacción).
 */
export async function emitirEcheqPagoProveedor(
  input: EmitirEcheqPagoProveedorInput & { personalId: number }
): Promise<ServiceResult<{ id: string }>> {
  try {
    const [proveedor, caja] = await Promise.all([
      prisma.proveedor.findUnique({
        where: { idProveedorDux: input.idProveedorDux },
        select: { id: true, nombre: true },
      }),
      prisma.cajaTesoreria.findUnique({
        where: { id: input.cajaId },
        select: { id: true, emiteCheque: true, sucursalId: true },
      }),
    ]);
    if (!proveedor) return { success: false, error: "Proveedor inválido." };
    if (!caja) return { success: false, error: "Caja inválida." };
    if (!caja.emiteCheque) {
      return { success: false, error: "La caja no está habilitada para emitir cheques." };
    }

    const montoPesos = roundArs2(input.montoCents / 100);
    const montoLedger = Math.round(montoPesos);
    if (montoLedger <= 0) return { success: false, error: "Ingresá un monto a pagar." };

    const pendientes = await listarComprobantesCompraPendientesPago(input.idProveedorDux);
    const saldoOk = validarMontoContraSaldoProveedor(pendientes, montoPesos);
    if (!saldoOk.success) return saldoOk;
    const imputaciones = imputarPagoFifoVentas(pendientes, montoPesos).filter(
      (fila) => fila.asignado > 0
    );

    const sucursal = await sucursalIdMovimientoOperador(input.personalId, caja.sucursalId);
    if (!sucursal.success) return sucursal;

    const fechaEmision = fechaDb(input.fechaEmision);
    const fechaPago = fechaDb(input.fechaPago);
    const nombreProveedor = proveedor.nombre.toLocaleUpperCase("es-AR");
    const observacion =
      input.observacion ||
      `eCheq${input.numero ? ` ${input.numero}` : ""} a ${nombreProveedor}`;

    const cheque = await prisma.$transaction(async (tx) => {
      await aplicarImputacionesCompra(tx, imputaciones);
      const creado = await tx.tesoreriaChequeEmitido.create({
        data: {
          cajaId: caja.id,
          proveedorId: proveedor.id,
          tipo: "ECHEQ",
          numero: input.numero,
          monto: new Prisma.Decimal(montoPesos.toFixed(2)),
          fechaEmision,
          fechaPago,
          observacion,
          personalId: input.personalId,
          imputaciones: {
            create: imputaciones.map((fila) => ({
              comprobanteId: fila.id,
              monto: new Prisma.Decimal(roundArs2(fila.asignado).toFixed(2)),
            })),
          },
        },
        select: { id: true },
      });
      await tx.tesoreriaMovimiento.create({
        data: {
          cajaId: caja.id,
          tipoMovimiento: "EGRESO",
          catMovimiento: "PAGO_PROVEEDOR",
          monto: montoLedger,
          montoAcreditado: montoLedger,
          fechaRegistro: fechaEmision,
          fechaAcreditacion: fechaPago,
          observacion,
          sucursalId: sucursal.data,
          personalId: input.personalId,
          chequeEmitidoId: creado.id,
        },
      });
      return creado;
    });
    return { success: true, data: cheque };
  } catch (e) {
    if (e instanceof Error && e.message === "saldo-cambio") {
      return {
        success: false,
        error: "El saldo de un comprobante cambió. Recargá e intentá de nuevo.",
      };
    }
    console.error("[emitirEcheqPagoProveedor]", e);
    return { success: false, error: "No se pudo emitir el eCheq." };
  }
}

/**
 * Anula un eCheq EMITIDO que aún no se debitó (`fecha_pago` > hoy):
 * revierte las imputaciones a comprobantes y borra el egreso diferido.
 */
export async function anularChequeEmitido(id: string): Promise<ServiceResult<void>> {
  try {
    const cheque = await prisma.tesoreriaChequeEmitido.findUnique({
      where: { id },
      select: { id: true, estado: true, fechaPago: true },
    });
    if (!cheque) return { success: false, error: "Cheque inexistente." };
    if (cheque.estado !== "EMITIDO") {
      return { success: false, error: "El cheque ya está anulado." };
    }
    const hoy = hoyIso();
    if (isoYmdFromPrismaDateOnly(cheque.fechaPago) <= hoy) {
      return {
        success: false,
        error: "El cheque ya se debitó (fecha de pago hasta hoy): no se puede anular.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const marcado = await tx.tesoreriaChequeEmitido.updateMany({
        where: { id, estado: "EMITIDO" },
        data: { estado: "ANULADO", fechaAnulacion: fechaDb(hoy) },
      });
      if (marcado.count !== 1) throw new Error("cheque-cambio");

      const imputaciones = await tx.tesoreriaChequeEmitidoImputacion.findMany({
        where: { chequeEmitidoId: id },
        select: { comprobanteId: true, monto: true },
      });
      for (const imp of imputaciones) {
        const row = await tx.comprobanteProveedor.findUnique({
          where: { id: imp.comprobanteId },
          select: { montoAplicado: true },
        });
        if (!row) continue;
        const nuevo = Math.max(0, roundArs2(Number(row.montoAplicado) - Number(imp.monto)));
        await tx.comprobanteProveedor.update({
          where: { id: imp.comprobanteId },
          data: { montoAplicado: new Prisma.Decimal(nuevo.toFixed(2)) },
        });
      }
      await tx.tesoreriaChequeEmitidoImputacion.deleteMany({ where: { chequeEmitidoId: id } });
      await tx.tesoreriaMovimiento.deleteMany({ where: { chequeEmitidoId: id } });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "cheque-cambio") {
      return { success: false, error: "El cheque cambió. Recargá la página." };
    }
    console.error("[anularChequeEmitido]", e);
    return { success: false, error: "No se pudo anular el cheque." };
  }
}

/** eCheq emitidos desde una caja (más recientes primero) + total a debitar. */
export async function listarChequesEmitidosDeCaja(
  cajaId: string
): Promise<ServiceResult<ChequesEmitidosCaja>> {
  const caja = await prisma.cajaTesoreria.findUnique({
    where: { id: cajaId },
    select: { emiteCheque: true },
  });
  if (!caja) return { success: false, error: "Caja inexistente." };

  const hoy = hoyIso();
  const rows = await prisma.tesoreriaChequeEmitido.findMany({
    where: { cajaId },
    orderBy: [{ fechaPago: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      numero: true,
      fechaEmision: true,
      fechaPago: true,
      monto: true,
      estado: true,
      proveedor: { select: { nombre: true } },
    },
  });
  let totalADebitar = 0;
  const cheques = rows.map((row) => {
    const fechaPagoIso = isoYmdFromPrismaDateOnly(row.fechaPago);
    const monto = Number(row.monto);
    const pendiente = row.estado === "EMITIDO" && fechaPagoIso > hoy;
    if (pendiente) totalADebitar = roundArs2(totalADebitar + monto);
    return {
      id: row.id,
      numero: row.numero,
      proveedorNombre: row.proveedor.nombre.toLocaleUpperCase("es-AR"),
      fechaEmisionIso: isoYmdFromPrismaDateOnly(row.fechaEmision),
      fechaPagoIso,
      monto,
      estado: row.estado,
      puedeAnular: pendiente,
    };
  });
  return { success: true, data: { cheques, totalADebitar } };
}

/**
 * eCheq EMITIDO con `fecha_pago` en `[desdeIso, hastaIso]`.
 * Flujo de Fondos pide desde mañana: los de hoy ya descuentan del disponible.
 */
export async function listarChequesEmitidosPendientesEnRango(
  desdeIso: string,
  hastaIso: string
): Promise<ChequeEmitidoFlujoFila[]> {
  const rows = await prisma.tesoreriaChequeEmitido.findMany({
    where: {
      estado: "EMITIDO",
      fechaPago: { gte: fechaDb(desdeIso), lte: fechaDb(hastaIso) },
    },
    orderBy: [{ fechaPago: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      numero: true,
      fechaEmision: true,
      fechaPago: true,
      monto: true,
      proveedor: { select: { nombre: true, prefijo: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    numero: row.numero,
    proveedorNombre: row.proveedor.nombre.trim().toLocaleUpperCase("es-AR"),
    proveedorPrefijo: (row.proveedor.prefijo ?? "").trim().toLocaleUpperCase("es-AR"),
    fechaEmisionIso: isoYmdFromPrismaDateOnly(row.fechaEmision),
    fechaPagoIso: isoYmdFromPrismaDateOnly(row.fechaPago),
    monto: Number(row.monto),
  }));
}
