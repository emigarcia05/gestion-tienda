import { prisma } from "@/lib/prisma";
import type {
  GuardarFinBalVtasCargaPeriodoInput,
} from "@/lib/validations/finBalVtas";
import type { ServiceResult } from "@/types";

export interface SucursalGeneraBalanceOption {
  id: string;
  nombre: string;
}

export interface FinBalVtasItem {
  id: string;
  sucursalId: string;
  mes: number;
  anio: number;
  monto: number;
  createdAt: Date;
  updatedAt: Date;
  sucursal: { id: string; nombre: string };
}

function mapFinBalVtasRow(row: {
  id: string;
  sucursalId: string;
  mes: number;
  anio: number;
  monto: number;
  createdAt: Date;
  updatedAt: Date;
  sucursal: { id: string; nombre: string };
}): FinBalVtasItem {
  return {
    id: row.id,
    sucursalId: row.sucursalId,
    mes: row.mes,
    anio: row.anio,
    monto: row.monto,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sucursal: {
      id: row.sucursal.id,
      nombre: row.sucursal.nombre.toLocaleUpperCase("es"),
    },
  };
}

/** Sucursales elegibles: solo `genera_balance = true` (regla de negocio pedida). */
export async function listarSucursalesGeneraBalanceParaVtas(): Promise<SucursalGeneraBalanceOption[]> {
  const rows = await prisma.sucursal.findMany({
    where: { generaBalance: true },
    select: { id: true, nombre: true },
    orderBy: [{ nombre: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre.toLocaleUpperCase("es"),
  }));
}

export async function listarFinBalVtas(): Promise<FinBalVtasItem[]> {
  const rows = await prisma.finBalVtas.findMany({
    orderBy: [{ anio: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
    include: { sucursal: { select: { id: true, nombre: true } } },
  });
  return rows.map(mapFinBalVtasRow);
}

/** Ventas cargadas para un periodo (balance mensual). */
export async function listarFinBalVtasPorMesAnio(mes: number, anio: number): Promise<FinBalVtasItem[]> {
  const rows = await prisma.finBalVtas.findMany({
    where: { mes, anio },
    orderBy: [{ sucursal: { nombre: "asc" } }],
    include: { sucursal: { select: { id: true, nombre: true } } },
  });
  return rows.map(mapFinBalVtasRow);
}

async function sucursalGeneraBalance(sucursalId: string): Promise<boolean> {
  const s = await prisma.sucursal.findUnique({
    where: { id: sucursalId },
    select: { generaBalance: true },
  });
  return Boolean(s?.generaBalance);
}

/** Upsert de una o más sucursales para el mismo mes/año (carga masiva del modal). */
export async function guardarFinBalVtasCargaPeriodo(
  input: GuardarFinBalVtasCargaPeriodoInput
): Promise<ServiceResult<{ guardados: number }>> {
  for (const linea of input.lineas) {
    if (!(await sucursalGeneraBalance(linea.sucursalId))) {
      return {
        success: false,
        error: "Una sucursal no existe o no tiene activado “generar balance”.",
      };
    }
  }

  try {
    await prisma.$transaction(
      input.lineas.map((linea) =>
        prisma.finBalVtas.upsert({
          where: {
            sucursalId_mes_anio: {
              sucursalId: linea.sucursalId,
              mes: input.mes,
              anio: input.anio,
            },
          },
          create: {
            sucursalId: linea.sucursalId,
            mes: input.mes,
            anio: input.anio,
            monto: linea.monto,
          },
          update: { monto: linea.monto },
        })
      )
    );
    return { success: true, data: { guardados: input.lineas.length } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo guardar la carga de ventas.";
    return { success: false, error: msg };
  }
}

/** Elimina las ventas de todas las sucursales para un mes/año. */
export async function eliminarFinBalVtasPorPeriodo(
  mes: number,
  anio: number
): Promise<ServiceResult<{ eliminados: number }>> {
  try {
    const res = await prisma.finBalVtas.deleteMany({ where: { mes, anio } });
    return { success: true, data: { eliminados: res.count } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo eliminar el periodo.";
    return { success: false, error: msg };
  }
}
