import { Prisma } from "@prisma/client";
import { DUX_API_BATCH_INTERVAL_MS } from "@/lib/duxApiBatchPolicy";
import {
  DUX_REMITOS_VENTA_API_PAGE_LIMIT,
  fetchRemitosVentaPage,
} from "@/lib/duxRemitosVentaApi";
import {
  parseImporteFacturaDux,
  parseNroPtoVtaDux,
  periodoCalendarioDesdeFechaIsoYmd,
  rangoIsoMesCalendario,
  remitoVentaEntraEnTotal,
} from "@/lib/finFactCobrosFacturas";
import { prisma } from "@/lib/prisma";
import {
  getSyncFacturasVentasDuxStatusFromDb,
  setSyncFacturasVentasDuxErrorInDb,
  setSyncFacturasVentasDuxProgressInDb,
  setSyncFacturasVentasDuxSuccessInDb,
  startSyncFacturasVentasDuxInDb,
  type SyncFacturasVentasDuxMeta,
} from "@/lib/syncFacturasVentasDuxStatusDb";
import type { ServiceResult } from "@/types";

const DUX_ID_EMPRESA_DEFAULT = 2482;

export type SyncFacturasVentasDuxStepResult = {
  continuing: boolean;
  processed: number;
  total: number;
  mes: number;
  anio: number;
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

type CatalogoPtoSync = {
  id: string;
  sucursalesDux: Set<number>;
};

async function cargarCatalogoPtoVtasSync(): Promise<
  ServiceResult<{
    porNro: Map<number, CatalogoPtoSync>;
    idDuxSucursales: number[];
  }>
> {
  const rows = await prisma.globalPtoVta.findMany({
    select: {
      id: true,
      ptoVenta: true,
      sucursales: {
        select: { sucursal: { select: { idDux: true } } },
      },
    },
  });
  if (rows.length === 0) {
    return {
      success: false,
      error: "Cargá puntos de venta en Ptos. Vta. antes de sincronizar.",
    };
  }
  const porNro = new Map<number, CatalogoPtoSync>();
  const idDuxSet = new Set<number>();
  for (const row of rows) {
    const sucursalesDux = new Set<number>();
    for (const link of row.sucursales) {
      const raw = (link.sucursal.idDux ?? "").trim();
      if (!/^\d+$/.test(raw)) continue;
      const n = Number(raw);
      sucursalesDux.add(n);
      idDuxSet.add(n);
    }
    porNro.set(row.ptoVenta, { id: row.id, sucursalesDux });
  }
  if (idDuxSet.size === 0) {
    return {
      success: false,
      error: "No hay sucursales asociadas a puntos de venta con id DUX.",
    };
  }
  return {
    success: true,
    data: { porNro, idDuxSucursales: [...idDuxSet] },
  };
}

function aplicarRemitoAlAcumulado(
  meta: SyncFacturasVentasDuxMeta,
  remito: {
    idRemitoVenta: number;
    nroPtoVta: string;
    fecha: string;
    anulado: boolean;
    estadoFacturacion: string;
    nroFacturaString: string;
    nrosFacturaVinculados: string[];
    totalFacturaAsociada: unknown;
  },
  catalogo: Map<number, CatalogoPtoSync>,
  idSucursalDux: number
): void {
  if (meta.idsVistos.includes(remito.idRemitoVenta)) return;
  meta.idsVistos.push(remito.idRemitoVenta);
  meta.scanned += 1;

  const periodo = periodoCalendarioDesdeFechaIsoYmd(remito.fecha);
  if (!periodo || periodo.mes !== meta.mes || periodo.anio !== meta.anio) return;

  const nro = parseNroPtoVtaDux(remito.nroPtoVta);
  if (nro == null) return;
  const pto = catalogo.get(nro);
  if (!pto || !pto.sucursalesDux.has(idSucursalDux)) return;

  const estado = remito.estadoFacturacion.trim().toUpperCase();
  if (estado && estado !== "FACTURADO") return;

  if (
    !remitoVentaEntraEnTotal({
      anulado: remito.anulado,
      nroFacturaString: remito.nroFacturaString,
      nrosFacturaVinculados: remito.nrosFacturaVinculados,
      totalFacturaAsociada: remito.totalFacturaAsociada,
    })
  ) {
    return;
  }

  const monto = parseImporteFacturaDux(remito.totalFacturaAsociada);
  const delta = new Prisma.Decimal(monto.toFixed(4));
  const actual = new Prisma.Decimal(meta.acumulado[pto.id] ?? "0");
  meta.acumulado[pto.id] = actual.plus(delta).toFixed(4);
}

async function persistirAcumulado(meta: SyncFacturasVentasDuxMeta): Promise<void> {
  const idsValidos = new Set(
    (await prisma.globalPtoVta.findMany({ select: { id: true } })).map((r) => r.id)
  );
  const filas = Object.entries(meta.acumulado)
    .filter(([ptoVtaId]) => idsValidos.has(ptoVtaId))
    .map(([ptoVtaId, monto]) => ({
      ptoVtaId,
      mes: meta.mes,
      anio: meta.anio,
      montoGravado: new Prisma.Decimal(monto),
    }));

  await prisma.$transaction(async (tx) => {
    await tx.finFactCobrosPtoVtaMes.deleteMany({
      where: { mes: meta.mes, anio: meta.anio },
    });
    if (filas.length > 0) {
      await tx.finFactCobrosPtoVtaMes.createMany({ data: filas });
    }
  });
}

/**
 * Un paso de sync DUX GET `/v2/remitos-venta` (una página). El cliente encadena POST mientras `continuing`.
 */
export async function syncFacturasVentasDuxRunStep(params: {
  mes: number;
  anio: number;
}): Promise<ServiceResult<SyncFacturasVentasDuxStepResult>> {
  const { mes, anio } = params;
  const idEmpresa = idEmpresaDux();
  if (!Number.isFinite(idEmpresa) || idEmpresa <= 0) {
    return { success: false, error: "ID empresa DUX inválido." };
  }

  try {
    const current = await getSyncFacturasVentasDuxStatusFromDb();
    let meta = current.meta;

    if (
      current.running &&
      meta &&
      (meta.mes !== mes || meta.anio !== anio)
    ) {
      return {
        success: false,
        error: "Ya hay una sincronización de remitos en curso para otro periodo.",
      };
    }

    if (!current.running || !meta || meta.mes !== mes || meta.anio !== anio) {
      const catalogoInicio = await cargarCatalogoPtoVtasSync();
      if (!catalogoInicio.success) return catalogoInicio;
      const sucursales = catalogoInicio.data.idDuxSucursales;
      meta = {
        mes,
        anio,
        sucursales,
        sucursalIndex: 0,
        offset: 0,
        acumulado: {},
        idsVistos: [],
        scanned: 0,
      };
      await startSyncFacturasVentasDuxInDb(sucursales.length, meta);
    } else {
      await delay(DUX_API_BATCH_INTERVAL_MS);
    }

    const catalogo = await cargarCatalogoPtoVtasSync();
    if (!catalogo.success) return catalogo;

    const idSucursal = meta.sucursales[meta.sucursalIndex];
    if (idSucursal == null) {
      await persistirAcumulado(meta);
      await setSyncFacturasVentasDuxSuccessInDb(meta.scanned, meta.sucursales.length);
      return {
        success: true,
        data: {
          continuing: false,
          processed: meta.scanned,
          total: meta.sucursales.length,
          mes,
          anio,
        },
      };
    }

    const { fechaDesde, fechaHasta } = rangoIsoMesCalendario(mes, anio);
    const page = await fetchRemitosVentaPage({
      fechaDesde,
      fechaHasta,
      idEmpresa,
      idSucursal,
      offset: meta.offset,
      limit: DUX_REMITOS_VENTA_API_PAGE_LIMIT,
    });

    for (const remito of page.remitos) {
      aplicarRemitoAlAcumulado(meta, remito, catalogo.data.porNro, idSucursal);
    }

    if (page.hayMas) {
      meta.offset += DUX_REMITOS_VENTA_API_PAGE_LIMIT;
    } else {
      meta.sucursalIndex += 1;
      meta.offset = 0;
    }

    const done = meta.sucursalIndex >= meta.sucursales.length;
    if (done) {
      await persistirAcumulado(meta);
      await setSyncFacturasVentasDuxSuccessInDb(meta.scanned, meta.sucursales.length);
      return {
        success: true,
        data: {
          continuing: false,
          processed: meta.scanned,
          total: meta.sucursales.length,
          mes,
          anio,
        },
      };
    }

    await setSyncFacturasVentasDuxProgressInDb({
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
        mes,
        anio,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo sincronizar remitos DUX.";
    console.error("[factCobros][syncFacturasVentasDuxRunStep]", e);
    await setSyncFacturasVentasDuxErrorInDb(message);
    return { success: false, error: message };
  }
}

export type FinFactCobrosPtoVtaFila = {
  ptoVtaId: string;
  ptoVenta: number;
  nombrePtoVenta: string;
  total: string;
};

export async function listarFinFactCobrosPtoVtaMes(params: {
  mes: number;
  anio: number;
}): Promise<FinFactCobrosPtoVtaFila[]> {
  const rows = await prisma.finFactCobrosPtoVtaMes.findMany({
    where: { mes: params.mes, anio: params.anio },
    orderBy: { ptoVta: { ptoVenta: "asc" } },
    select: {
      ptoVtaId: true,
      montoGravado: true,
      ptoVta: { select: { ptoVenta: true, nombrePtoVenta: true } },
    },
  });
  return rows.map((r) => ({
    ptoVtaId: r.ptoVtaId,
    ptoVenta: r.ptoVta.ptoVenta,
    nombrePtoVenta: r.ptoVta.nombrePtoVenta.toLocaleUpperCase("es-AR"),
    total: r.montoGravado.toFixed(2),
  }));
}
