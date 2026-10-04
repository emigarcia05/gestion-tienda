import type {
  Prisma,
  TipoCajaTesoreria,
  TipoValorTesoreria,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";
import { tipoValorCompatibleConTipoCaja } from "@/lib/cajasTesoreriaTipos";
import type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";
import { resolverNombreTitularFinanciero } from "@/services/globalPersonal.service";
import { saldosPorCajaDesdeMovimientos } from "@/services/tesoreriaMovimientos.service";

export type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";

const CAJA_TESORERIA_LIST_INCLUDE = {
  entidad: { select: { id: true, nombre: true } },
  sucursal: { select: { id: true, nombre: true } },
} as const;

type CajaTesoreriaRowLista = Prisma.CajaTesoreriaGetPayload<{
  include: typeof CAJA_TESORERIA_LIST_INCLUDE;
}>;

export interface CajaTesoreriaItem {
  id: string;
  entidadId: string | null;
  /** Texto del catálogo `cobros_entidades.nombre` (MAYÚSCULAS). Vacío si no hay entidad. */
  entidadNombre: string;
  titular: string;
  sucursalId: string | null;
  sucursalNombre: string;
  tipoCaja: TipoCajaTesoreria;
  tipoValor: TipoValorTesoreria;
  supervisionFiscal: boolean;
  /** Caché legacy en `tesoreria_cajas.monto`. La UI usa `montoDisponible`. */
  monto: number;
  /**
   * Saldo de la caja = Σ `tesoreria_movimientos.monto` con signo de `tipo_movimiento`
   * (INGRESO +, EGRESO −). Sin movimientos → 0.
   */
  montoDisponible: number;
  /**
   * Última actualización registrada en la caja (campo legacy de ordenado local).
   */
  ultActualizacion: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrearCajaTesoreriaInput {
  entidadId: string | null;
  titular: string;
  sucursalId: string | null;
  tipoCaja: TipoCajaTesoreria;
  tipoValor: TipoValorTesoreria;
  monto: number;
}

export interface EditarCajaTesoreriaInput {
  id: string;
  entidadId: string | null;
  titular: string;
  sucursalId: string | null;
  tipoCaja: TipoCajaTesoreria;
  tipoValor: TipoValorTesoreria;
  monto: number;
}

export interface SucursalTesoreriaOption {
  id: string;
  nombre: string;
}

function mapCaja(
  row: CajaTesoreriaRowLista,
  montoDisponible: number
): CajaTesoreriaItem {
  return {
    id: row.id,
    entidadId: row.entidadId,
    entidadNombre: row.entidad ? row.entidad.nombre.toLocaleUpperCase("es-AR") : "",
    titular: row.titular.toUpperCase(),
    sucursalId: row.sucursalId,
    sucursalNombre: row.sucursal
      ? row.sucursal.nombre.toLocaleUpperCase("es-AR")
      : "",
    tipoCaja: row.tipoCaja,
    tipoValor: row.tipoValor,
    supervisionFiscal: row.supervisionFiscal,
    monto: montoDisponible,
    montoDisponible,
    ultActualizacion: row.ultActualizacion,
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
    if (code === "P2002") return "Ya existe una caja con esos datos.";
    if (code === "P2003") return "Sucursal o entidad inválida.";
    if (code === "P2025") return "Caja no encontrada.";
  }
  return error instanceof Error ? error.message : fallback;
}

function normalizarNombreEntidadFinTesoreria(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

export async function listarEntidadesFinTesoreria(): Promise<FinTesoreriaEntidadItem[]> {
  const rows = await prisma.finAnaCosFinaTerminalMarca.findMany({
    orderBy: [{ nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return rows.map((r) => ({ id: r.id, nombre: r.nombre.toUpperCase() }));
}

export async function listarSucursalesTesoreria(): Promise<SucursalTesoreriaOption[]> {
  const rows = await prisma.sucursal.findMany({
    orderBy: [{ nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre.toLocaleUpperCase("es-AR"),
  }));
}

async function resolverSucursalCajaTesoreria(
  tipoCaja: TipoCajaTesoreria,
  sucursalId: string | null
): Promise<ServiceResult<string | null>> {
  if (tipoCaja === "CHEQUE" || !sucursalId) {
    return { success: true, data: null };
  }
  const sucursal = await prisma.sucursal.findUnique({
    where: { id: sucursalId },
    select: { id: true },
  });
  if (!sucursal) return { success: false, error: "Sucursal inválida." };
  return { success: true, data: sucursal.id };
}

function mapDbErrorEntidad(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "Ya existe una entidad con ese nombre.";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function crearFinTesoreriaEntidad(
  nombre: string
): Promise<ServiceResult<FinTesoreriaEntidadItem>> {
  const norm = normalizarNombreEntidadFinTesoreria(nombre);
  if (!norm) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  try {
    const maxOrden = await prisma.finAnaCosFinaTerminalMarca.aggregate({
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;
    const row = await prisma.finAnaCosFinaTerminalMarca.create({
      data: { nombre: norm, orden },
      select: { id: true, nombre: true },
    });
    return {
      success: true,
      data: { id: row.id, nombre: row.nombre.toUpperCase() },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbErrorEntidad(error, "No se pudo crear la entidad."),
    };
  }
}

export async function editarFinTesoreriaEntidad(
  id: string,
  nombre: string
): Promise<ServiceResult<FinTesoreriaEntidadItem>> {
  const norm = normalizarNombreEntidadFinTesoreria(nombre);
  if (!norm) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  try {
    const row = await prisma.finAnaCosFinaTerminalMarca.update({
      where: { id },
      data: { nombre: norm },
      select: { id: true, nombre: true },
    });
    return {
      success: true,
      data: { id: row.id, nombre: row.nombre.toUpperCase() },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbErrorEntidad(error, "No se pudo editar la entidad."),
    };
  }
}

export async function eliminarFinTesoreriaEntidad(id: string): Promise<ServiceResult<void>> {
  const n = await prisma.cajaTesoreria.count({ where: { entidadId: id } });
  if (n > 0) {
    return {
      success: false,
      error: "No se puede eliminar: hay cajas de tesorería que usan esta entidad.",
    };
  }
  try {
    await prisma.finAnaCosFinaTerminalMarca.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbErrorEntidad(error, "No se pudo eliminar la entidad."),
    };
  }
}

export async function listarCajasTesoreria(): Promise<CajaTesoreriaItem[]> {
  const rows = await prisma.cajaTesoreria.findMany({
    include: CAJA_TESORERIA_LIST_INCLUDE,
    orderBy: [{ entidad: { nombre: "asc" } }],
  });
  const ids = rows.map((row) => row.id);
  const saldos = await saldosPorCajaDesdeMovimientos(ids);
  return rows.map((row) => {
    const saldo = saldos.get(row.id) ?? 0;
    return mapCaja(row, saldo);
  });
}

/** Cajas con un `tipo_caja` dado (p. ej. **BANCO**). */
export async function listarCajasTesoreriaPorTipoCaja(
  tipoCaja: TipoCajaTesoreria
): Promise<CajaTesoreriaItem[]> {
  const rows = await prisma.cajaTesoreria.findMany({
    where: { tipoCaja },
    include: CAJA_TESORERIA_LIST_INCLUDE,
    orderBy: [{ entidad: { nombre: "asc" } }],
  });
  const ids = rows.map((row) => row.id);
  const saldos = await saldosPorCajaDesdeMovimientos(ids);
  return rows.map((row) => {
    const saldo = saldos.get(row.id) ?? 0;
    return mapCaja(row, saldo);
  });
}

export async function crearCajaTesoreria(
  input: CrearCajaTesoreriaInput
): Promise<ServiceResult<CajaTesoreriaItem>> {
  const esperadoTvOk = tipoValorCompatibleConTipoCaja(input.tipoCaja, input.tipoValor);
  if (!esperadoTvOk) {
    return {
      success: false,
      error: "La combinación tipo de caja / tipo de valor no es válida para las reglas de tesorería.",
    };
  }
  const sucursalOk = await resolverSucursalCajaTesoreria(input.tipoCaja, input.sucursalId);
  if (!sucursalOk.success) return sucursalOk;
  const titularOk = await resolverNombreTitularFinanciero(input.titular);
  if (!titularOk.success) return titularOk;
  try {
    const row = await prisma.cajaTesoreria.create({
      data: {
        entidadId: input.entidadId,
        titular: titularOk.data,
        sucursalId: sucursalOk.data,
        tipoCaja: input.tipoCaja,
        tipoValor: input.tipoValor,
        monto: input.monto,
      },
      include: CAJA_TESORERIA_LIST_INCLUDE,
    });
    return {
      success: true,
      data: mapCaja(row, 0),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la caja de tesorería."),
    };
  }
}

export async function editarCajaTesoreria(
  input: EditarCajaTesoreriaInput
): Promise<ServiceResult<CajaTesoreriaItem>> {
  try {
    const existing = await prisma.cajaTesoreria.findUnique({
      where: { id: input.id },
      select: { tipoCaja: true, titular: true },
    });
    if (!existing) {
      return { success: false, error: "Caja no encontrada." };
    }
    if (!tipoValorCompatibleConTipoCaja(input.tipoCaja, input.tipoValor)) {
      return {
        success: false,
        error: "La combinación tipo de caja / tipo de valor no es válida para las reglas de tesorería.",
      };
    }

    const sucursalOk = await resolverSucursalCajaTesoreria(input.tipoCaja, input.sucursalId);
    if (!sucursalOk.success) return sucursalOk;
    const titularOk = await resolverNombreTitularFinanciero(
      input.titular,
      existing.titular
    );
    if (!titularOk.success) return titularOk;

    const row = await prisma.cajaTesoreria.update({
      where: { id: input.id },
      data: {
        entidadId: input.entidadId,
        titular: titularOk.data,
        sucursalId: sucursalOk.data,
        tipoCaja: input.tipoCaja,
        tipoValor: input.tipoValor,
        monto: input.monto,
      },
      include: CAJA_TESORERIA_LIST_INCLUDE,
    });
    const saldos = await saldosPorCajaDesdeMovimientos([row.id]);
    const saldo = saldos.get(row.id) ?? 0;
    return { success: true, data: mapCaja(row, saldo) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo editar la caja de tesorería."),
    };
  }
}

export async function eliminarCajaTesoreria(id: string): Promise<ServiceResult<void>> {
  try {
    const movimientosAsociados = await prisma.tesoreriaMovimiento.count({
      where: {
        OR: [{ cajaId: id }, { cajaContraparteId: id }],
      },
    });
    if (movimientosAsociados > 0) {
      return {
        success: false,
        error: "No se puede eliminar: la caja tiene movimientos de tesorería registrados.",
      };
    }
    await prisma.cajaTesoreria.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la caja de tesorería."),
    };
  }
}
