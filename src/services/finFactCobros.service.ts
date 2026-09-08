import { Prisma } from "@prisma/client";
import { DUX_API_BATCH_INTERVAL_MS } from "@/lib/duxApiBatchPolicy";
import {
  DUX_FACTURAS_API_PAGE_LIMIT,
  fetchFacturasVentasPage,
} from "@/lib/duxFacturasApi";
import {
  parseMontoGravadoDux,
  periodoCalendarioDesdeFechaCompDux,
  rangoIsoMesCalendario,
  signoMontoGravadoFactCobros,
  facturaDuxEstaAnulada,
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

async function listarIdDuxSucursales(): Promise<number[]> {
  const rows = await prisma.sucursal.findMany({ select: { idDux: true } });
  return [
    ...new Set(
      rows
        .map((s) => (s.idDux ?? "").trim())
        .filter((id) => /^\d+$/.test(id))
        .map((id) => Number(id))
    ),
  ];
}

function aplicarFacturaAlAcumulado(
  meta: SyncFacturasVentasDuxMeta,
  factura: {
    id: number;
    nroPtoVta: string;
    letraComp: string;
    tipoComp: string;
    fechaComp: string;
    montoGravado: unknown;
    anulada: string;
    anuladaBoolean: boolean;
  }
): void {
  if (meta.idsVistos.includes(factura.id)) return;
  meta.idsVistos.push(factura.id);
  meta.scanned += 1;

  const periodo = periodoCalendarioDesdeFechaCompDux(factura.fechaComp);
  if (!periodo || periodo.mes !== meta.mes || periodo.anio !== meta.anio) return;

  const signo = signoMontoGravadoFactCobros({
    letraComp: factura.letraComp,
    tipoComp: factura.tipoComp,
    anulada: facturaDuxEstaAnulada({
      anuladaBoolean: factura.anuladaBoolean,
      anulada: factura.anulada,
    }),
  });
  if (signo === 0) return;

  const monto = parseMontoGravadoDux(factura.montoGravado);
  if (!(monto > 0)) return;

  const delta = new Prisma.Decimal(monto.toFixed(4)).mul(signo);
  const actual = new Prisma.Decimal(meta.acumulado[factura.nroPtoVta] ?? "0");
  meta.acumulado[factura.nroPtoVta] = actual.plus(delta).toFixed(4);
}

async function persistirAcumulado(meta: SyncFacturasVentasDuxMeta): Promise<void> {
  const filas = Object.entries(meta.acumulado).map(([nroPtoVta, monto]) => ({
    nroPtoVta,
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
 * Un paso de sync DUX GET `/facturas` (una página). El cliente encadena POST mientras `continuing`.
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
        error: "Ya hay una sincronización de facturas en curso para otro periodo.",
      };
    }

    if (!current.running || !meta || meta.mes !== mes || meta.anio !== anio) {
      const sucursales = await listarIdDuxSucursales();
      if (sucursales.length === 0) {
        return { success: false, error: "No hay sucursales con id_dux numérico." };
      }
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
    const page = await fetchFacturasVentasPage({
      fechaDesde,
      fechaHasta,
      idEmpresa,
      idSucursal,
      offset: meta.offset,
      limit: DUX_FACTURAS_API_PAGE_LIMIT,
    });

    for (const factura of page.facturas) {
      aplicarFacturaAlAcumulado(meta, factura);
    }

    const paginaCompleta = page.facturas.length >= DUX_FACTURAS_API_PAGE_LIMIT;
    if (paginaCompleta) {
      meta.offset += DUX_FACTURAS_API_PAGE_LIMIT;
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
    const message = e instanceof Error ? e.message : "No se pudo sincronizar facturas DUX.";
    console.error("[factCobros][syncFacturasVentasDuxRunStep]", e);
    await setSyncFacturasVentasDuxErrorInDb(message);
    return { success: false, error: message };
  }
}

export type FinFactCobrosPtoVtaFila = {
  nroPtoVta: string;
  montoGravado: string;
};

export async function listarFinFactCobrosPtoVtaMes(params: {
  mes: number;
  anio: number;
}): Promise<FinFactCobrosPtoVtaFila[]> {
  const rows = await prisma.finFactCobrosPtoVtaMes.findMany({
    where: { mes: params.mes, anio: params.anio },
    orderBy: [{ nroPtoVta: "asc" }],
    select: { nroPtoVta: true, montoGravado: true },
  });
  return rows.map((r) => ({
    nroPtoVta: r.nroPtoVta,
    montoGravado: r.montoGravado.toFixed(2),
  }));
}
