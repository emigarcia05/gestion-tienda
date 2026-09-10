import type { TipoChequeTesoreria, TenenciaChequeTesoreria } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { touchUltActualizacionCajaTesoreria } from "@/lib/finTesoreriaCajaTouch";
import { CHEQUE_TESORERIA_DIAS_RETENCION_TRAS_TRANSFERENCIA } from "@/lib/finTesoreriaChequesRetencion";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
} from "@/lib/fechaArgentina";
import type { ServiceResult } from "@/types";
import type {
  ActualizarFinTesoreriaChequeInput,
  CrearFinTesoreriaChequeInput,
  FinTesoreriaChequesTenenciaFiltro,
  MarcarEntregaProveedorChequeInput,
  TransferirFinTesoreriaChequeInput,
} from "@/lib/validations/finTesoreriaCheques";
import { resolverNombreTitularFinanciero } from "@/services/globalPersonal.service";

/** Límite alineado con `montoCajaTesoreriaSchema` (cajas tesorería). */
const MONTO_CAJA_MAX = 999_999_999;
const MONTO_CAJA_MIN = -999_999_999;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface TransferirChequeFinTesoreriaResultado {
  chequeId: string;
  cajaOrigenId: string;
  cajaDestinoId: string;
  monto: number;
  montoDestinoTrasTransferencia: number;
}

export interface FinTesoreriaChequeItem {
  id: string;
  cajaId: string;
  tipo: TipoChequeTesoreria;
  tenencia: TenenciaChequeTesoreria;
  tenedor: string;
  emisor: string;
  monto: number;
  fechaAcreditacionIso: string;
  fechaRecibidoIso: string;
  fechaTransferidoIso: string | null;
  /** ISO instante UTC de la transferencia; null si sigue en caja CHEQUE. */
  fechaTransferenciaIso: string | null;
  /** Tras transferir a cuenta: `entidad - titular` de la caja destino; null si no hay destino o FK borrada. */
  cajaDestinoEtiqueta: string | null;
  /** Proveedor de mercadería al registrar pago a proveedor; null si no aplica. */
  proveedorId: string | null;
  proveedorNombre: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function etiquetaCajaDestino(
  dest: { titular: string; entidad: { nombre: string } } | null | undefined
): string | null {
  if (!dest) return null;
  return `${dest.entidad.nombre} - ${dest.titular}`;
}

function mapCheque(row: {
  id: string;
  cajaId: string;
  tipo: TipoChequeTesoreria;
  tenencia: TenenciaChequeTesoreria;
  tenedor: string;
  emisor: string;
  monto: number;
  fechaAcreditacion: Date;
  fechaRecibido: Date;
  fechaTransferido: Date | null;
  fechaTransferencia: Date | null;
  proveedorId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  cajaDestino?: { titular: string; entidad: { nombre: string } } | null;
  proveedor?: { nombre: string } | null;
}): FinTesoreriaChequeItem {
  return {
    id: row.id,
    cajaId: row.cajaId,
    tipo: row.tipo,
    tenencia: row.tenencia,
    tenedor: row.tenedor,
    emisor: row.emisor,
    monto: row.monto,
    fechaAcreditacionIso: isoYmdFromPrismaDateOnly(row.fechaAcreditacion),
    fechaRecibidoIso: isoYmdFromPrismaDateOnly(row.fechaRecibido),
    fechaTransferidoIso: row.fechaTransferido ? isoYmdFromPrismaDateOnly(row.fechaTransferido) : null,
    fechaTransferenciaIso: row.fechaTransferencia ? row.fechaTransferencia.toISOString() : null,
    cajaDestinoEtiqueta: row.fechaTransferencia ? etiquetaCajaDestino(row.cajaDestino ?? null) : null,
    proveedorId: row.proveedorId ?? null,
    proveedorNombre: row.proveedor?.nombre ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2003") return "Caja inválida.";
  }
  return error instanceof Error ? error.message : fallback;
}

/** Elimina filas transferidas más antiguas que la retención configurada (500 días). */
export async function eliminarChequesTransferidosVencidos(): Promise<void> {
  const limite = new Date(
    Date.now() - CHEQUE_TESORERIA_DIAS_RETENCION_TRAS_TRANSFERENCIA * MS_POR_DIA
  );
  await prisma.finTesoreriaCheque.deleteMany({
    where: {
      fechaTransferencia: { not: null, lt: limite },
    },
  });
}

/** Suma `monto` por caja con `fecha_acreditacion` <= `hoyIso` (comparación en DATE). Solo cheques no transferidos. */
export async function sumarMontosChequesAcreditadosHasta(
  hoyIso: string
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ caja_id: string; suma: bigint }>>`
    SELECT "caja_id", COALESCE(SUM("monto"), 0)::bigint AS suma
    FROM "fin_tesoreria_cheques"
    WHERE "fecha_transferencia" IS NULL
      AND "fecha_acreditacion" <= ${hoyIso}::date
    GROUP BY "caja_id"
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.caja_id, Number(r.suma));
  }
  return map;
}

/** Suma `monto` por caja con `fecha_acreditacion` > `hoyIso` (cheques diferidos; comparación en DATE). Solo no transferidos. */
export async function sumarMontosChequesDiferidosPorCaja(
  hoyIso: string
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ caja_id: string; suma: bigint }>>`
    SELECT "caja_id", COALESCE(SUM("monto"), 0)::bigint AS suma
    FROM "fin_tesoreria_cheques"
    WHERE "fecha_transferencia" IS NULL
      AND "fecha_acreditacion" > ${hoyIso}::date
    GROUP BY "caja_id"
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.caja_id, Number(r.suma));
  }
  return map;
}

