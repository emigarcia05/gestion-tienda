import { Prisma } from "@prisma/client";
import { DUX_API_BATCH_INTERVAL_MS } from "@/lib/duxApiBatchPolicy";
import { DUX_COBROS_API_PAGE_LIMIT, fetchCobrosPage, type CobroDux } from "@/lib/duxCobrosApi";
import {
  dateToIsoYmdArgentina,
  isoYmdFromPrismaDateOnly,
} from "@/lib/fechaArgentina";
import { prisma } from "@/lib/prisma";
import {
  getSyncCobrosDuxStatusFromDb,
  setSyncCobrosDuxErrorInDb,
  setSyncCobrosDuxProgressInDb,
  setSyncCobrosDuxSuccessInDb,
  startSyncCobrosDuxInDb,
} from "@/lib/syncCobrosDuxStatusDb";
import type { ServiceResult } from "@/types";

const DUX_ID_EMPRESA_DEFAULT = 2482;

export type SyncCobrosDuxStepResult = {
  continuing: boolean;
  processed: number;
  total: number;
  fechaDesde: string;
  fechaHasta: string;
};

export type FinVtasCobroFila = {
  id: string;
  idCobro: string;
  idSucursal: string;
  nombreSucursal: string;
  fecha: string;
  descripcion: string;
  monto: string;
  idTarjeta: string;
  idPlanTarjeta: string;
  idTerminal: string;
  tipoValor: string;
};

