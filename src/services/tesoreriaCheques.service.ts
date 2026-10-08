import { randomUUID } from "node:crypto";
import { Prisma, type EstadoChequeTesoreria } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { etiquetaCajaTesoreria } from "@/lib/cajasTesoreriaTipos";
import { imputarPagoFifoVentas, type FacturaVentaPendientePago } from "@/lib/factura";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  prismaDateOnlyFromIsoYmd,
} from "@/lib/fechaArgentina";
import type {
  DepositarChequesInput,
  PagarProveedorConChequesInput,
} from "@/lib/validations/tesoreriaCheques";
import type { ServiceResult } from "@/types";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const ETIQUETA_ESTADO_CHEQUE: Record<EstadoChequeTesoreria, string> = {
  EN_CARTERA: "EN CARTERA",
  DEPOSITADO: "DEPOSITADO",
  ENTREGADO_PROVEEDOR: "ENTREGADO A PROVEEDOR",
};

export type TesoreriaChequeFila = {
  id: string;
  monto: number;
  montoAcreditado: number;
  fechaRecepcionIso: string;
  fechaPagoIso: string;
  clienteNombre: string;
  comprobanteId: string | null;
  comprobanteEtiqueta: string;
  estado: EstadoChequeTesoreria;
  estadoEtiqueta: string;
  cajaEtiqueta: string;
  fechaSalidaIso: string;
  /** Caja propia (DEPOSITADO) o proveedor (ENTREGADO_PROVEEDOR). */
  destinoEtiqueta: string;
};

export type CajaDepositoChequeOpcion = { id: string; etiqueta: string };

export type ProveedorPagoChequeOpcion = {
  id: string;
  nombre: string;
  saldoPendiente: number;
};

function roundArs2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hoyNegocio(): { iso: string; fecha: Date } {
  const iso = dateToIsoYmdArgentina(new Date());
  const fecha = prismaDateOnlyFromIsoYmd(iso);
  if (!fecha) throw new Error("fecha-hoy-invalida");
  return { iso, fecha };
}

function etiquetaComprobante(c: { ptoVenta: string; cbteNro: number | null } | null): string {
  if (!c || c.cbteNro == null) return "";
  return `${c.ptoVenta}-${c.cbteNro.toString().padStart(8, "0")}`;
}

const CAJA_ETIQUETA_SELECT = {
  titular: true,
  tipoCaja: true,
  entidad: { select: { nombre: true } },
  sucursal: { select: { nombre: true } },
} as const;

/**
 * Alta EN_CARTERA desde un cobro a caja CHEQUE (misma transacción que el movimiento).
 * Cliente: el de la venta (`comprobanteId`) o el del pago CC (`clienteCobroId`).
 */
export async function crearChequeEnCarteraDesdeCobro(
  args: {
    cajaId: string;
    monto: number;
    montoAcreditado: number;
    fechaRecepcion: Date;
    fechaPago: Date;
    comprobanteId: string | null;
    clienteCobroId: string | null;
  },
  db: DbClient = prisma
): Promise<{ id: string }> {
  let clienteId: string | null = null;
  let clienteNombre = "";
  if (args.comprobanteId) {
    const venta = await db.comprobanteVta.findUnique({
      where: { id: args.comprobanteId },
      select: {
        clienteId: true,
        receptorNombre: true,
        cliente: { select: { nombreCompleto: true } },
      },
    });
    clienteId = venta?.clienteId ?? null;
    clienteNombre = venta?.cliente?.nombreCompleto ?? venta?.receptorNombre ?? "";
  } else if (args.clienteCobroId) {
    const cobro = await db.clienteCobro.findUnique({
      where: { id: args.clienteCobroId },
      select: { clienteId: true, cliente: { select: { nombreCompleto: true } } },
    });
    clienteId = cobro?.clienteId ?? null;
    clienteNombre = cobro?.cliente.nombreCompleto ?? "";
  }
  return db.tesoreriaCheque.create({
    data: {
      cajaId: args.cajaId,
      monto: args.monto,
      montoAcreditado: args.montoAcreditado,
      fechaRecepcion: args.fechaRecepcion,
      fechaPago: args.fechaPago,
      clienteId,
      clienteNombre: clienteNombre.trim().toLocaleUpperCase("es-AR"),
      comprobanteId: args.comprobanteId,
      clienteCobroId: args.clienteCobroId,
    },
    select: { id: true },
  });
}

/**
 * Antes de borrar movimientos de cobro (reescritura de cobros / baja de comprobante):
 * devuelve los cheques ligados. Falla si alguno ya salió de cartera.
 */