/**
 * Por cada fecha de acreditación **posterior** a `hoyIso`, suma de montos que ingresan a “caja líquida” ese día (calendario Argentina).
 * Usado en Flujo de fondo para proyectar disponibilidad cuando vence la fecha del cheque.
 */
export async function sumarMontosChequesDiferidosPorFechaAcreditacion(
  hoyIso: string
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ fecha: string; suma: bigint }>>`
    SELECT to_char("fecha_acreditacion", 'YYYY-MM-DD') AS fecha,
           COALESCE(SUM("monto"), 0)::bigint AS suma
    FROM "fin_tesoreria_cheques"
    WHERE "fecha_transferencia" IS NULL
      AND "fecha_acreditacion" > ${hoyIso}::date
    GROUP BY "fecha_acreditacion"
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.fecha, Number(r.suma));
  }
  return map;
}

export async function listarChequesPorCajaId(
  cajaId: string,
  tenenciaFiltro: FinTesoreriaChequesTenenciaFiltro = "actuales"
): Promise<FinTesoreriaChequeItem[]> {
  await eliminarChequesTransferidosVencidos();

  const where =
    tenenciaFiltro === "actuales"
      ? { cajaId, fechaTransferencia: null, tenencia: "TIENDA" as const }
      : { cajaId, tenencia: { in: ["DEPOSITADO" as const, "PROVEEDOR" as const] } };

  const orderBy =
    tenenciaFiltro === "actuales"
      ? [{ fechaAcreditacion: "desc" as const }, { createdAt: "desc" as const }]
      : [{ fechaAcreditacion: "desc" as const }, { createdAt: "desc" as const }];

  const rows = await prisma.finTesoreriaCheque.findMany({
    where,
    orderBy,
    include: {
      cajaDestino: { select: { titular: true, entidad: { select: { nombre: true } } } },
      proveedor: { select: { nombre: true } },
    },
  });
  return rows.map(mapCheque);
}

export async function crearFinTesoreriaCheque(
  input: CrearFinTesoreriaChequeInput
): Promise<ServiceResult<FinTesoreriaChequeItem>> {
  const caja = await prisma.cajaTesoreria.findUnique({
    where: { id: input.cajaId },
    select: { id: true, tipoCaja: true },
  });
  if (!caja) {
    return { success: false, error: "Caja no encontrada." };
  }
  if (caja.tipoCaja !== "CHEQUE") {
    return { success: false, error: "Solo se pueden registrar cheques en cajas tipo CHEQUE." };
  }

  const tenedorOk = await resolverNombreTitularFinanciero(input.tenedor);
  if (!tenedorOk.success) return tenedorOk;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.finTesoreriaCheque.create({
        data: {
          cajaId: input.cajaId,
          tipo: input.tipo,
          tenedor: tenedorOk.data,
          emisor: input.emisor.trim(),
          monto: input.monto,
          fechaAcreditacion: new Date(`${input.fechaAcreditacion}T12:00:00.000Z`),
          fechaRecibido: new Date(`${input.fechaRecibido}T12:00:00.000Z`),
        },
        include: {
          cajaDestino: { select: { titular: true, entidad: { select: { nombre: true } } } },
          proveedor: { select: { nombre: true } },
        },
      });
      await touchUltActualizacionCajaTesoreria(input.cajaId, tx);
      return created;
    });
    return {
      success: true,
      data: mapCheque({
        ...row,
        fechaTransferencia: null,
        fechaTransferido: null,
        cajaDestino: null,
        proveedorId: null,
        proveedor: null,
      }),
    };
  } catch (error: unknown) {
    const msg = mapDbError(error, "No se pudo registrar el cheque.");
    if (typeof error === "object" && error !== null && "message" in error) {
      const m = String((error as { message: unknown }).message);
      if (m.includes("fin_tesoreria_cheques:")) {
        return { success: false, error: "La caja debe ser de tipo CHEQUE." };
      }
    }
    return { success: false, error: msg };
  }
}

export async function actualizarFinTesoreriaCheque(
  input: ActualizarFinTesoreriaChequeInput
): Promise<ServiceResult<FinTesoreriaChequeItem>> {
  const existente = await prisma.finTesoreriaCheque.findUnique({
    where: { id: input.id },
    include: { caja: { select: { tipoCaja: true } } },
  });
  if (!existente) {
    return { success: false, error: "Cheque no encontrado." };
  }
  if (existente.caja.tipoCaja !== "CHEQUE") {
    return { success: false, error: "Solo se pueden editar cheques de cajas tipo CHEQUE." };
  }
  if (existente.fechaTransferencia != null) {
    return { success: false, error: "No se puede editar un cheque ya transferido a una cuenta." };
  }

  const tenedorOk = await resolverNombreTitularFinanciero(input.tenedor, existente.tenedor);
  if (!tenedorOk.success) return tenedorOk;

  try {
    const row = await prisma.finTesoreriaCheque.update({
      where: { id: input.id },
      data: {
        tipo: input.tipo,
        tenedor: tenedorOk.data,
        emisor: input.emisor.trim(),
        monto: input.monto,
        fechaAcreditacion: new Date(`${input.fechaAcreditacion}T12:00:00.000Z`),
        fechaRecibido: new Date(`${input.fechaRecibido}T12:00:00.000Z`),
      },
      include: {
        cajaDestino: { select: { titular: true, entidad: { select: { nombre: true } } } },
        proveedor: { select: { nombre: true } },
      },
    });
    return {
      success: true,
      data: mapCheque(row),
    };
  } catch (error: unknown) {
    return { success: false, error: mapDbError(error, "No se pudo actualizar el cheque.") };
  }
}

export interface ProveedorMercaderiaChequeTesoreriaItem {
  id: string;
  nombre: string;
  prefijo: string | null;
}

/** Proveedores con `proveedor_mercaderia` para elegir en pago de cheque (tesorería). */
export async function listarProveedoresMercaderiaParaPagoChequeTesoreria(): Promise<
  ProveedorMercaderiaChequeTesoreriaItem[]
> {
  const rows = await prisma.proveedor.findMany({
    where: { proveedorMercaderia: true },
    select: { id: true, nombre: true, prefijo: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    prefijo: r.prefijo,
  }));
}

/**
 * Transfiere el importe del cheque a otra caja (`fin_tesoreria.monto`) y marca el cheque como transferido.
 * El registro se conserva en BD durante {@link CHEQUE_TESORERIA_DIAS_RETENCION_TRAS_TRANSFERENCIA} días y luego se purga.
 * Requiere `fecha_acreditacion` ≤ hoy (calendario Argentina).
 * Destino: `tipo_valor = DIGITAL` y `tipo_caja = BANCO`.
 */
export async function transferirChequeFinTesoreria(
  input: TransferirFinTesoreriaChequeInput
): Promise<ServiceResult<TransferirChequeFinTesoreriaResultado>> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const fechaTransferidoDia = new Date(`${hoyIso}T12:00:00.000Z`);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const cheque = await tx.finTesoreriaCheque.findUnique({
        where: { id: input.chequeId },
      });
      if (!cheque) {
        throw new Error("CHEQUE_NOT_FOUND");
      }
      if (cheque.fechaTransferencia != null) {
        throw new Error("CHEQUE_YA_TRANSFERIDO");
      }

      const fechaChequeIso = isoYmdFromPrismaDateOnly(cheque.fechaAcreditacion);
      if (fechaChequeIso > hoyIso) {
        throw new Error("CHEQUE_NO_ACREDITADO");
      }

      if (cheque.cajaId === input.cajaDestinoId) {
        throw new Error("DESTINO_IGUAL_ORIGEN");
      }

      const destino = await tx.cajaTesoreria.findUnique({
        where: { id: input.cajaDestinoId },
      });
      if (!destino) {
        throw new Error("DESTINO_NOT_FOUND");
      }
      if (destino.tipoValor !== "DIGITAL") {
        throw new Error("DESTINO_NO_TIPO_VALOR_DIGITAL");
      }
      if (destino.tipoCaja !== "BANCO") {
        throw new Error("DESTINO_NO_TIPO_CAJA_BANCO");
      }

      const nuevoSaldo = destino.monto + cheque.monto;
      if (nuevoSaldo > MONTO_CAJA_MAX || nuevoSaldo < MONTO_CAJA_MIN) {
        throw new Error("SALDO_DESTINO_FUERA_DE_RANGO");
      }

      await tx.cajaTesoreria.update({
        where: { id: input.cajaDestinoId },
        data: { monto: { increment: cheque.monto } },
      });

      await tx.finTesoreriaCheque.update({
        where: { id: cheque.id },
        data: {
          fechaTransferencia: new Date(),
          cajaDestinoId: input.cajaDestinoId,
          tenencia: "DEPOSITADO",
          fechaTransferido: fechaTransferidoDia,
        },
      });

      await touchUltActualizacionCajaTesoreria(cheque.cajaId, tx);

      return {
        chequeId: cheque.id,
        cajaOrigenId: cheque.cajaId,
        cajaDestinoId: input.cajaDestinoId,
        monto: cheque.monto,
        montoDestinoTrasTransferencia: nuevoSaldo,
      };
    });

    await eliminarChequesTransferidosVencidos();

    return { success: true, data: resultado };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "CHEQUE_NOT_FOUND") {
        return { success: false, error: "Cheque no encontrado." };
      }
      if (error.message === "CHEQUE_YA_TRANSFERIDO") {
        return { success: false, error: "Este cheque ya fue transferido." };
      }
      if (error.message === "CHEQUE_NO_ACREDITADO") {
        return {
          success: false,
          error:
            "No se puede transferir: la fecha de acreditación del cheque es posterior a hoy.",
        };
      }
      if (error.message === "DESTINO_IGUAL_ORIGEN") {
        return {
          success: false,
          error: "La caja destino debe ser distinta de la caja donde está el cheque.",
        };
      }
      if (error.message === "DESTINO_NOT_FOUND") {
        return { success: false, error: "Caja destino no encontrada." };
      }
      if (error.message === "DESTINO_NO_TIPO_VALOR_DIGITAL") {
        return {
          success: false,
          error:
            "La acreditación solo puede hacerse hacia una caja con tipo de valor DIGITAL.",
        };
      }
      if (error.message === "DESTINO_NO_TIPO_CAJA_BANCO") {
        return {
          success: false,
          error: "La acreditación solo puede hacerse hacia una caja con tipo BANCO.",
        };
      }
      if (error.message === "SALDO_DESTINO_FUERA_DE_RANGO") {
        return {
          success: false,
          error: "El saldo de la caja destino superaría el máximo permitido.",
        };
      }
    }
    return {
      success: false,
      error: mapDbError(error, "No se pudo transferir el cheque."),
    };
  }
}

/**
 * Marca custodia PROVEEDOR, asigna proveedor y persiste **`fecha_transferencia`**
 * (no modifica saldos de caja; el cheque deja de sumar en disponibilidad/diferidos al tener transferencia).
 */
export async function marcarEntregaProveedorFinTesoreriaCheque(
  input: MarcarEntregaProveedorChequeInput
): Promise<ServiceResult<FinTesoreriaChequeItem>> {
  const hoyIso = dateToIsoYmdArgentina(new Date());
  if (input.fechaTransferencia > hoyIso) {
    return {
      success: false,
      error: "La fecha de transferencia no puede ser posterior a hoy.",
    };
  }

  const existente = await prisma.finTesoreriaCheque.findUnique({
    where: { id: input.chequeId },
    select: { fechaTransferencia: true, cajaId: true },
  });
  if (!existente) {
    return { success: false, error: "Cheque no encontrado." };
  }
  if (existente.fechaTransferencia != null) {
    return {
      success: false,
      error: "No se puede registrar pago a proveedor en un cheque ya transferido.",
    };
  }

  const prov = await prisma.proveedor.findUnique({
    where: { id: input.proveedorId },
    select: { proveedorMercaderia: true },
  });
  if (!prov) {
    return { success: false, error: "Proveedor no encontrado." };
  }
  if (!prov.proveedorMercaderia) {
    return {
      success: false,
      error: "Solo se pueden asignar proveedores de mercadería.",
    };
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.finTesoreriaCheque.update({
        where: { id: input.chequeId },
        data: {
          tenencia: "PROVEEDOR",
          proveedorId: input.proveedorId,
          fechaTransferencia: new Date(`${input.fechaTransferencia}T12:00:00.000Z`),
        },
        include: {
          cajaDestino: { select: { titular: true, entidad: { select: { nombre: true } } } },
          proveedor: { select: { nombre: true } },
        },
      });
      await touchUltActualizacionCajaTesoreria(existente.cajaId, tx);
      return updated;
    });
    return { success: true, data: mapCheque(row) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo registrar el pago a proveedor."),
    };
  }
}

export async function eliminarFinTesoreriaCheque(id: string): Promise<ServiceResult<void>> {
  const row = await prisma.finTesoreriaCheque.findUnique({
    where: { id },
    select: { fechaTransferencia: true },
  });
  if (!row) {
    return { success: false, error: "Cheque no encontrado." };
  }
  if (row.fechaTransferencia != null) {
    return {
      success: false,
      error: "No se puede eliminar un cheque con fecha de transferencia registrada.",
    };
  }

  try {
    await prisma.finTesoreriaCheque.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return { success: false, error: "Cheque no encontrado." };
    }
    return { success: false, error: mapDbError(error, "No se pudo eliminar el cheque.") };
  }
}
