import type {
  Prisma,
  TipoCajaTesoreria,
  TipoValorTesoreria,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";
import type { ServiceResult } from "@/types";
import {
  sumarMontosChequesAcreditadosHasta,
  sumarMontosChequesDiferidosPorCaja,
} from "@/services/finTesoreriaCheques.service";
import { tipoValorDesdeTipoCaja } from "@/lib/cajasTesoreriaTipos";
import type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";
import { resolverNombreTitularFinanciero } from "@/services/globalPersonal.service";

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
  entidadId: string;
  /** Texto del catálogo `tesoreria_cobros_entidades.nombre` (MAYÚSCULAS). */
  entidadNombre: string;
  titular: string;
  sucursalId: string | null;
  sucursalNombre: string;
  tipoCaja: TipoCajaTesoreria;
  tipoValor: TipoValorTesoreria;
  supervisionFiscal: boolean;
  /** Valor persistido en `tesoreria_cajas.monto` (para edición legacy; en CHEQUE no alimenta el disponible). */
  monto: number;
  /**
   * Monto que cuenta para totales y “caja disponible”: en `CHEQUE`, suma de `tesoreria_cheques`
   * con `fecha_acreditacion` ≤ hoy (calendario Argentina); en otros tipos, igual a `monto`.
   */
  montoDisponible: number;
  /**
   * Solo `CHEQUE`: suma de cheques con `fecha_acreditacion` > hoy (diferidos). En otros tipos, `0`.
   */
  montoChequesDiferidos: number;
  ultActualizacion: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrearCajaTesoreriaInput {
  entidadId: string;
  titular: string;
  sucursalId: string | null;
  tipoCaja: TipoCajaTesoreria;
  tipoValor: TipoValorTesoreria;
  monto: number;
}

export interface EditarCajaTesoreriaInput {
  id: string;
  entidadId: string;
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
  montoDisponible: number,
  montoChequesDiferidos: number
): CajaTesoreriaItem {
  return {
    id: row.id,
    entidadId: row.entidadId,
    entidadNombre: row.entidad.nombre.toUpperCase(),
    titular: row.titular.toUpperCase(),
    sucursalId: row.sucursalId,
    sucursalNombre: row.sucursal
      ? row.sucursal.nombre.toLocaleUpperCase("es-AR")
      : "",
    tipoCaja: row.tipoCaja,
    tipoValor: row.tipoValor,
    supervisionFiscal: row.supervisionFiscal,
    monto: row.monto,
    montoDisponible,
    montoChequesDiferidos,
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
  if (tipoCaja === "CHEQUE") {
    return { success: true, data: null };
  }
  if (!sucursalId) {
    return { success: false, error: "Seleccioná una sucursal." };
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
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const [sumasCheque, sumasDiferido] = await Promise.all([
    sumarMontosChequesAcreditadosHasta(hoyIso),
    sumarMontosChequesDiferidosPorCaja(hoyIso),
  ]);
  return rows.map((row) => {
    const disponible =
      row.tipoCaja === "CHEQUE" ? (sumasCheque.get(row.id) ?? 0) : row.monto;
    const diferido =
      row.tipoCaja === "CHEQUE" ? (sumasDiferido.get(row.id) ?? 0) : 0;
    return mapCaja(row, disponible, diferido);
  });
}

/** Cajas con un `tipo_caja` dado (p. ej. **BANCO** como destino de acreditación de cheques). */
export async function listarCajasTesoreriaPorTipoCaja(
  tipoCaja: TipoCajaTesoreria
): Promise<CajaTesoreriaItem[]> {
  const rows = await prisma.cajaTesoreria.findMany({
    where: { tipoCaja },
    include: CAJA_TESORERIA_LIST_INCLUDE,
    orderBy: [{ entidad: { nombre: "asc" } }],
  });
  const hoyIso = dateToIsoYmdArgentina(new Date());
  const [sumasCheque, sumasDiferido] = await Promise.all([
    sumarMontosChequesAcreditadosHasta(hoyIso),
    sumarMontosChequesDiferidosPorCaja(hoyIso),
  ]);
  return rows.map((row) => {
    const disponible =
      row.tipoCaja === "CHEQUE" ? (sumasCheque.get(row.id) ?? 0) : row.monto;
    const diferido =
      row.tipoCaja === "CHEQUE" ? (sumasDiferido.get(row.id) ?? 0) : 0;
    return mapCaja(row, disponible, diferido);
  });
}

export async function crearCajaTesoreria(
  input: CrearCajaTesoreriaInput
): Promise<ServiceResult<CajaTesoreriaItem>> {
  const esperadoTv = tipoValorDesdeTipoCaja(input.tipoCaja);
  if (input.tipoValor !== esperadoTv) {
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
      data: mapCaja(row, row.tipoCaja === "CHEQUE" ? 0 : row.monto, 0),
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
    if (existing.tipoCaja === "CHEQUE" && input.tipoCaja !== "CHEQUE") {
      const n = await prisma.finTesoreriaCheque.count({ where: { cajaId: input.id } });
      if (n > 0) {
        return {
          success: false,
          error: "No se puede cambiar el tipo: la caja tiene cheques registrados.",
        };
      }
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
    const hoyIso = dateToIsoYmdArgentina(new Date());
    const [sumasCheque, sumasDiferido] = await Promise.all([
      sumarMontosChequesAcreditadosHasta(hoyIso),
      sumarMontosChequesDiferidosPorCaja(hoyIso),
    ]);
    const disponible =
      row.tipoCaja === "CHEQUE" ? (sumasCheque.get(row.id) ?? 0) : row.monto;
    const diferido =
      row.tipoCaja === "CHEQUE" ? (sumasDiferido.get(row.id) ?? 0) : 0;
    return { success: true, data: mapCaja(row, disponible, diferido) };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo editar la caja de tesorería."),
    };
  }
}

export async function eliminarCajaTesoreria(id: string): Promise<ServiceResult<void>> {
  try {
    const chequesAsociados = await prisma.finTesoreriaCheque.count({ where: { cajaId: id } });
    if (chequesAsociados > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar la caja: tiene cheques asociados. Transferí o eliminá los cheques primero.",
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