export async function chequesEnCarteraDeMovimientos(
  where: Prisma.TesoreriaMovimientoWhereInput,
  db: DbClient = prisma
): Promise<ServiceResult<string[]>> {
  const movs = await db.tesoreriaMovimiento.findMany({
    where: { ...where, chequeId: { not: null } },
    select: { cheque: { select: { id: true, estado: true } } },
  });
  const cheques = new Map<string, EstadoChequeTesoreria>();
  for (const m of movs) {
    if (m.cheque) cheques.set(m.cheque.id, m.cheque.estado);
  }
  if ([...cheques.values()].some((estado) => estado !== "EN_CARTERA")) {
    return {
      success: false,
      error: "El cobro tiene un cheque que ya se depositó o se entregó a un proveedor.",
    };
  }
  return { success: true, data: [...cheques.keys()] };
}

/** Borra cheques EN_CARTERA cuyos movimientos de entrada ya se eliminaron. */
export async function eliminarChequesSinMovimientos(
  ids: readonly string[],
  db: DbClient = prisma
): Promise<void> {
  if (ids.length === 0) return;
  await db.tesoreriaCheque.deleteMany({
    where: { id: { in: [...ids] }, estado: "EN_CARTERA", movimientos: { none: {} } },
  });
}

export async function listarChequesTesoreria(): Promise<TesoreriaChequeFila[]> {
  const rows = await prisma.tesoreriaCheque.findMany({
    orderBy: [{ fechaPago: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      monto: true,
      montoAcreditado: true,
      fechaRecepcion: true,
      fechaPago: true,
      clienteNombre: true,
      estado: true,
      fechaSalida: true,
      comprobante: { select: { id: true, ptoVenta: true, cbteNro: true } },
      caja: { select: CAJA_ETIQUETA_SELECT },
      cajaDestino: { select: CAJA_ETIQUETA_SELECT },
      proveedor: { select: { nombre: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    monto: row.monto,
    montoAcreditado: row.montoAcreditado,
    fechaRecepcionIso: isoYmdFromPrismaDateOnly(row.fechaRecepcion),
    fechaPagoIso: isoYmdFromPrismaDateOnly(row.fechaPago),
    clienteNombre: row.clienteNombre,
    comprobanteId: row.comprobante?.id ?? null,
    comprobanteEtiqueta: etiquetaComprobante(row.comprobante),
    estado: row.estado,
    estadoEtiqueta: ETIQUETA_ESTADO_CHEQUE[row.estado],
    cajaEtiqueta: etiquetaCajaTesoreria(row.caja),
    fechaSalidaIso: row.fechaSalida ? isoYmdFromPrismaDateOnly(row.fechaSalida) : "",
    destinoEtiqueta: row.cajaDestino
      ? etiquetaCajaTesoreria(row.cajaDestino)
      : (row.proveedor?.nombre.toLocaleUpperCase("es-AR") ?? ""),
  }));
}

/** Cajas propias donde se puede depositar (todas menos CHEQUE). */
export async function listarCajasDepositoCheque(): Promise<CajaDepositoChequeOpcion[]> {
  const rows = await prisma.cajaTesoreria.findMany({
    where: { tipoCaja: { not: "CHEQUE" } },
    select: { id: true, ...CAJA_ETIQUETA_SELECT },
  });
  return rows
    .map((row) => ({ id: row.id, etiqueta: etiquetaCajaTesoreria(row) }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

async function comprobantesPendientesProveedor(
  idProveedorDux: string,
  db: DbClient
): Promise<FacturaVentaPendientePago[]> {
  const rows = await db.comprobanteProveedor.findMany({
    where: { idProveedor: idProveedorDux, tipoComp: { not: "NOTA_CREDITO" } },
    select: { id: true, fechaComp: true, comprobante: true, total: true, montoAplicado: true },
    orderBy: [{ fechaComp: "asc" }, { comprobante: "asc" }],
  });
  return rows
    .map((r) => ({
      id: r.id,
      nroComprobante: r.comprobante,
      fechaIso: isoYmdFromPrismaDateOnly(r.fechaComp),
      saldoPendiente: roundArs2(Number(r.total) - Number(r.montoAplicado)),
    }))
    .filter((r) => r.saldoPendiente > 0);
}

/** Proveedores con comprobantes de compra impagos (saldo = Σ total − monto aplicado). */
export async function listarProveedoresPagoCheque(): Promise<ProveedorPagoChequeOpcion[]> {
  const rows = await prisma.comprobanteProveedor.findMany({
    where: { tipoComp: { not: "NOTA_CREDITO" } },
    select: {
      total: true,
      montoAplicado: true,
      proveedor: { select: { id: true, nombre: true } },
    },
  });
  const porProveedor = new Map<string, ProveedorPagoChequeOpcion>();
  for (const r of rows) {
    const saldo = roundArs2(Number(r.total) - Number(r.montoAplicado));
    if (saldo <= 0) continue;
    const actual = porProveedor.get(r.proveedor.id) ?? {
      id: r.proveedor.id,
      nombre: r.proveedor.nombre.toLocaleUpperCase("es-AR"),
      saldoPendiente: 0,
    };
    actual.saldoPendiente = roundArs2(actual.saldoPendiente + saldo);
    porProveedor.set(r.proveedor.id, actual);
  }
  return [...porProveedor.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

type ChequeParaSalida = {
  id: string;
  cajaId: string;
  monto: number;
  montoAcreditado: number;
  fechaPago: Date;
};

async function chequesEnCartera(
  ids: readonly string[],
  db: DbClient
): Promise<ServiceResult<ChequeParaSalida[]>> {
  const unicos = [...new Set(ids)];
  const rows = await db.tesoreriaCheque.findMany({
    where: { id: { in: unicos } },
    select: {
      id: true,
      cajaId: true,
      monto: true,
      montoAcreditado: true,
      fechaPago: true,
      estado: true,
    },
  });
  if (rows.length !== unicos.length) {
    return { success: false, error: "Hay cheques que ya no existen. Recargá la página." };
  }
  if (rows.some((r) => r.estado !== "EN_CARTERA")) {
    return { success: false, error: "Hay cheques que ya no están en cartera. Recargá la página." };
  }
  return { success: true, data: rows };
}

async function sucursalOperador(
  personalId: number,
  sucursalCajaId: string | null
): Promise<ServiceResult<string>> {
  const personal = await prisma.globalPersonal.findUnique({
    where: { idPersonal: personalId },
    select: { sucursalPorDefecto: true },
  });
  if (!personal) return { success: false, error: "Usuario inválido." };
  if (personal.sucursalPorDefecto) {
    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: personal.sucursalPorDefecto },
      select: { id: true },
    });
    if (sucursal) return { success: true, data: sucursal.id };
  }
  if (sucursalCajaId) return { success: true, data: sucursalCajaId };
  return { success: false, error: "El usuario no tiene sucursal para registrar el movimiento." };
}

const ERRORES_TX = new Set(["cheque-cambio", "saldo-cambio"]);

function errorTx(e: unknown): ServiceResult<never> | null {
  if (!(e instanceof Error) || !ERRORES_TX.has(e.message)) return null;
  return {
    success: false,
    error:
      e.message === "cheque-cambio"
        ? "Hay cheques que ya no están en cartera. Recargá la página."
        : "El saldo de un comprobante cambió. Recargá e intentá de nuevo.",
  };
}

/** Marca la salida solo si sigue EN_CARTERA (evita doble uso concurrente). */
async function marcarSalida(
  tx: Prisma.TransactionClient,
  chequeId: string,
  data: Prisma.TesoreriaChequeUncheckedUpdateManyInput
): Promise<void> {
  const res = await tx.tesoreriaCheque.updateMany({
    where: { id: chequeId, estado: "EN_CARTERA" },
    data,
  });
  if (res.count !== 1) throw new Error("cheque-cambio");
}

/**
 * Depósito en caja propia: por cheque, transferencia CHEQUE → caja destino (hoy).
 * Solo cheques con fecha de pago ≤ hoy.
 */
export async function depositarCheques(
  input: DepositarChequesInput & { personalId: number }
): Promise<ServiceResult<{ cantidad: number }>> {
  try {
    const destino = await prisma.cajaTesoreria.findUnique({
      where: { id: input.cajaDestinoId },
      select: { id: true, tipoCaja: true, sucursalId: true },
    });
    if (!destino) return { success: false, error: "Caja destino inválida." };
    if (destino.tipoCaja === "CHEQUE") {
      return { success: false, error: "El depósito tiene que ir a una caja que no sea de cheques." };
    }
    const cheques = await chequesEnCartera(input.chequeIds, prisma);
    if (!cheques.success) return cheques;
    const hoy = hoyNegocio();
    if (cheques.data.some((c) => isoYmdFromPrismaDateOnly(c.fechaPago) > hoy.iso)) {
      return {
        success: false,
        error: "Solo se pueden depositar cheques con fecha de pago hasta hoy.",
      };
    }
    const sucursal = await sucursalOperador(input.personalId, destino.sucursalId);
    if (!sucursal.success) return sucursal;
    const observacion = input.observacion.trim() || "Depósito de cheque";

    await prisma.$transaction(async (tx) => {
      for (const cheque of cheques.data) {
        await marcarSalida(tx, cheque.id, {
          estado: "DEPOSITADO",
          fechaSalida: hoy.fecha,
          cajaDestinoId: destino.id,
        });
        const base = {
          catMovimiento: "TRANSFERENCIA_ENTRE_CAJAS" as const,
          monto: cheque.montoAcreditado,
          montoAcreditado: cheque.montoAcreditado,
          fechaRegistro: hoy.fecha,
          fechaAcreditacion: hoy.fecha,
          observacion,
          sucursalId: sucursal.data,
          personalId: input.personalId,
          transferenciaGrupoId: randomUUID(),
          chequeId: cheque.id,
        };
        await tx.tesoreriaMovimiento.createMany({
          data: [
            {
              ...base,
              cajaId: cheque.cajaId,
              tipoMovimiento: "EGRESO",
              cajaContraparteId: destino.id,
            },
            {
              ...base,
              cajaId: destino.id,
              tipoMovimiento: "INGRESO",
              cajaContraparteId: cheque.cajaId,
            },
          ],
        });
      }
    });
    return { success: true, data: { cantidad: cheques.data.length } };
  } catch (e) {
    const err = errorTx(e);
    if (err) return err;
    console.error("[depositarCheques]", e);
    return { success: false, error: "No se pudieron depositar los cheques." };
  }
}

/**
 * Pago a proveedor con cheques (cualquier fecha de pago): imputa FIFO a los comprobantes
 * pendientes de ese proveedor y registra un egreso PAGO_PROVEEDOR por cheque en su caja CHEQUE.
 */
export async function pagarProveedorConCheques(
  input: PagarProveedorConChequesInput & { personalId: number }
): Promise<ServiceResult<{ cantidad: number }>> {
  try {
    const proveedor = await prisma.proveedor.findUnique({
      where: { id: input.proveedorId },
      select: { id: true, nombre: true, idProveedorDux: true },
    });
    if (!proveedor) return { success: false, error: "Proveedor inválido." };
    if (!proveedor.idProveedorDux) {
      return { success: false, error: "El proveedor no tiene comprobantes de compra." };
    }
    const cheques = await chequesEnCartera(input.chequeIds, prisma);
    if (!cheques.success) return cheques;
    const totalPesos = cheques.data.reduce((acc, c) => acc + c.monto, 0);
    const pendientes = await comprobantesPendientesProveedor(proveedor.idProveedorDux, prisma);
    const saldoProveedor = roundArs2(pendientes.reduce((acc, p) => acc + p.saldoPendiente, 0));
    if (totalPesos > saldoProveedor) {
      return {
        success: false,
        error: `Los cheques ($${totalPesos.toLocaleString("es-AR")}) superan el saldo pendiente del proveedor ($${saldoProveedor.toLocaleString("es-AR")}).`,
      };
    }
    const imputaciones = imputarPagoFifoVentas(pendientes, totalPesos).filter(
      (fila) => fila.asignado > 0
    );
    const sucursal = await sucursalOperador(input.personalId, null);
    if (!sucursal.success) return sucursal;
    const hoy = hoyNegocio();
    const observacion =
      input.observacion.trim() ||
      `Pago a ${proveedor.nombre.toLocaleUpperCase("es-AR")} con cheque`;

    await prisma.$transaction(async (tx) => {
      for (const fila of imputaciones) {
        const row = await tx.comprobanteProveedor.findUnique({
          where: { id: fila.id },
          select: { total: true, montoAplicado: true },
        });
        if (!row) throw new Error("saldo-cambio");
        const saldo = roundArs2(Number(row.total) - Number(row.montoAplicado));
        if (fila.asignado > saldo) throw new Error("saldo-cambio");
        await tx.comprobanteProveedor.update({
          where: { id: fila.id },
          data: {
            montoAplicado: new Prisma.Decimal(
              roundArs2(Number(row.montoAplicado) + fila.asignado).toFixed(2)
            ),
          },
        });
      }
      for (const cheque of cheques.data) {
        await marcarSalida(tx, cheque.id, {
          estado: "ENTREGADO_PROVEEDOR",
          fechaSalida: hoy.fecha,
          proveedorId: proveedor.id,
        });
        await tx.tesoreriaMovimiento.create({
          data: {
            cajaId: cheque.cajaId,
            tipoMovimiento: "EGRESO",
            catMovimiento: "PAGO_PROVEEDOR",
            monto: cheque.montoAcreditado,
            montoAcreditado: cheque.montoAcreditado,
            fechaRegistro: hoy.fecha,
            fechaAcreditacion: hoy.fecha,
            observacion,
            sucursalId: sucursal.data,
            personalId: input.personalId,
            chequeId: cheque.id,
          },
        });
      }
    });
    return { success: true, data: { cantidad: cheques.data.length } };
  } catch (e) {
    const err = errorTx(e);
    if (err) return err;
    console.error("[pagarProveedorConCheques]", e);
    return { success: false, error: "No se pudo registrar el pago con cheques." };
  }
}
