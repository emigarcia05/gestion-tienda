import { randomUUID } from "node:crypto";
import { Prisma, type CategoriaMovimientoTesoreria, type SentidoMovimientoTesoreria } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { etiquetaCajaTesoreria } from "@/lib/cajasTesoreriaTipos";
import {
  cxTotalConIvaFinAnaCosFina,
  cxTotalSinIvaFinAnaCosFina,
} from "@/lib/finAnaCosFina";
import { esCobroNotaCreditoNombre } from "@/lib/factura";
import {
  addDaysToIsoYmdArgentina,
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
  prismaDateOnlyFromIsoYmd,
} from "@/lib/fechaArgentina";
import type {
  AjustarMontoCajaTesoreriaInput,
  CrearMovimientoTesoreriaInput,
  CrearTransferenciaEntreCajasInput,
} from "@/lib/validations/tesoreriaMovimientos";
import type { ServiceResult } from "@/types";
import { crearChequeEnCarteraDesdeCobro } from "@/services/tesoreriaCheques.service";

type DbClient = Prisma.TransactionClient | typeof prisma;

const CATEGORIAS_COBRO: ReadonlySet<CategoriaMovimientoTesoreria> = new Set([
  "COBRO",
  "NOTA_CREDITO",
]);

export type TesoreriaMovimientoCreado = {
  id: string;
  cajaId: string;
  tipoMovimiento: SentidoMovimientoTesoreria;
  catMovimiento: CategoriaMovimientoTesoreria;
  monto: number;
  sucursalId: string;
};