function idEmpresaDux(): number {
  const raw = process.env.DUX_ID_EMPRESA_COMPRAS;
  if (raw == null || raw === "") return DUX_ID_EMPRESA_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DUX_ID_EMPRESA_DEFAULT;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fechaPrismaDateOnlyFromIsoYmd(isoYmd: string): Date {
  return new Date(`${isoYmd}T12:00:00.000Z`);
}

function primerDiaMesActualIso(ahora: Date = new Date()): string {
  const ymd = dateToIsoYmdArgentina(ahora);
  return `${ymd.slice(0, 8)}01`;
}

async function listarIdDuxSucursalesPtoVtas(): Promise<ServiceResult<number[]>> {
  const rows = await prisma.globalPtoVta.findMany({
    select: {
      sucursales: { select: { sucursal: { select: { idDux: true } } } },
    },
  });
  if (rows.length === 0) {
    return {
      success: false,
      error: "Cargá puntos de venta en Ptos. Vta. antes de consultar cobros.",
    };
  }
  const idDuxSet = new Set<number>();
  for (const row of rows) {
    for (const link of row.sucursales) {
      const raw = (link.sucursal.idDux ?? "").trim();
      if (!/^\d+$/.test(raw)) continue;
      idDuxSet.add(Number(raw));
    }
  }
  if (idDuxSet.size === 0) {
    return {
      success: false,
      error: "No hay sucursales asociadas a puntos de venta con id DUX.",
    };
  }
  return { success: true, data: [...idDuxSet] };
}

async function ventanaConsultaCobros(): Promise<{ fechaDesde: string; fechaHasta: string }> {
  const fechaHasta = dateToIsoYmdArgentina(new Date());
  const last = await prisma.finVtasCobro.aggregate({ _max: { fecha: true } });
  const ultima = last._max.fecha;
  const fechaDesde = ultima ? isoYmdFromPrismaDateOnly(ultima) : primerDiaMesActualIso();
  return { fechaDesde, fechaHasta };
}

function filasDesdeCobros(
  cobros: CobroDux[],
  idDuxPermitidos: Set<string>
): Prisma.FinVtasCobroCreateManyInput[] {
  const filas: Prisma.FinVtasCobroCreateManyInput[] = [];
  for (const cobro of cobros) {
    const idSucursal = String(cobro.idSucursal);
    if (!idDuxPermitidos.has(idSucursal)) continue;
    cobro.cobranza.forEach((linea, idx) => {
      filas.push({
        idCobro: cobro.idCobro,
        idSucursal,
        fecha: fechaPrismaDateOnlyFromIsoYmd(cobro.fecha),
        descripcion: linea.descripcion.slice(0, 500),
        monto: new Prisma.Decimal(linea.monto.toFixed(2)),
        idTarjeta: linea.idTarjeta,
        idPlanTarjeta: linea.idPlanTarjeta,
        idTerminal: linea.idTerminal,
        tipoValor: linea.tipoValor.slice(0, 40),
        linea: idx,
      });
    });
  }
  return filas;
}

async function persistirPagina(
  cobros: CobroDux[],
  idDuxPermitidos: Set<string>
): Promise<number> {
  const filas = filasDesdeCobros(cobros, idDuxPermitidos);
  if (filas.length === 0) return 0;
  const result = await prisma.finVtasCobro.createMany({
    data: filas,
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Un paso de GET `/v2/cobros` (una página). El cliente encadena POST mientras `continuing`.
 * Ventana: última `fecha` persistida (inclusive) → hoy AR; si no hay filas, día 1 del mes en curso.
 */
export async function syncCobrosDuxRunStep(): Promise<ServiceResult<SyncCobrosDuxStepResult>> {
  const idEmpresa = idEmpresaDux();
  if (!Number.isFinite(idEmpresa) || idEmpresa <= 0) {
    return { success: false, error: "ID empresa DUX inválido." };
  }

  try {
    const current = await getSyncCobrosDuxStatusFromDb();
    let meta = current.meta;

    if (!current.running || !meta) {
      const sucursalesRes = await listarIdDuxSucursalesPtoVtas();
      if (!sucursalesRes.success) return sucursalesRes;
      const { fechaDesde, fechaHasta } = await ventanaConsultaCobros();
      meta = {
        fechaDesde,
        fechaHasta,
        sucursales: sucursalesRes.data,
        sucursalIndex: 0,
        offset: 0,
        inserted: 0,
      };
      await startSyncCobrosDuxInDb(sucursalesRes.data.length, meta);
    } else {
      await delay(DUX_API_BATCH_INTERVAL_MS);
    }

    const doneEmptyWindow = meta.fechaDesde > meta.fechaHasta;
    const idSucursal = doneEmptyWindow ? undefined : meta.sucursales[meta.sucursalIndex];
    if (idSucursal == null) {
      await setSyncCobrosDuxSuccessInDb(meta.inserted, meta.sucursales.length);
      return {
        success: true,
        data: {
          continuing: false,
          processed: meta.inserted,
          total: meta.sucursales.length,
          fechaDesde: meta.fechaDesde,
          fechaHasta: meta.fechaHasta,
        },
      };
    }

    const page = await fetchCobrosPage({
      fechaDesde: meta.fechaDesde,
      fechaHasta: meta.fechaHasta,
      idEmpresa,
      idSucursal,
      offset: meta.offset,
      limit: DUX_COBROS_API_PAGE_LIMIT,
    });

    meta.inserted += await persistirPagina(
      page.cobros,
      new Set(meta.sucursales.map((n) => String(n)))
    );

    if (page.hayMas) {
      meta.offset += DUX_COBROS_API_PAGE_LIMIT;
    } else {
      meta.sucursalIndex += 1;
      meta.offset = 0;
    }

    const done = meta.sucursalIndex >= meta.sucursales.length;
    if (done) {
      await setSyncCobrosDuxSuccessInDb(meta.inserted, meta.sucursales.length);
      return {
        success: true,
        data: {
          continuing: false,
          processed: meta.inserted,
          total: meta.sucursales.length,
          fechaDesde: meta.fechaDesde,
          fechaHasta: meta.fechaHasta,
        },
      };
    }

    await setSyncCobrosDuxProgressInDb({
      processed: meta.sucursalIndex,
      total: meta.sucursales.length,
      meta,
    });

    return {
      success: true,
      data: {
        continuing: true,
        processed: meta.sucursalIndex,
        total: meta.sucursales.length,
        fechaDesde: meta.fechaDesde,
        fechaHasta: meta.fechaHasta,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo consultar cobros DUX.";
    console.error("[vtasCobros][syncCobrosDuxRunStep]", e);
    await setSyncCobrosDuxErrorInDb(message);
    return { success: false, error: message };
  }
}

export async function listarFinVtasCobros(params: {
  mes: number;
  anio: number;
}): Promise<FinVtasCobroFila[]> {
  try {
    const desde = new Date(Date.UTC(params.anio, params.mes - 1, 1));
    const hastaExcl = new Date(Date.UTC(params.anio, params.mes, 1));
    const rows = await prisma.finVtasCobro.findMany({
      where: {
        fecha: { gte: desde, lt: hastaExcl },
      },
      orderBy: [{ fecha: "asc" }, { idCobro: "asc" }, { linea: "asc" }],
      select: {
        id: true,
        idCobro: true,
        idSucursal: true,
        fecha: true,
        descripcion: true,
        monto: true,
        idTarjeta: true,
        idPlanTarjeta: true,
        idTerminal: true,
        tipoValor: true,
        sucursal: { select: { nombre: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      idCobro: r.idCobro.toString(),
      idSucursal: r.idSucursal,
      nombreSucursal: r.sucursal.nombre.toLocaleUpperCase("es-AR"),
      fecha: isoYmdFromPrismaDateOnly(r.fecha),
      descripcion: r.descripcion,
      monto: r.monto.toFixed(2),
      idTarjeta: r.idTarjeta != null ? r.idTarjeta.toString() : "",
      idPlanTarjeta: r.idPlanTarjeta != null ? r.idPlanTarjeta.toString() : "",
      idTerminal: r.idTerminal != null ? r.idTerminal.toString() : "",
      tipoValor: r.tipoValor,
    }));
  } catch (e) {
    console.error("[vtasCobros][listarFinVtasCobros]", e);
    return [];
  }
}
