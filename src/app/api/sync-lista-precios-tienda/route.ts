import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  syncListaPrecioTiendaRunStep,
  syncDuxPermiteLimpiezaCatalogo,
  SyncListaPrecioTiendaCancelledError,
} from "@/services/syncListaPrecioTienda.service";
import { guardTiendaListaPreciosSincronizar } from "@/lib/apiRouteAuth";
import {
  clearListaPrecioTiendaSyncRunningStateInDb,
  getSyncDuxWorkerStateFromDb,
  setSyncDuxErrorInDb,
  setSyncDuxProgressInDb,
  setSyncDuxSuccessInDb,
  startSyncDuxInDb,
} from "@/lib/syncDuxStatusDb";

/** Sync DUX puede demorar varios minutos (rate limit + persistencia por chunks). */
export const maxDuration = 300;

/** Evita dos pasos concurrentes en la misma instancia serverless. */
let syncInProgress = false;

async function ejecutarPasoSyncListaPrecioTienda() {
  if (syncInProgress) {
    return NextResponse.json(
      { ok: false, error: "Paso de sincronización ya en curso." },
      { status: 409 }
    );
  }

  syncInProgress = true;
  try {
    const before = await getSyncDuxWorkerStateFromDb();
    if (!before.running) {
      const countBefore = await prisma.prodTienda.count();
      await startSyncDuxInDb(countBefore);
    }

    const result = await syncListaPrecioTiendaRunStep({
      async onProgress(processed, total, phase) {
        await setSyncDuxProgressInDb(processed, total, phase);
      },
    });

    if (result.done) {
      if (
        !syncDuxPermiteLimpiezaCatalogo(
          result.totalProcesados,
          result.totalApi,
          result.errores
        )
      ) {
        if (result.errores.length > 0) {
          await setSyncDuxErrorInDb(result.errores.join(" | "));
          return NextResponse.json(
            {
              ok: false,
              error: result.errores.join(" | "),
              processed: result.totalProcesados,
              total: result.totalApi,
            },
            { status: 500 }
          );
        }
        return NextResponse.json({
          ok: true,
          continuing: true,
          processed: result.totalProcesados,
          total: result.totalApi,
        });
      }
      await setSyncDuxSuccessInDb(result.totalProcesados, result.totalApi);
      const { continuing: _c, done: _d, ...payload } = result;
      return NextResponse.json({ ok: true, continuing: false, ...payload });
    }

    return NextResponse.json({
      ok: true,
      continuing: true,
      processed: result.totalProcesados,
      total: result.totalApi,
    });
  } catch (e) {
    if (e instanceof SyncListaPrecioTiendaCancelledError) {
      await clearListaPrecioTiendaSyncRunningStateInDb();
      return NextResponse.json(
        { ok: false, cancelled: true, error: e.message },
        { status: 200 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    await setSyncDuxErrorInDb(message);
    console.error("Error en sync prod_tienda:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    syncInProgress = false;
  }
}

/**
 * GET: un paso de sincronización (consulta + guardado reanudable).
 */
export async function GET() {
  const denied = await guardTiendaListaPreciosSincronizar();
  if (denied) return denied;
  return ejecutarPasoSyncListaPrecioTienda();
}

/**
 * POST: un paso de sincronización (~4 min máx. por invocación).
 * El cliente encadena POST mientras `continuing === true` (catálogos grandes superan el límite Vercel).
 */
export async function POST() {
  const denied = await guardTiendaListaPreciosSincronizar();
  if (denied) return denied;
  return ejecutarPasoSyncListaPrecioTienda();
}