function fechaNegocio(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/** `fecha_acreditacion` = registro + días (0 si null/negativo). */
function fechasRegistroYAcreditacion(
  fechaRegistroIso: string,
  diasAcreditacion: number | null | undefined
): { fechaRegistro: Date; fechaAcreditacion: Date } {
  const dias = Math.max(0, diasAcreditacion ?? 0);
  const acredIso = addDaysToIsoYmdArgentina(fechaRegistroIso, dias);
  return {
    fechaRegistro: fechaNegocio(fechaRegistroIso),
    fechaAcreditacion: fechaNegocio(acredIso),
  };
}

/**
 * Neto que impacta caja: bruto × (1 − % costo), redondeado a pesos.
 * % fuera de 0…100 se acota. Sin costo (null/0) → igual al bruto.
 */
export function montoAcreditadoDesdeCostoFinanciero(
  montoBruto: number,
  costoFinancieroPct: number | null | undefined
): number {
  const pctRaw = Number(costoFinancieroPct ?? 0);
  const pct = Number.isFinite(pctRaw)
    ? Math.min(100, Math.max(0, pctRaw))
    : 0;
  return Math.max(0, Math.round(montoBruto * (1 - pct / 100)));
}

function decimalPctToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

const CX_FIN_ACREDITACION_SELECT = {
  id: true,
  diasAcreditacion: true,
  arancel: true,
  costoFinanciero: true,
  impCheque: true,
} as const;

type CxFinAcreditacion = {
  arancel: Prisma.Decimal | number;
  costoFinanciero: Prisma.Decimal | number;
  impCheque: boolean;
};

/**
 * % que se descuenta al acreditar según `cobros_vinc_cajas.discrimina_iva`:
 * TRUE → CX TOTAL S/ IVA; FALSE → CX TOTAL C/ IVA.
 */
export function pctCostoAcreditacionDesdeCxFin(
  cx: CxFinAcreditacion | null | undefined,
  discriminaIva = false
): number {
  if (!cx) return 0;
  const arancel = decimalPctToNumber(cx.arancel);
  const costo = decimalPctToNumber(cx.costoFinanciero);
  return discriminaIva
    ? cxTotalSinIvaFinAnaCosFina(cx.impCheque, arancel, costo)
    : cxTotalConIvaFinAnaCosFina(cx.impCheque, arancel, costo);
}

function claveVinculoCaja(
  pagoId: string | null | undefined,
  entidadId: string | null | undefined,
  sucursalId: string
): string {
  return `${pagoId ?? ""}|${entidadId ?? ""}|${sucursalId}`;
}

async function mapaDiscriminaIvaPorVinculo(
  triples: Array<{
    pagoId: string | null;
    entidadId: string | null;
    sucursalId: string;
  }>,
  db: DbClient = prisma
): Promise<Map<string, boolean>> {
  const unicos = new Map<string, { pagoId: string; entidadId: string | null; sucursalId: string }>();
  for (const t of triples) {
    if (!t.pagoId) continue;
    const key = claveVinculoCaja(t.pagoId, t.entidadId, t.sucursalId);
    if (!unicos.has(key)) {
      unicos.set(key, { pagoId: t.pagoId, entidadId: t.entidadId, sucursalId: t.sucursalId });
    }
  }
  const out = new Map<string, boolean>();
  if (unicos.size === 0) return out;
  const rows = await db.cobrosPorSucursal.findMany({
    where: {
      OR: [...unicos.values()].map((t) => ({
        pagoId: t.pagoId,
        entidadId: t.entidadId,
        sucursalId: t.sucursalId,
      })),
    },
    select: {
      pagoId: true,
      entidadId: true,
      sucursalId: true,
      discriminaIva: true,
    },
  });
  for (const row of rows) {
    out.set(claveVinculoCaja(row.pagoId, row.entidadId, row.sucursalId), row.discriminaIva);
  }
  return out;
}

function sentidoDeCategoria(
  cat: CategoriaMovimientoTesoreria,
  tipoMovimiento: SentidoMovimientoTesoreria | undefined
): ServiceResult<SentidoMovimientoTesoreria> {
  if (cat === "COBRO") return { success: true, data: "INGRESO" };
  if (cat === "NOTA_CREDITO" || cat === "PAGO_PROVEEDOR" || cat === "PAGO_GASTOS") {
    return { success: true, data: "EGRESO" };
  }
  if (cat === "AJUSTE_CAJA") {
    if (!tipoMovimiento) {
      return { success: false, error: "El ajuste tiene que ser ingreso o egreso." };
    }
    return { success: true, data: tipoMovimiento };
  }
  return {
    success: false,
    error: "La transferencia se registra con las dos cajas juntas.",
  };
}

type DatosCobroResueltos = {
  pagoId: string | null;
  entidadId: string | null;
  cuotaId: string | null;
  cxFinId: string | null;
};

async function resolverDatosCobro(
  input: CrearMovimientoTesoreriaInput
): Promise<ServiceResult<DatosCobroResueltos>> {
  const vacio: DatosCobroResueltos = {
    pagoId: null,
    entidadId: null,
    cuotaId: null,
    cxFinId: null,
  };
  if (!CATEGORIAS_COBRO.has(input.catMovimiento)) {
    return { success: true, data: vacio };
  }
  if (!input.pagoId) {
    return { success: false, error: "Seleccioná la forma de pago." };
  }

  const pago = await prisma.finAnaCosFinaPagoCat.findUnique({
    where: { id: input.pagoId },
    select: { id: true },
  });
  if (!pago) return { success: false, error: "Forma de pago inválida." };

  const vinculosEntidad = await prisma.cobrosFormaPagoEntidad.findMany({
    where: { pagoId: input.pagoId },
    select: { entidadId: true },
  });
  const entidadId = input.entidadId ?? null;
  if (vinculosEntidad.length === 0) {
    if (entidadId) {
      return { success: false, error: "Esta forma de pago no tiene entidad." };
    }
  } else if (!entidadId || !vinculosEntidad.some((v) => v.entidadId === entidadId)) {
    return { success: false, error: "Seleccioná una entidad de esa forma de pago." };
  }

  const cuotaId = input.cuotaId ?? null;
  if (!entidadId) {
    if (cuotaId) {
      return { success: false, error: "Esta forma de pago no tiene cuotas." };
    }
  } else {
    const vinculosCuota = await prisma.cobrosCuotaVinculo.findMany({
      where: { pagoId: input.pagoId, entidadId },
      select: { cuotaId: true },
    });
    if (vinculosCuota.length === 0) {
      if (cuotaId) {
        return { success: false, error: "Esa forma de pago y entidad no tienen cuotas." };
      }
    } else if (!cuotaId || !vinculosCuota.some((v) => v.cuotaId === cuotaId)) {
      return { success: false, error: "Seleccioná una cuota de esa forma de pago y entidad." };
    }
  }

  const costos = await prisma.finAnaCosFina.findMany({
    where: {
      pagoId: input.pagoId,
      terminalId: entidadId,
      cuotaId,
    },
    select: { id: true },
  });
  if (costos.length > 1) {
    return {
      success: false,
      error: "Hay más de un costo financiero para esa forma de pago, entidad y cuota.",
    };
  }
  const cxFinId = costos[0]?.id ?? null;

  return {
    success: true,
    data: { pagoId: input.pagoId, entidadId, cuotaId, cxFinId },
  };
}

async function cajaYSucursalExisten(cajaId: string, sucursalId: string): Promise<string | null> {
  const [caja, sucursal] = await Promise.all([
    prisma.cajaTesoreria.findUnique({ where: { id: cajaId }, select: { id: true } }),
    prisma.sucursal.findUnique({ where: { id: sucursalId }, select: { id: true } }),
  ]);
  if (!caja) return "Caja inválida.";
  if (!sucursal) return "Sucursal inválida.";
  return null;
}

async function personalExiste(personalId: number): Promise<string | null> {
  const personal = await prisma.globalPersonal.findUnique({
    where: { idPersonal: personalId },
    select: { idPersonal: true },
  });
  if (!personal) return "Usuario inválido.";
  return null;
}

/**
 * Alta de un movimiento que no es transferencia entre cajas.
 * El costo financiero se resuelve solo: la fila de `cobros_cx_fin` de esa
 * forma × entidad × cuota, o null si no hay una sola fila.
 */
export async function crearMovimientoTesoreria(
  input: CrearMovimientoTesoreriaInput
): Promise<ServiceResult<TesoreriaMovimientoCreado>> {
  const sentido = sentidoDeCategoria(input.catMovimiento, input.tipoMovimiento);
  if (!sentido.success) return sentido;

  const existe = await cajaYSucursalExisten(input.cajaId, input.sucursalId);
  if (existe) return { success: false, error: existe };

  const personalErr = await personalExiste(input.personalId);
  if (personalErr) return { success: false, error: personalErr };

  const cobro = await resolverDatosCobro(input);
  if (!cobro.success) return cobro;

  let diasAcreditacion: number | null = null;
  let costoFinancieroPct = 0;
  if (cobro.data.cxFinId) {
    const cx = await prisma.finAnaCosFina.findUnique({
      where: { id: cobro.data.cxFinId },
      select: CX_FIN_ACREDITACION_SELECT,
    });
    diasAcreditacion = cx?.diasAcreditacion ?? null;
    const mapaIva = await mapaDiscriminaIvaPorVinculo([
      {
        pagoId: cobro.data.pagoId,
        entidadId: cobro.data.entidadId,
        sucursalId: input.sucursalId,
      },
    ]);
    const discriminaIva =
      mapaIva.get(
        claveVinculoCaja(cobro.data.pagoId, cobro.data.entidadId, input.sucursalId)
      ) ?? false;
    costoFinancieroPct = pctCostoAcreditacionDesdeCxFin(cx, discriminaIva);
  }
  const { fechaRegistro, fechaAcreditacion } = fechasRegistroYAcreditacion(
    input.fecha,
    input.catMovimiento === "COBRO" || input.catMovimiento === "NOTA_CREDITO"
      ? diasAcreditacion
      : 0
  );
  const montoAcreditado =
    input.catMovimiento === "COBRO" || input.catMovimiento === "NOTA_CREDITO"
      ? montoAcreditadoDesdeCostoFinanciero(input.monto, costoFinancieroPct)
      : input.monto;

  const created = await prisma.tesoreriaMovimiento.create({
    data: {
      cajaId: input.cajaId,
      tipoMovimiento: sentido.data,
      catMovimiento: input.catMovimiento,
      monto: input.monto,
      montoAcreditado,
      costoFinanciero:
        input.catMovimiento === "COBRO" || input.catMovimiento === "NOTA_CREDITO"
          ? costoFinancieroPct
          : null,
      fechaRegistro,
      fechaAcreditacion,
      observacion: input.observacion.trim(),
      pagoId: cobro.data.pagoId,
      entidadId: cobro.data.entidadId,
      cuotaId: cobro.data.cuotaId,
      cxFinId: cobro.data.cxFinId,
      sucursalId: input.sucursalId,
      personalId: input.personalId,
    },
    select: {
      id: true,
      cajaId: true,
      tipoMovimiento: true,
      catMovimiento: true,
      monto: true,
      sucursalId: true,
    },
  });
  return { success: true, data: { ...created, cajaId: input.cajaId } };
}

/** Sucursal del movimiento: la del operador; si no tiene, la de la caja. */
export async function sucursalIdMovimientoOperador(
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

const CAJA_TRANSFERENCIA_SELECT = {
  id: true,
  sucursalId: true,
  titular: true,
  tipoCaja: true,
  entidad: { select: { nombre: true } },
  sucursal: { select: { nombre: true } },
} as const;

/**
 * Egreso en la caja origen e ingreso en la caja destino, sin datos de cobro.
 * El monto no puede superar el saldo disponible (acreditado) de la caja origen.
 */
export async function crearTransferenciaEntreCajas(
  input: CrearTransferenciaEntreCajasInput
): Promise<ServiceResult<{ transferenciaGrupoId: string; ids: [string, string] }>> {
  if (input.cajaOrigenId === input.cajaDestinoId) {
    return { success: false, error: "La caja destino tiene que ser otra caja." };
  }
  const [origen, destino] = await Promise.all([
    prisma.cajaTesoreria.findUnique({
      where: { id: input.cajaOrigenId },
      select: CAJA_TRANSFERENCIA_SELECT,
    }),
    prisma.cajaTesoreria.findUnique({
      where: { id: input.cajaDestinoId },
      select: CAJA_TRANSFERENCIA_SELECT,
    }),
  ]);
  if (!origen || !destino) return { success: false, error: "Caja inválida." };

  let sucursalId = origen.sucursalId ?? destino.sucursalId;
  if (!sucursalId) {
    if (!input.sucursalCodigo) {
      return {
        success: false,
        error: "Indicá la sucursal del movimiento (ninguna de las cajas tiene sucursal).",
      };
    }
    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: input.sucursalCodigo },
      select: { id: true },
    });
    if (!sucursal) return { success: false, error: "Sucursal inválida." };
    sucursalId = sucursal.id;
  }

  const personalErr = await personalExiste(input.personalId);
  if (personalErr) return { success: false, error: personalErr };

  const saldos = await saldosPorCajaDesdeMovimientos([origen.id]);
  const saldoOrigen = saldos.get(origen.id) ?? 0;
  if (input.monto > saldoOrigen) {
    return {
      success: false,
      error: `El monto supera el disponible de la caja origen ($${saldoOrigen.toLocaleString("es-AR")}).`,
    };
  }

  const transferenciaGrupoId = randomUUID();
  const { fechaRegistro, fechaAcreditacion } = fechasRegistroYAcreditacion(
    input.fecha ?? dateToIsoYmdArgentina(new Date()),
    0
  );
  const observacion =
    input.observacion.trim() ||
    `Transferencia de ${etiquetaCajaTesoreria(origen)} a ${etiquetaCajaTesoreria(destino)}`;
  const base = {
    catMovimiento: "TRANSFERENCIA_ENTRE_CAJAS" as const,
    monto: input.monto,
    montoAcreditado: input.monto,
    fechaRegistro,
    fechaAcreditacion,
    observacion,
    sucursalId,
    personalId: input.personalId,
    transferenciaGrupoId,
  };

  const [egreso, ingreso] = await prisma.$transaction([
    prisma.tesoreriaMovimiento.create({
      data: {
        ...base,
        cajaId: input.cajaOrigenId,
        tipoMovimiento: "EGRESO",
        cajaContraparteId: input.cajaDestinoId,
      },
      select: { id: true },
    }),
    prisma.tesoreriaMovimiento.create({
      data: {
        ...base,
        cajaId: input.cajaDestinoId,
        tipoMovimiento: "INGRESO",
        cajaContraparteId: input.cajaOrigenId,
      },
      select: { id: true },
    }),
  ]);

  return {
    success: true,
    data: { transferenciaGrupoId, ids: [egreso.id, ingreso.id] },
  };
}

