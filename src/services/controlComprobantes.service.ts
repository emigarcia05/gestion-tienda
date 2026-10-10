import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  expandirCuotasComprobante,
  formatPlanPlazosLabel,
  resolverPlazosEfectivos,
  type PlanPlazosPago,
} from "@/lib/comprobanteCuotasPlazoPago";
import { etiquetaCajaTesoreria } from "@/lib/cajasTesoreriaTipos";
import {
  imputarPagoFifoVentas,
  type FacturaVentaPendientePago,
} from "@/lib/factura";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  prismaDateOnlyFromIsoYmd,
} from "@/lib/fechaArgentina";
import {
  saldosPorCajaDesdeMovimientos,
  sucursalIdMovimientoOperador,
} from "@/services/tesoreriaMovimientos.service";
import type {
  RegistrarNotaCreditoBonificacionInput,
  RegistrarPagoCuentaCorrienteProveedoresInput,
} from "@/lib/validations/controlComprobantes";
import { TIPO_COMP_COMPRA } from "@/lib/numeroComprobanteCompra";
import type { ServiceResult } from "@/types/service.types";

export interface ControlComprobanteFila {
  id: string;
  fechaComp: string;
  /** `proveedores.id_proveedor_dux` (clave del filtro PROVEEDOR y del pago CC). */
  idProveedor: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  sucursalNombre: string;
  pedidoHistoriaId: string | null;
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
  idProveedor: string;
  proveedorNombre: string;
  proveedorPrefijo: string;
  sucursalNombre: string;
  pedidoHistoriaId: string | null;
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
      c.id_proveedor AS "idProveedor",
      p.nombre AS "proveedorNombre",
      COALESCE(p.prefijo, '') AS "proveedorPrefijo",
      COALESCE(s.nombre, c.id_sucursal_empresa) AS "sucursalNombre",
      c.pedido_historia_id AS "pedidoHistoriaId",
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
    INNER JOIN proveedores p ON p.id_proveedor_dux = c.id_proveedor
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
      idProveedor: r.idProveedor,
      proveedorNombre: r.proveedorNombre,
      proveedorPrefijo: r.proveedorPrefijo,
      sucursalNombre: r.sucursalNombre,
      pedidoHistoriaId: r.pedidoHistoriaId,
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

function roundArs2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Comprobantes de compra con saldo de un proveedor (FIFO por fecha). */
export async function listarComprobantesCompraPendientesPago(
  idProveedorDux: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<FacturaVentaPendientePago[]> {
  const rows = await db.comprobanteProveedor.findMany({
    where: {
      idProveedor: idProveedorDux,
      tipoComp: { not: "NOTA_CREDITO" },
    },
    select: {
      id: true,
      fechaComp: true,
      comprobante: true,
      total: true,
      montoAplicado: true,
    },
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

/** Saldo total pendiente; error si `montoPesos` lo supera o no hay saldo. */
export function validarMontoContraSaldoProveedor(
  pendientes: readonly FacturaVentaPendientePago[],
  montoPesos: number
): ServiceResult<void> {
  const saldo = roundArs2(pendientes.reduce((acc, p) => acc + p.saldoPendiente, 0));
  if (saldo <= 0) {
    return { success: false, error: "El proveedor no tiene comprobantes con saldo." };
  }
  if (montoPesos > saldo) {
    return {
      success: false,
      error: `El monto supera el saldo pendiente del proveedor ($${saldo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}).`,
    };
  }
  return { success: true, data: undefined };
}

/**
 * Suma `asignado` a `monto_aplicado` de cada comprobante dentro de la transacción.
 * Lanza `saldo-cambio` si el saldo ya no alcanza (concurrencia).
 */
export async function aplicarImputacionesCompra(
  tx: Prisma.TransactionClient,
  imputaciones: ReadonlyArray<{ id: string; asignado: number }>
): Promise<void> {
  for (const fila of imputaciones) {
    const row = await tx.comprobanteProveedor.findUnique({
      where: { id: fila.id },
      select: { tipoComp: true, total: true, montoAplicado: true },
    });
    if (!row || row.tipoComp === "NOTA_CREDITO") {
      throw new Error("comprobante-ausente");
    }
    const saldo = roundArs2(Number(row.total) - Number(row.montoAplicado));
    const montoFila = roundArs2(fila.asignado);
    if (montoFila > saldo) {
      throw new Error("saldo-cambio");
    }
    await tx.comprobanteProveedor.update({
      where: { id: fila.id },
      data: {
        montoAplicado: new Prisma.Decimal(
          roundArs2(Number(row.montoAplicado) + montoFila).toFixed(2)
        ),
      },
    });
  }
}

export type CajaPagoProveedorOpcion = {
  id: string;
  etiqueta: string;
  montoDisponible: number;
  /** Habilita GENERAR ECHEQ (débito diferido; no exige disponible). */
  emiteCheque: boolean;
};

const CAJA_PAGO_PROVEEDOR_SELECT = {
  id: true,
  sucursalId: true,
  titular: true,
  tipoCaja: true,
  tipoValor: true,
  emiteCheque: true,
  entidad: { select: { nombre: true } },
  sucursal: { select: { nombre: true } },
} as const;

/**
 * Cajas de tesorería desde las que se puede pagar a proveedores: `tipo_valor` ≠ CHEQUE (su saldo
 * son cheques en cartera, no dinero) y saldo disponible > 0 o `emite_cheque` (eCheq diferido).
 */
export async function listarCajasPagoProveedor(): Promise<CajaPagoProveedorOpcion[]> {
  const [cajas, saldos] = await Promise.all([
    prisma.cajaTesoreria.findMany({
      where: { tipoValor: { not: "CHEQUE" } },
      select: CAJA_PAGO_PROVEEDOR_SELECT,
    }),
    saldosPorCajaDesdeMovimientos(),
  ]);
  return cajas
    .map((caja) => ({
      id: caja.id,
      etiqueta: etiquetaCajaTesoreria(caja),
      montoDisponible: saldos.get(caja.id) ?? 0,
      emiteCheque: caja.emiteCheque,
    }))
    .filter((caja) => caja.montoDisponible > 0 || caja.emiteCheque)
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/**
 * Pago CC de un proveedor desde una caja de tesorería: imputa FIFO `monto_aplicado` a sus
 * comprobantes y registra un EGRESO `PAGO_PROVEEDOR` hoy en esa caja (no puede superar su disponible).
 */
export async function registrarPagoCuentaCorrienteProveedores(
  input: RegistrarPagoCuentaCorrienteProveedoresInput
): Promise<ServiceResult<void>> {
  try {
    const montoPesos = roundArs2(input.montoCents / 100);
    const montoLedger = Math.round(montoPesos);
    if (montoLedger <= 0) {
      return { success: false, error: "Ingresá un monto a pagar." };
    }
    const [proveedor, caja] = await Promise.all([
      prisma.proveedor.findUnique({
        where: { idProveedorDux: input.idProveedorDux },
        select: { nombre: true },
      }),
      prisma.cajaTesoreria.findUnique({
        where: { id: input.cajaId },
        select: CAJA_PAGO_PROVEEDOR_SELECT,
      }),
    ]);
    if (!proveedor) return { success: false, error: "Proveedor inválido." };
    if (!caja) return { success: false, error: "Caja inválida." };
    if (caja.tipoValor === "CHEQUE") {
      return {
        success: false,
        error:
          "No se paga desde una caja de cheques; para un cheque propio elegí eCheq.",
      };
    }
    const saldoCaja = (await saldosPorCajaDesdeMovimientos([caja.id])).get(caja.id) ?? 0;
    if (montoLedger > saldoCaja) {
      return {
        success: false,
        error: `El monto supera el disponible de la caja ($${saldoCaja.toLocaleString("es-AR")}).`,
      };
    }

    const pendientes = await listarComprobantesCompraPendientesPago(input.idProveedorDux);
    const saldoOk = validarMontoContraSaldoProveedor(pendientes, montoPesos);
    if (!saldoOk.success) return saldoOk;
    const imputaciones = imputarPagoFifoVentas(pendientes, montoPesos).filter(
      (fila) => fila.asignado > 0
    );

    const sucursal = await sucursalIdMovimientoOperador(input.personalId, caja.sucursalId);
    if (!sucursal.success) return sucursal;
    const hoy = prismaDateOnlyFromIsoYmd(dateToIsoYmdArgentina(new Date()));
    if (!hoy) return { success: false, error: "Fecha inválida." };

    await prisma.$transaction(async (tx) => {
      await aplicarImputacionesCompra(tx, imputaciones);
      await tx.tesoreriaMovimiento.create({
        data: {
          cajaId: caja.id,
          tipoMovimiento: "EGRESO",
          catMovimiento: "PAGO_PROVEEDOR",
          monto: montoLedger,
          montoAcreditado: montoLedger,
          fechaRegistro: hoy,
          fechaAcreditacion: hoy,
          observacion: `Pago cuenta corriente a ${proveedor.nombre.toLocaleUpperCase("es-AR")}`,
          sucursalId: sucursal.data,
          personalId: input.personalId,
        },
      });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "saldo-cambio") {
      return {
        success: false,
        error: "El saldo de un comprobante cambió. Recargá e intentá de nuevo.",
      };
    }
    console.error("[registrarPagoCuentaCorrienteProveedores]", e);
    return { success: false, error: "No se pudo registrar el pago." };
  }
}

/**
 * Nota de crédito del proveedor por bonificación comercial: crea `fin_compras_comprobante`
 * `NOTA_CREDITO` (`monto_aplicado` = total, `comprobante_asoc_id` = comprobante) y suma el monto
 * a `monto_aplicado` del comprobante. Sin stock ni `tesoreria_movimientos`.
 */
export async function registrarNotaCreditoBonificacion(
  input: RegistrarNotaCreditoBonificacionInput
): Promise<ServiceResult<void>> {
  try {
    const monto = roundArs2(input.montoCents / 100);
    const original = await prisma.comprobanteProveedor.findUnique({
      where: { id: input.comprobanteId },
      select: {
        id: true,
        idSucursalEmpresa: true,
        idProveedor: true,
        tipoComp: true,
        total: true,
        montoAplicado: true,
      },
    });
    if (
      !original ||
      original.idProveedor !== input.idProveedorDux ||
      original.tipoComp === TIPO_COMP_COMPRA.NOTA_CREDITO
    ) {
      return { success: false, error: "Comprobante inválido para este proveedor." };
    }
    const saldo = roundArs2(Number(original.total) - Number(original.montoAplicado));
    if (monto > saldo) {
      return {
        success: false,
        error: `El monto supera el saldo del comprobante ($${saldo.toLocaleString("es-AR", { minimumFractionDigits: 2 })}).`,
      };
    }
    const fecha = prismaDateOnlyFromIsoYmd(input.fecha);
    if (!fecha) return { success: false, error: "Fecha inválida." };

    const montoDec = new Prisma.Decimal(monto.toFixed(2));
    await prisma.$transaction(async (tx) => {
      await aplicarImputacionesCompra(tx, [{ id: original.id, asignado: monto }]);
      await tx.comprobanteProveedor.create({
        data: {
          idSucursalEmpresa: original.idSucursalEmpresa,
          tipoComp: TIPO_COMP_COMPRA.NOTA_CREDITO,
          comprobante: input.numero,
          fechaComp: fecha,
          idProveedor: original.idProveedor,
          total: montoDec,
          montoAplicado: montoDec,
          comprobanteAsocId: original.id,
        },
      });
    });
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "saldo-cambio") {
      return {
        success: false,
        error: "El saldo del comprobante cambió. Recargá e intentá de nuevo.",
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Ya existe una nota de crédito con ese número y fecha." };
    }
    console.error("[registrarNotaCreditoBonificacion]", e);
    return { success: false, error: "No se pudo registrar la nota de crédito." };
  }
}