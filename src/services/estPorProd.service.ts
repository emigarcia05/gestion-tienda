import { prisma } from "@/lib/prisma";
import type {
  EstPorProdCeldaCarga,
  ImportarEstPorProdResultado,
  SucursalEstOption,
} from "@/lib/estPorProdTypes";
import type { ImportarEstPorProdInput } from "@/lib/validations/estPorProd";
import type { ServiceResult } from "@/types";

export type {
  EstPorProdCeldaCarga,
  ImportarEstPorProdResultado,
  SucursalEstOption,
} from "@/lib/estPorProdTypes";

const IMPORT_UPSERT_CHUNK = 100;

/** Sucursales elegibles para Carga de Datos: `genera_est = true`. */
export async function listarSucursalesParaEstPorProd(): Promise<SucursalEstOption[]> {
  try {
    const rows = await prisma.sucursal.findMany({
      where: { generaEst: true },
      select: { id: true, nombre: true },
      orderBy: [{ nombre: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre.toLocaleUpperCase("es"),
    }));
  } catch (e: unknown) {
    console.error("[estPorProd.service] listarSucursalesParaEstPorProd:", e);
    return [];
  }
}

/** Ocupación de la grilla Carga de Datos: count por (sucursal, mes, anio). */
export async function listarEstPorProdCeldasCargadas(): Promise<EstPorProdCeldaCarga[]> {
  try {
    const rows = await prisma.estPorProd.groupBy({
      by: ["sucursalId", "mes", "anio"],
      _count: { _all: true },
    });
    return rows.map((r) => ({
      sucursalId: r.sucursalId,
      mes: r.mes,
      anio: r.anio,
      cantidad: r._count._all,
    }));
  } catch (e: unknown) {
    console.error("[estPorProd.service] listarEstPorProdCeldasCargadas:", e);
    return [];
  }
}

async function sucursalGeneraEst(sucursalId: string): Promise<boolean> {
  const s = await prisma.sucursal.findUnique({
    where: { id: sucursalId },
    select: { generaEst: true },
  });
  return s?.generaEst === true;
}

export interface EstPorProdPeriodoExistente {
  existe: boolean;
  cantidad: number;
}

function mapEstPorProdDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2021" || code === "P2022") {
      return "Falta la tabla est_por_prod en la base. Aplicá las migraciones Prisma.";
    }
  }
  const msg = error instanceof Error ? error.message : "";
  if (/est_por_prod/i.test(msg) && /does not exist|no existe|P2021/i.test(msg)) {
    return "Falta la tabla est_por_prod en la base. Aplicá las migraciones Prisma.";
  }
  return msg || fallback;
}

export async function verificarEstPorProdPeriodo(
  sucursalId: string,
  mes: number,
  anio: number
): Promise<ServiceResult<EstPorProdPeriodoExistente>> {
  try {
    const cantidad = await prisma.estPorProd.count({
      where: { sucursalId, mes, anio },
    });
    return { success: true, data: { existe: cantidad > 0, cantidad } };
  } catch (e: unknown) {
    console.error("[estPorProd.service] verificarEstPorProdPeriodo:", e);
    return {
      success: false,
      error: mapEstPorProdDbError(e, "No se pudo verificar el periodo."),
    };
  }
}

async function eliminarEstPorProdPorPeriodoInternal(
  sucursalId: string,
  mes: number,
  anio: number
): Promise<number> {
  const res = await prisma.estPorProd.deleteMany({
    where: { sucursalId, mes, anio },
  });
  return res.count;
}

/** Borra todos los productos de un periodo × sucursal (única vía de baja en Carga de Datos). */
export async function eliminarEstPorProdPorPeriodo(
  sucursalId: string,
  mes: number,
  anio: number
): Promise<ServiceResult<{ eliminados: number }>> {
  try {
    const eliminados = await eliminarEstPorProdPorPeriodoInternal(sucursalId, mes, anio);
    return { success: true, data: { eliminados } };
  } catch (e: unknown) {
    console.error("[estPorProd.service] eliminarEstPorProdPorPeriodo:", e);
    return {
      success: false,
      error: mapEstPorProdDbError(e, "No se pudo eliminar el periodo."),
    };
  }
}

/**
 * Carga masiva por periodo × sucursal (unidad de trabajo de Carga de Datos).
 * Siempre limpia TODO el bloque mes/año/sucursal y vuelve a insertar la planilla;
 * no se trabaja ítem a ítem ni se dejan filas huérfanas del archivo anterior.
 */
export async function importarEstPorProd(
  input: ImportarEstPorProdInput
): Promise<ServiceResult<ImportarEstPorProdResultado>> {
  if (!(await sucursalGeneraEst(input.sucursalId))) {
    return {
      success: false,
      error: "La sucursal no existe o no tiene genera_est habilitado.",
    };
  }

  const periodoRes = await verificarEstPorProdPeriodo(
    input.sucursalId,
    input.mes,
    input.anio
  );
  if (!periodoRes.success) {
    return { success: false, error: periodoRes.error };
  }
  const periodoExistente = periodoRes.data;
  if (periodoExistente.existe && !input.reemplazarPeriodo) {
    return {
      success: false,
      error: "Ya existen datos para este periodo y sucursal. Confirmá el reemplazo.",
    };
  }

  const codigosUnicos = [...new Set(input.lineas.map((l) => l.codTienda))];
  const existentes = await prisma.prodPropio.findMany({
    where: { codTienda: { in: codigosUnicos } },
    select: { codTienda: true },
  });
  const codigosValidos = new Set(existentes.map((e) => e.codTienda));

  const lineasValidas = input.lineas.filter((l) => codigosValidos.has(l.codTienda));
  const omitidos = input.lineas
    .filter((l) => !codigosValidos.has(l.codTienda))
    .map((l) => l.codTienda);
  const codigosOmitidos = [...new Set(omitidos)].slice(0, 20);

  if (lineasValidas.length === 0) {
    return {
      success: false,
      error: "Ningún código de tienda de la planilla existe en el catálogo prod_propios.",
    };
  }

  const porCodigo = new Map<string, number>();
  for (const linea of lineasValidas) {
    porCodigo.set(linea.codTienda, linea.vtasEnUn);
  }

  try {
    // Siempre borrar el periodo completo de la sucursal antes de insertar.
    const reemplazados = await eliminarEstPorProdPorPeriodoInternal(
      input.sucursalId,
      input.mes,
      input.anio
    );

    const entries = [...porCodigo.entries()];
    for (let i = 0; i < entries.length; i += IMPORT_UPSERT_CHUNK) {
      const slice = entries.slice(i, i + IMPORT_UPSERT_CHUNK);
      await prisma.estPorProd.createMany({
        data: slice.map(([codTienda, vtasEnUn]) => ({
          sucursalId: input.sucursalId,
          mes: input.mes,
          anio: input.anio,
          codTienda,
          vtasEnUn,
        })),
      });
    }

    return {
      success: true,
      data: {
        importados: porCodigo.size,
        omitidosCodTiendaInexistente: omitidos.length,
        codigosOmitidos,
        reemplazados,
      },
    };
  } catch (e: unknown) {
    const msg = mapEstPorProdDbError(e, "No se pudo importar la planilla.");
    return { success: false, error: msg };
  }
}