/**
 * Saldo por caja = Σ `monto_acreditado` con signo de `tipo_movimiento`
 * (INGRESO +, EGRESO −), solo movimientos con `fecha_acreditacion` ≤ hoy AR.
 * Sin movimientos acreditados → 0.
 */
export async function saldosPorCajaDesdeMovimientos(
  cajaIds?: readonly string[]
): Promise<Map<string, number>> {
  const hoy = fechaNegocio(dateToIsoYmdArgentina(new Date()));
  const rows = await prisma.tesoreriaMovimiento.groupBy({
    by: ["cajaId", "tipoMovimiento"],
    where: {
      cajaId: {
        not: null,
        ...(cajaIds && cajaIds.length > 0 ? { in: [...cajaIds] } : {}),
      },
      fechaAcreditacion: { lte: hoy },
    },
    _sum: { montoAcreditado: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.cajaId) continue;
    const prev = map.get(row.cajaId) ?? 0;
    const suma = row._sum.montoAcreditado ?? 0;
    map.set(
      row.cajaId,
      prev + (row.tipoMovimiento === "INGRESO" ? suma : -suma)
    );
  }
  return map;
}

/**
 * INGRESO con `fecha_acreditacion` posterior a hoy AR: aún no suma al saldo disponible
 * (depósitos de tarjeta, cheques, etc.).
 */
export async function saldosPendientesAcreditacionPorCaja(
  cajaIds?: readonly string[]
): Promise<Map<string, number>> {
  const hoy = fechaNegocio(dateToIsoYmdArgentina(new Date()));
  const rows = await prisma.tesoreriaMovimiento.groupBy({
    by: ["cajaId"],
    where: {
      tipoMovimiento: "INGRESO",
      cajaId: {
        not: null,
        ...(cajaIds && cajaIds.length > 0 ? { in: [...cajaIds] } : {}),
      },
      fechaAcreditacion: { gt: hoy },
    },
    _sum: { montoAcreditado: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.cajaId) continue;
    map.set(row.cajaId, row._sum.montoAcreditado ?? 0);
  }
  return map;
}

export type OrigenPendienteAcreditacion = "CHEQUE" | "TARJETA" | "OTRO";

export type PendienteAcreditacionFila = {
  id: string;
  fechaAcreditacionIso: string;
  origen: OrigenPendienteAcreditacion;
  origenEtiqueta: string;
  formaPago: string;
  detalle: string;
  montoAcreditado: number;
};

export type ResumenPendientesAcreditacionCaja = {
  total: number;
  totalTarjeta: number;
  totalCheque: number;
  totalOtros: number;
  filas: PendienteAcreditacionFila[];
};

const ETIQUETA_ORIGEN_PENDIENTE: Record<OrigenPendienteAcreditacion, string> = {
  CHEQUE: "CHEQUE",
  TARJETA: "DEPÓSITO TARJETA",
  OTRO: "OTRO",
};

function origenPendienteAcreditacion(args: {
  chequeId: string | null;
  tipoCaja: string | null;
}): OrigenPendienteAcreditacion {
  if (args.chequeId) return "CHEQUE";
  if (args.tipoCaja === "TARJETAS_A_COBRAR") return "TARJETA";
  return "OTRO";
}

/** Detalle de INGRESOS aún no acreditados de una caja (solo lectura). */
export async function listarPendientesAcreditacionCaja(
  cajaId: string
): Promise<ResumenPendientesAcreditacionCaja> {
  const hoy = fechaNegocio(dateToIsoYmdArgentina(new Date()));
  const rows = await prisma.tesoreriaMovimiento.findMany({
    where: {
      cajaId,
      tipoMovimiento: "INGRESO",
      fechaAcreditacion: { gt: hoy },
    },
    orderBy: [{ fechaAcreditacion: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      fechaAcreditacion: true,
      montoAcreditado: true,
      chequeId: true,
      pago: { select: { nombre: true } },
      entidad: { select: { nombre: true } },
      comprobante: { select: { receptorNombre: true } },
      cheque: { select: { clienteNombre: true } },
      caja: { select: { tipoCaja: true } },
    },
  });

  const filas: PendienteAcreditacionFila[] = rows.map((row) => {
    const origen = origenPendienteAcreditacion({
      chequeId: row.chequeId,
      tipoCaja: row.caja?.tipoCaja ?? null,
    });
    const cliente = (row.cheque?.clienteNombre ?? row.comprobante?.receptorNombre ?? "")
      .trim()
      .toLocaleUpperCase("es-AR");
    const forma = row.pago?.nombre?.trim()
      ? row.pago.nombre.toLocaleUpperCase("es-AR")
      : "";
    const entidad = row.entidad?.nombre?.trim()
      ? row.entidad.nombre.toLocaleUpperCase("es-AR")
      : "";
    const detalle = [cliente, entidad].filter((p) => p.length > 0).join(" · ");
    return {
      id: row.id,
      fechaAcreditacionIso: isoYmdFromPrismaDateOnly(row.fechaAcreditacion),
      origen,
      origenEtiqueta: ETIQUETA_ORIGEN_PENDIENTE[origen],
      formaPago: forma,
      detalle,
      montoAcreditado: row.montoAcreditado,
    };
  });

  let totalTarjeta = 0;
  let totalCheque = 0;
  let totalOtros = 0;
  for (const fila of filas) {
    if (fila.origen === "TARJETA") totalTarjeta += fila.montoAcreditado;
    else if (fila.origen === "CHEQUE") totalCheque += fila.montoAcreditado;
    else totalOtros += fila.montoAcreditado;
  }

  return {
    total: totalTarjeta + totalCheque + totalOtros,
    totalTarjeta,
    totalCheque,
    totalOtros,
    filas,
  };
}

const ETIQUETA_CATEGORIA: Record<CategoriaMovimientoTesoreria, string> = {
  COBRO: "COBRO",
  NOTA_CREDITO: "NOTA DE CRÉDITO",
  PAGO_PROVEEDOR: "PAGO PROVEEDOR",
  PAGO_GASTOS: "PAGO GASTOS",
  AJUSTE_CAJA: "AJUSTE CAJA",
  TRANSFERENCIA_ENTRE_CAJAS: "TRANSFERENCIA ENTRE CAJAS",
};

export type TesoreriaMovimientoFila = {
  id: string;
  fechaRegistroIso: string;
  fechaAcreditacionIso: string;
  sucursalNombre: string;
  tipoMovimiento: SentidoMovimientoTesoreria;
  tipoEtiqueta: string;
  catMovimiento: CategoriaMovimientoTesoreria;
  categoriaEtiqueta: string;
  cajaId: string;
  cajaEtiqueta: string;
  usuarioNombre: string;
  /** Bruto del movimiento (cobro = lo pagado por el cliente). */
  monto: number;
  /** Neto que impacta caja (tras el % persistido al registrar). */
  montoAcreditado: number;
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string;
  /** % de contrato persistido en el movimiento. No sigue la matriz. */
  costoFinanciero: number | null;
  comprobanteId: string | null;
  clienteNombre: string;
  comprobanteEtiqueta: string;
};

function etiquetaComprobanteMovimiento(comprobante: {
  ptoVenta: string;
  cbteNro: number | null;
} | null): string {
  if (!comprobante || comprobante.cbteNro == null) return "";
  const nro = comprobante.cbteNro.toString().padStart(8, "0");
  return `${comprobante.ptoVenta}-${nro}`;
}

/** Listado del ledger para TESORERIA → Movimientos (más recientes primero). */
export async function listarMovimientosTesoreria(): Promise<
  TesoreriaMovimientoFila[]
> {
  const rows = await prisma.tesoreriaMovimiento.findMany({
    orderBy: [{ fechaRegistro: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fechaRegistro: true,
      fechaAcreditacion: true,
      tipoMovimiento: true,
      catMovimiento: true,
      monto: true,
      montoAcreditado: true,
      costoFinanciero: true,
      cajaId: true,
      sucursal: { select: { nombre: true } },
      personal: { select: { nombrePersonal: true } },
      caja: {
        select: {
          titular: true,
          tipoCaja: true,
          entidad: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      },
      pago: { select: { nombre: true } },
      entidad: { select: { nombre: true } },
      cuota: { select: { cuotas: true } },
      comprobante: {
        select: {
          id: true,
          receptorNombre: true,
          ptoVenta: true,
          cbteNro: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    fechaRegistroIso: isoYmdFromPrismaDateOnly(row.fechaRegistro),
    fechaAcreditacionIso: isoYmdFromPrismaDateOnly(row.fechaAcreditacion),
    sucursalNombre: row.sucursal.nombre.toLocaleUpperCase("es-AR"),
    tipoMovimiento: row.tipoMovimiento,
    tipoEtiqueta: row.tipoMovimiento === "INGRESO" ? "INGRESO" : "EGRESO",
    catMovimiento: row.catMovimiento,
    categoriaEtiqueta: ETIQUETA_CATEGORIA[row.catMovimiento],
    cajaId: row.cajaId ?? "",
    cajaEtiqueta: row.caja ? etiquetaCajaTesoreria(row.caja) : "",
    usuarioNombre: row.personal?.nombrePersonal.trim()
      ? row.personal.nombrePersonal.toLocaleUpperCase("es-AR")
      : "",
    monto: row.monto,
    montoAcreditado: row.montoAcreditado,
    pagoNombre: row.pago?.nombre?.trim()
      ? row.pago.nombre.toLocaleUpperCase("es-AR")
      : "",
    entidadNombre: row.entidad?.nombre?.trim()
      ? row.entidad.nombre.toLocaleUpperCase("es-AR")
      : "",
    cuotaEtiqueta: row.cuota?.cuotas?.trim()
      ? row.cuota.cuotas.toLocaleUpperCase("es-AR")
      : "",
    costoFinanciero:
      row.costoFinanciero != null ? decimalPctToNumber(row.costoFinanciero) : null,
    comprobanteId: row.comprobante?.id ?? null,
    clienteNombre: row.comprobante?.receptorNombre?.trim()
      ? row.comprobante.receptorNombre.toLocaleUpperCase("es-AR")
      : "",
    comprobanteEtiqueta: etiquetaComprobanteMovimiento(row.comprobante ?? null),
  }));
}

export async function obtenerMovimientoTesoreriaPorId(
  id: string
): Promise<ServiceResult<TesoreriaMovimientoFila>> {
  const row = await prisma.tesoreriaMovimiento.findUnique({
    where: { id },
    select: {
      id: true,
      fechaRegistro: true,
      fechaAcreditacion: true,
      tipoMovimiento: true,
      catMovimiento: true,
      monto: true,
      montoAcreditado: true,
      costoFinanciero: true,
      cajaId: true,
      sucursal: { select: { nombre: true } },
      personal: { select: { nombrePersonal: true } },
      caja: {
        select: {
          titular: true,
          tipoCaja: true,
          entidad: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      },
      pago: { select: { nombre: true } },
      entidad: { select: { nombre: true } },
      cuota: { select: { cuotas: true } },
      comprobante: {
        select: {
          id: true,
          receptorNombre: true,
          ptoVenta: true,
          cbteNro: true,
        },
      },
    },
  });
  if (!row) return { success: false, error: "Movimiento inexistente." };

  return {
    success: true,
    data: {
      id: row.id,
      fechaRegistroIso: isoYmdFromPrismaDateOnly(row.fechaRegistro),
      fechaAcreditacionIso: isoYmdFromPrismaDateOnly(row.fechaAcreditacion),
      sucursalNombre: row.sucursal.nombre.toLocaleUpperCase("es-AR"),
      tipoMovimiento: row.tipoMovimiento,
      tipoEtiqueta: row.tipoMovimiento === "INGRESO" ? "INGRESO" : "EGRESO",
      catMovimiento: row.catMovimiento,
      categoriaEtiqueta: ETIQUETA_CATEGORIA[row.catMovimiento],
      cajaId: row.cajaId ?? "",
      cajaEtiqueta: row.caja ? etiquetaCajaTesoreria(row.caja) : "",
      usuarioNombre: row.personal?.nombrePersonal.trim()
        ? row.personal.nombrePersonal.toLocaleUpperCase("es-AR")
        : "",
      monto: row.monto,
      montoAcreditado: row.montoAcreditado,
      pagoNombre: row.pago?.nombre?.trim()
        ? row.pago.nombre.toLocaleUpperCase("es-AR")
        : "",
      entidadNombre: row.entidad?.nombre?.trim()
        ? row.entidad.nombre.toLocaleUpperCase("es-AR")
        : "",
      cuotaEtiqueta: row.cuota?.cuotas?.trim()
        ? row.cuota.cuotas.toLocaleUpperCase("es-AR")
        : "",
      costoFinanciero:
        row.costoFinanciero != null ? decimalPctToNumber(row.costoFinanciero) : null,
      comprobanteId: row.comprobante?.id ?? null,
      clienteNombre: row.comprobante?.receptorNombre?.trim()
        ? row.comprobante.receptorNombre.toLocaleUpperCase("es-AR")
        : "",
      comprobanteEtiqueta: etiquetaComprobanteMovimiento(row.comprobante ?? null),
    },
  };
}

export type EliminarMovimientoTesoreriaResultado = {
  idsEliminados: string[];
};

/**
 * Elimina un movimiento manual de tesorería.
 * Si es transferencia, elimina ambas piernas por `transferenciaGrupoId`.
 * No permite borrar movimientos ligados a comprobantes/cobros.
 */
export async function eliminarMovimientoTesoreria(
  id: string
): Promise<ServiceResult<EliminarMovimientoTesoreriaResultado>> {
  const row = await prisma.tesoreriaMovimiento.findUnique({
    where: { id },
    select: {
      id: true,
      transferenciaGrupoId: true,
      comprobanteId: true,
      clienteCobroId: true,
      notaCreditoId: true,
      catMovimiento: true,
      chequeId: true,
      chequeEmitidoId: true,
    },
  });
  if (!row) {
    return { success: false, error: "Movimiento inexistente." };
  }
  if (row.chequeEmitidoId) {
    return {
      success: false,
      error: "Este movimiento es un eCheq emitido: anulalo desde TESORERIA → Cajas → eCheqs emitidos.",
    };
  }
  if (row.comprobanteId || row.clienteCobroId || row.notaCreditoId) {
    return {
      success: false,
      error:
        "No se puede borrar este movimiento porque está vinculado a un comprobante o cobro.",
    };
  }
  if (row.chequeId) {
    return {
      success: false,
      error: "No se puede borrar este movimiento porque está vinculado a un cheque.",
    };
  }

  if (row.transferenciaGrupoId) {
    const pares = await prisma.tesoreriaMovimiento.findMany({
      where: { transferenciaGrupoId: row.transferenciaGrupoId },
      select: { id: true },
    });
    if (pares.length === 0) {
      return { success: false, error: "No se encontraron movimientos para eliminar." };
    }
    await prisma.tesoreriaMovimiento.deleteMany({
      where: { transferenciaGrupoId: row.transferenciaGrupoId },
    });
    return { success: true, data: { idsEliminados: pares.map((item) => item.id) } };
  }

  await prisma.tesoreriaMovimiento.delete({ where: { id: row.id } });
  return { success: true, data: { idsEliminados: [row.id] } };
}

export type FlujoFondoIngresoCajaFila = {
  id: string;
  fechaAcreditacionIso: string;
  categoriaEtiqueta: string;
  cajaEtiqueta: string;
  /** Neto que entra a la caja ese día. */
  montoAcreditado: number;
};

/**
 * Ingresos con caja (`tipo_movimiento = INGRESO`) cuya `fecha_acreditacion`
 * cae en el rango, agrupados por día. El monto es `monto_acreditado`.
 */
export async function listarIngresosCajaPorFechaAcreditacion(
  desdeIso: string,
  hastaIso: string
): Promise<Record<string, FlujoFondoIngresoCajaFila[]>> {
  const desde = prismaDateOnlyFromIsoYmd(desdeIso);
  const hasta = prismaDateOnlyFromIsoYmd(hastaIso);
  if (!desde || !hasta) return {};

  const rows = await prisma.tesoreriaMovimiento.findMany({
    where: {
      tipoMovimiento: "INGRESO",
      cajaId: { not: null },
      fechaAcreditacion: { gte: desde, lte: hasta },
    },
    orderBy: [{ fechaAcreditacion: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      fechaAcreditacion: true,
      catMovimiento: true,
      montoAcreditado: true,
      caja: {
        select: {
          titular: true,
          tipoCaja: true,
          entidad: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      },
    },
  });

  const porDia: Record<string, FlujoFondoIngresoCajaFila[]> = {};
  for (const row of rows) {
    const iso = isoYmdFromPrismaDateOnly(row.fechaAcreditacion);
    const fila: FlujoFondoIngresoCajaFila = {
      id: row.id,
      fechaAcreditacionIso: iso,
      categoriaEtiqueta: ETIQUETA_CATEGORIA[row.catMovimiento],
      cajaEtiqueta: row.caja ? etiquetaCajaTesoreria(row.caja) : "",
      montoAcreditado: row.montoAcreditado,
    };
    const lista = porDia[iso] ?? [];
    lista.push(fila);
    porDia[iso] = lista;
  }
  return porDia;
}

/** Completa comprobante/orden/clienteCobro en filas ya resueltas de cobro. */
export function conComprobanteEnMovimientos(
  filas: readonly MovimientoCobroFacturaData[],
  args: {
    comprobanteId: string;
    ordenInicio: number;
    clienteCobroId?: string | null;
  }
): MovimientoCobroFacturaData[] {
  return filas.map((fila, idx) => ({
    ...fila,
    comprobanteId: args.comprobanteId,
    orden: args.ordenInicio + idx,
    clienteCobroId: args.clienteCobroId ?? null,
  }));
}

/** Snapshot de cobro de factura (nombres) para impactar el ledger. */
export type CobroSnapshotParaTesoreria = {
  pagoNombre: string;
  entidadNombre: string;
  cuotaEtiqueta: string | null;
  /** Si la forma tiene acreditación variable, este día es `fecha_acreditacion`. */
  fechaAcreditacionIso?: string;
  montoCents: number;
};

export type MovimientoCobroFacturaData = {
  cajaId: string;
  tipoMovimiento: SentidoMovimientoTesoreria;
  catMovimiento: CategoriaMovimientoTesoreria;
  monto: number;
  montoAcreditado: number;
  /** Snapshot del % de contrato al registrar. */
  costoFinanciero: number;
  fechaRegistro: Date;
  fechaAcreditacion: Date;
  observacion: string;
  pagoId: string;
  entidadId: string | null;
  cuotaId: string | null;
  cxFinId: string | null;
  sucursalId: string;
  personalId: number;
  comprobanteId?: string | null;
  orden?: number | null;
  clienteCobroId?: string | null;
  /**
   * Solo en cobros a caja con `recibe_cheque`: fecha de acreditación del cheque.
   * `crearMovimientosCobroPreparados` crea el cheque EN_CARTERA (no es columna del ledger).
   */
  chequeFechaAcreditacion?: Date | null;
  /** Cheque ya creado (p. ej. pago CC repartido en varias filas). */
  chequeId?: string | null;
};

function normalizarTextoCobro(value: string): string {
  return value.trim().toLocaleUpperCase("es-AR");
}

/**
 * Resuelve cada cobro de factura (nombres) a filas de `tesoreria_movimientos`:
 * caja destino vía `cobros_vinc_cajas` de la sucursal del operador.
 * Omite NOTA DE CRÉDITO y montos ≤ 0. Falla si falta vínculo o caja destino.
 */
export async function prepararMovimientosCobroDesdeSnapshots(
  args: {
    cobros: readonly CobroSnapshotParaTesoreria[];
    sucursalCodigo: string;
    fechaIso: string;
    personalId: number;
    observacion?: string;
  },
  db: DbClient = prisma
): Promise<ServiceResult<MovimientoCobroFacturaData[]>> {
  const cobros = args.cobros.filter(
    (c) => c.montoCents > 0 && !esCobroNotaCreditoNombre(c.pagoNombre)
  );
  if (cobros.length === 0) {
    return { success: true, data: [] };
  }

  const personal = await db.globalPersonal.findUnique({
    where: { idPersonal: args.personalId },
    select: { idPersonal: true },
  });
  if (!personal) {
    return { success: false, error: "Usuario inválido para el cobro en tesorería." };
  }

  const codigo = args.sucursalCodigo.trim();
  if (!codigo) {
    return {
      success: false,
      error: "El usuario no tiene sucursal para registrar el cobro en tesorería.",
    };
  }

  const sucursal = await db.sucursal.findUnique({
    where: { codigo },
    select: { id: true, codigo: true },
  });
  if (!sucursal) {
    return { success: false, error: "Sucursal inválida para el cobro en tesorería." };
  }

  const observacionBase = (args.observacion ?? "").trim();
  const out: MovimientoCobroFacturaData[] = [];

  for (const cobro of cobros) {
    const pagoNombre = normalizarTextoCobro(cobro.pagoNombre);
    const entidadNombre = normalizarTextoCobro(cobro.entidadNombre);
    const cuotaEtiqueta = cobro.cuotaEtiqueta
      ? normalizarTextoCobro(cobro.cuotaEtiqueta)
      : null;
    const monto = Math.round(cobro.montoCents / 100);
    if (monto <= 0) {
      return {
        success: false,
        error: "El monto del cobro en tesorería tiene que ser mayor a cero.",
      };
    }

    const pago = await db.finAnaCosFinaPagoCat.findFirst({
      where: { nombre: pagoNombre },
      select: { id: true, nombre: true, fechaAcreditacionVariable: true },
    });
    if (!pago) {
      return {
        success: false,
        error: `Forma de pago «${pagoNombre}» no encontrada en el catálogo.`,
      };
    }

    const vinculosEntidad = await db.cobrosFormaPagoEntidad.findMany({
      where: { pagoId: pago.id },
      select: { entidadId: true },
    });

    let entidadId: string | null = null;
    if (vinculosEntidad.length === 0) {
      if (entidadNombre) {
        return {
          success: false,
          error: `La forma de pago «${pagoNombre}» no tiene entidad.`,
        };
      }
    } else {
      if (!entidadNombre) {
        return {
          success: false,
          error: `Seleccioná una entidad para «${pagoNombre}».`,
        };
      }
      const entidad = await db.finAnaCosFinaTerminalMarca.findFirst({
        where: { nombre: entidadNombre },
        select: { id: true, nombre: true },
      });
      if (!entidad || !vinculosEntidad.some((v) => v.entidadId === entidad.id)) {
        return {
          success: false,
          error: `Entidad «${entidadNombre}» inválida para «${pagoNombre}».`,
        };
      }
      entidadId = entidad.id;
    }

    let cuotaId: string | null = null;
    if (!entidadId) {
      if (cuotaEtiqueta) {
        return {
          success: false,
          error: `La forma de pago «${pagoNombre}» no tiene cuotas.`,
        };
      }
    } else {
      const vinculosCuota = await db.cobrosCuotaVinculo.findMany({
        where: { pagoId: pago.id, entidadId },
        select: { cuotaId: true, cuota: { select: { id: true, cuotas: true } } },
      });
      if (vinculosCuota.length === 0) {
        if (cuotaEtiqueta) {
          return {
            success: false,
            error: `«${pagoNombre}» / «${entidadNombre}» no tiene cuotas.`,
          };
        }
      } else if (!cuotaEtiqueta) {
        return {
          success: false,
          error: `Seleccioná una cuota para «${pagoNombre}» / «${entidadNombre}».`,
        };
      } else {
        const match = vinculosCuota.find(
          (v) => normalizarTextoCobro(v.cuota.cuotas) === cuotaEtiqueta
        );
        if (!match) {
          return {
            success: false,
            error: `Cuota «${cuotaEtiqueta}» inválida para «${pagoNombre}» / «${entidadNombre}».`,
          };
        }
        cuotaId = match.cuotaId;
      }
    }

    const vinculoCaja = await db.cobrosPorSucursal.findFirst({
      where: {
        pagoId: pago.id,
        sucursalId: sucursal.id,
        entidadId,
      },
      select: {
        cajaDestinoId: true,
        discriminaIva: true,
        esCheque: true,
        cajaDestino: { select: { recibeCheque: true } },
      },
    });
    if (!vinculoCaja) {
      return {
        success: false,
        error: `No hay cobro habilitado para «${pagoNombre}» en ${sucursal.codigo}.`,
      };
    }
    if (!vinculoCaja.cajaDestinoId) {
      return {
        success: false,
        error: `No hay caja destino para «${pagoNombre}» en ${sucursal.codigo}.`,
      };
    }
    if (vinculoCaja.esCheque && vinculoCaja.cajaDestino?.recibeCheque !== true) {
      return {
        success: false,
        error: `La caja destino de «${pagoNombre}» en ${sucursal.codigo} no recibe cheques.`,
      };
    }

    const costos = await db.finAnaCosFina.findMany({
      where: {
        pagoId: pago.id,
        terminalId: entidadId,
        cuotaId,
      },
      select: CX_FIN_ACREDITACION_SELECT,
    });
    if (costos.length > 1) {
      return {
        success: false,
        error: `Hay más de un costo financiero para «${pagoNombre}».`,
      };
    }

    let fechaRegistro: Date;
    let fechaAcreditacion: Date;
    if (pago.fechaAcreditacionVariable || vinculoCaja.esCheque) {
      const iso = cobro.fechaAcreditacionIso?.trim() ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return {
          success: false,
          error: `Ingresá la fecha de acreditación de «${pagoNombre}».`,
        };
      }
      fechaRegistro = fechaNegocio(args.fechaIso);
      fechaAcreditacion = fechaNegocio(iso);
    } else {
      ({ fechaRegistro, fechaAcreditacion } = fechasRegistroYAcreditacion(
        args.fechaIso,
        costos[0]?.diasAcreditacion
      ));
    }
    const costoPct = pctCostoAcreditacionDesdeCxFin(
      costos[0],
      vinculoCaja.discriminaIva
    );
    const montoAcreditado = montoAcreditadoDesdeCostoFinanciero(monto, costoPct);
    const esCheque = vinculoCaja.esCheque;

    out.push({
      cajaId: vinculoCaja.cajaDestinoId,
      tipoMovimiento: "INGRESO",
      catMovimiento: "COBRO",
      monto,
      montoAcreditado,
      costoFinanciero: costoPct,
      fechaRegistro,
      fechaAcreditacion,
      observacion: observacionBase,
      pagoId: pago.id,
      entidadId,
      cuotaId,
      cxFinId: costos[0]?.id ?? null,
      sucursalId: sucursal.id,
      personalId: args.personalId,
      chequeFechaAcreditacion: esCheque ? fechaAcreditacion : null,
    });
  }

  return { success: true, data: out };
}

/** Persiste filas ya resueltas de cobro de factura en el ledger (misma transacción). */
export async function crearMovimientosCobroPreparados(
  filas: readonly MovimientoCobroFacturaData[],
  db: DbClient = prisma
): Promise<ServiceResult<{ ids: string[] }>> {
  if (filas.length === 0) {
    return { success: true, data: { ids: [] } };
  }
  const ids: string[] = [];
  for (const fila of filas) {
    const { chequeFechaAcreditacion, chequeId: chequeIdFila, ...data } = fila;
    let chequeId = chequeIdFila ?? null;
    if (
      !chequeId &&
      chequeFechaAcreditacion &&
      data.tipoMovimiento === "INGRESO" &&
      data.catMovimiento === "COBRO"
    ) {
      const cheque = await crearChequeEnCarteraDesdeCobro(
        {
          cajaId: data.cajaId,
          monto: data.monto,
          montoAcreditado: data.montoAcreditado,
          fechaRecepcion: data.fechaRegistro,
          fechaAcreditacion: chequeFechaAcreditacion,
          comprobanteId: data.comprobanteId ?? null,
          clienteCobroId: data.clienteCobroId ?? null,
        },
        db
      );
      chequeId = cheque.id;
    }
    const created = await db.tesoreriaMovimiento.create({
      data: { ...data, chequeId },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return { success: true, data: { ids } };
}

/**
 * Resuelve y crea movimientos COBRO/INGRESO a partir de los snapshots de cobro de factura.
 */
export async function registrarMovimientosDesdeCobrosFactura(
  args: {
    cobros: readonly CobroSnapshotParaTesoreria[];
    sucursalCodigo: string;
    fechaIso: string;
    personalId: number;
    observacion?: string;
  },
  db: DbClient = prisma
): Promise<ServiceResult<{ ids: string[] }>> {
  const prep = await prepararMovimientosCobroDesdeSnapshots(args, db);
  if (!prep.success) return prep;
  return crearMovimientosCobroPreparados(prep.data, db);
}

/**
 * Lleva el saldo de la caja a `montoObjetivo` con un movimiento AJUSTE_CAJA.
 * Ejemplo: saldo 100 → objetivo 40 ⇒ egreso 60.
 */
export async function ajustarMontoCajaTesoreria(
  input: AjustarMontoCajaTesoreriaInput
): Promise<ServiceResult<TesoreriaMovimientoCreado>> {
  const caja = await prisma.cajaTesoreria.findUnique({
    where: { id: input.cajaId },
    select: { id: true, sucursalId: true },
  });
  if (!caja) {
    return { success: false, error: "Caja inválida." };
  }

  let sucursalId = caja.sucursalId;
  if (!sucursalId) {
    if (!input.sucursalCodigo) {
      return {
        success: false,
        error: "Indicá la sucursal del movimiento (la caja no tiene sucursal).",
      };
    }
    const sucursal = await prisma.sucursal.findUnique({
      where: { codigo: input.sucursalCodigo },
      select: { id: true },
    });
    if (!sucursal) {
      return { success: false, error: "Sucursal inválida." };
    }
    sucursalId = sucursal.id;
  }

  const saldos = await saldosPorCajaDesdeMovimientos([caja.id]);
  const saldoActual = saldos.get(caja.id) ?? 0;
  const delta = input.montoObjetivo - saldoActual;
  if (delta === 0) {
    return { success: false, error: "El monto ya es ese valor." };
  }

  const fecha = input.fecha ?? dateToIsoYmdArgentina(new Date());
  const observacion =
    input.observacion.trim() ||
    `Ajuste de monto a $${input.montoObjetivo.toLocaleString("es-AR")}`;

  return crearMovimientoTesoreria({
    cajaId: caja.id,
    catMovimiento: "AJUSTE_CAJA",
    tipoMovimiento: delta > 0 ? "INGRESO" : "EGRESO",
    monto: Math.abs(delta),
    fecha,
    sucursalId,
    personalId: input.personalId,
    observacion,
  });
}
