import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { etiquetaTipoCajaEnPantalla } from "@/lib/cajasTesoreriaTipos";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
} from "@/lib/fechaArgentina";
import type {
  AjustarMontoCajaTesoreriaInput,
  CrearMovimientoTesoreriaInput,
  CrearTransferenciaEntreCajasInput,
} from "@/lib/validations/tesoreriaMovimientos";
import type {
  CategoriaMovimientoTesoreria,
  SentidoMovimientoTesoreria,
  TipoCajaTesoreria,
} from "@prisma/client";
import type { ServiceResult } from "@/types";

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

  const cobro = await resolverDatosCobro(input);
  if (!cobro.success) return cobro;

  const created = await prisma.tesoreriaMovimiento.create({
    data: {
      cajaId: input.cajaId,
      tipoMovimiento: sentido.data,
      catMovimiento: input.catMovimiento,
      monto: input.monto,
      fecha: fechaNegocio(input.fecha),
      observacion: input.observacion.trim(),
      pagoId: cobro.data.pagoId,
      entidadId: cobro.data.entidadId,
      cuotaId: cobro.data.cuotaId,
      cxFinId: cobro.data.cxFinId,
      sucursalId: input.sucursalId,
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
  return { success: true, data: created };
}

/** Egreso en la caja origen e ingreso en la caja destino, sin datos de cobro. */
export async function crearTransferenciaEntreCajas(
  input: CrearTransferenciaEntreCajasInput
): Promise<ServiceResult<{ transferenciaGrupoId: string; ids: [string, string] }>> {
  if (input.cajaOrigenId === input.cajaDestinoId) {
    return { success: false, error: "La caja destino tiene que ser otra caja." };
  }
  const [origen, destino, sucursal] = await Promise.all([
    prisma.cajaTesoreria.findUnique({ where: { id: input.cajaOrigenId }, select: { id: true } }),
    prisma.cajaTesoreria.findUnique({ where: { id: input.cajaDestinoId }, select: { id: true } }),
    prisma.sucursal.findUnique({ where: { id: input.sucursalId }, select: { id: true } }),
  ]);
  if (!origen || !destino) return { success: false, error: "Caja inválida." };
  if (!sucursal) return { success: false, error: "Sucursal inválida." };

  const transferenciaGrupoId = randomUUID();
  const fecha = fechaNegocio(input.fecha);
  const observacion = input.observacion.trim();
  const base = {
    catMovimiento: "TRANSFERENCIA_ENTRE_CAJAS" as const,
    monto: input.monto,
    fecha,
    observacion,
    sucursalId: input.sucursalId,
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
 * Saldo por caja = Σ monto con signo de `tipo_movimiento`
 * (INGRESO +, EGRESO −). Sin movimientos → 0.
 */
export async function saldosPorCajaDesdeMovimientos(
  cajaIds?: readonly string[]
): Promise<Map<string, number>> {
  const rows = await prisma.tesoreriaMovimiento.groupBy({
    by: ["cajaId", "tipoMovimiento"],
    where:
      cajaIds && cajaIds.length > 0 ? { cajaId: { in: [...cajaIds] } } : undefined,
    _sum: { monto: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const prev = map.get(row.cajaId) ?? 0;
    const suma = row._sum.monto ?? 0;
    map.set(
      row.cajaId,
      prev + (row.tipoMovimiento === "INGRESO" ? suma : -suma)
    );
  }
  return map;
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
  fechaIso: string;
  sucursalNombre: string;
  tipoMovimiento: SentidoMovimientoTesoreria;
  tipoEtiqueta: string;
  catMovimiento: CategoriaMovimientoTesoreria;
  categoriaEtiqueta: string;
  cajaId: string;
  cajaEtiqueta: string;
  monto: number;
};

function etiquetaCajaMovimiento(caja: {
  titular: string;
  tipoCaja: TipoCajaTesoreria;
  entidad: { nombre: string } | null;
  sucursal: { nombre: string } | null;
}): string {
  const partes = [
    etiquetaTipoCajaEnPantalla(caja.tipoCaja),
    caja.entidad?.nombre.trim()
      ? caja.entidad.nombre.toLocaleUpperCase("es-AR")
      : null,
    caja.sucursal?.nombre.trim()
      ? caja.sucursal.nombre.toLocaleUpperCase("es-AR")
      : null,
    caja.titular.trim()
      ? caja.titular.toLocaleUpperCase("es-AR")
      : null,
  ].filter((parte): parte is string => parte != null && parte.length > 0);
  return partes.join(" - ");
}

/** Listado del ledger para TESORERIA → Movimientos (más recientes primero). */
export async function listarMovimientosTesoreria(): Promise<
  TesoreriaMovimientoFila[]
> {
  const rows = await prisma.tesoreriaMovimiento.findMany({
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fecha: true,
      tipoMovimiento: true,
      catMovimiento: true,
      monto: true,
      cajaId: true,
      sucursal: { select: { nombre: true } },
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

  return rows.map((row) => ({
    id: row.id,
    fechaIso: isoYmdFromPrismaDateOnly(row.fecha),
    sucursalNombre: row.sucursal.nombre.toLocaleUpperCase("es-AR"),
    tipoMovimiento: row.tipoMovimiento,
    tipoEtiqueta: row.tipoMovimiento === "INGRESO" ? "INGRESO" : "EGRESO",
    catMovimiento: row.catMovimiento,
    categoriaEtiqueta: ETIQUETA_CATEGORIA[row.catMovimiento],
    cajaId: row.cajaId,
    cajaEtiqueta: etiquetaCajaMovimiento(row.caja),
    monto: row.monto,
  }));
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
    observacion,
  });
}
