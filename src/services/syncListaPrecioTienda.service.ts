/**
 * Sincronización de prod_tienda desde la API DUX ERP.
 * Fase 1: bucle paginado (50 ítems por petición); tras cada página, persistencia en Neon
 *           en paralelo con la espera de rate limit DUX (`DELAY_MS`).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchItemsPage,
  DUX_API_PAGE_LIMIT,
  type ItemDux,
} from "@/lib/duxApi";
import { DUX_API_BATCH_INTERVAL_MS } from "@/lib/duxApiBatchPolicy";
import {
  getSyncDuxStatusFromDb,
  getSyncDuxWorkerStateFromDb,
  saveSyncDuxWorkerStateInDb,
  type SyncDuxWorkerMeta,
  type SyncDuxWorkerState,
} from "@/lib/syncDuxStatusDb";
import { limpiarHuerfanosProdTienda, eliminarProdTiendaAusentesEnSyncDux } from "@/services/limpiarHuerfanosProdTienda.service";

/** Se lanza cuando el usuario cancela la sync vía API (flag `running` en BD). */
export class SyncListaPrecioTiendaCancelledError extends Error {
  constructor() {
    super("Sincronización cancelada por el usuario.");
    this.name = "SyncListaPrecioTiendaCancelledError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

async function assertListaPrecioTiendaSyncNotCancelled(): Promise<void> {
  const st = await getSyncDuxStatusFromDb();
  if (!st.running) {
    throw new SyncListaPrecioTiendaCancelledError();
  }
}

/** Pausa entre peticiones (SSOT: `DUX_API_BATCH_INTERVAL_MS`, mínimo 5 s). */
const DELAY_MS = DUX_API_BATCH_INTERVAL_MS;
const COD_TIENDA = process.env.DUX_COD_TIENDA ?? "DUX";

/** Tamaño de cada chunk al persistir en Neon (muchas upserts anidadas por ítem). */
const CHUNK_PERSIST_SIZE = Math.max(
  5,
  Math.min(100, Number(process.env.DUX_SYNC_CHUNK_SIZE) || 25)
);
/** Segundos aproximados por lote de 50 ítems (delay + petición), para estimar tiempo restante. */
export const SYNC_SECONDS_PER_BATCH = DELAY_MS / 1000 + 1.5;

/** Timeout (ms) por transacción de persistencia (chunks pequeños + catálogos deduplicados). */
const TRANSACTION_TIMEOUT_MS = 120_000;

/** Presupuesto de tiempo por invocación serverless (ms). Default 4 min (< límite Vercel 300 s). */
export const SYNC_STEP_TIME_BUDGET_MS = Math.max(
  60_000,
  Math.min(280_000, Number(process.env.DUX_SYNC_STEP_BUDGET_MS) || 240_000)
);

export interface SyncListaPrecioTiendaResult {
  creados: number;
  actualizados: number;
  eliminados: number;
  totalProcesados: number;
  totalApi: number;
  duracionMs: number;
  errores: string[];
}

/** Mapea ítem DUX a la fila de upsert prod_tienda. `proveedor` queda fuera del sync (§1.4.2). */
function itemDuxToProdTiendaRecord(item: ItemDux) {
  const codTienda = (item.codItem ?? "").trim() || COD_TIENDA;
  return {
    codTienda,
    rubro: item.rubro ?? null,
    subRubro: item.subRubro ?? null,
    marca: item.marca ?? null,
    descripcionTienda: item.descripcion ?? null,
    costoCompra: Number(item.costo) || 0,
    precios: item.precios,
    stocks: item.stocks,
  };
}

type RecordProdTienda = ReturnType<typeof itemDuxToProdTiendaRecord>;

async function upsertDepositosCatalogoEnTransaccion(
  tx: Prisma.TransactionClient,
  items: RecordProdTienda[],
  idDepositosVistos: Set<number>
): Promise<void> {
  const now = new Date();
  const unicos = new Map<number, string>();
  for (const row of items) {
    for (const st of row.stocks) {
      if (!Number.isFinite(st.idDeposito)) continue;
      unicos.set(st.idDeposito, st.nombre);
    }
  }
  for (const [idDeposito, nombre] of unicos) {
    idDepositosVistos.add(idDeposito);
    await tx.globalDeposito.upsert({
      where: { idDeposito },
      create: {
        idDeposito,
        nombre,
        activa: true,
        ultimaSync: now,
      },
      update: {
        nombre,
        activa: true,
        ultimaSync: now,
      },
    });
  }
}

async function upsertListasCatalogoEnTransaccion(
  tx: Prisma.TransactionClient,
  items: RecordProdTienda[],
  idListasVistas: Set<number>
): Promise<void> {
  const unicas = new Map<number, string>();
  for (const row of items) {
    for (const pl of row.precios) {
      if (!Number.isFinite(pl.idLista)) continue;
      unicas.set(pl.idLista, pl.nombre);
    }
  }
  for (const [idLista, nombreLista] of unicas) {
    idListasVistas.add(idLista);
    await tx.prodTiendaListaPrecio.upsert({
      where: { idLista },
      create: { idLista, nombreLista },
      update: { nombreLista },
    });
  }
}

async function syncStocksEnTransaccion(
  tx: Prisma.TransactionClient,
  items: RecordProdTienda[]
): Promise<void> {
  for (const row of items) {
    const idsEnItem = new Set<number>();
    for (const st of row.stocks) {
      if (!Number.isFinite(st.idDeposito)) continue;
      idsEnItem.add(st.idDeposito);
      await tx.prodTiendaStock.upsert({
        where: {
          codTienda_idDeposito: { codTienda: row.codTienda, idDeposito: st.idDeposito },
        },
        create: {
          codTienda: row.codTienda,
          idDeposito: st.idDeposito,
          stockReal: st.stockReal,
          ctdDisponible:
            st.ctdDisponible != null ? new Prisma.Decimal(st.ctdDisponible) : null,
        },
        update: {
          stockReal: st.stockReal,
          ctdDisponible:
            st.ctdDisponible != null ? new Prisma.Decimal(st.ctdDisponible) : null,
        },
      });
    }
    if (idsEnItem.size > 0) {
      await tx.prodTiendaStock.deleteMany({
        where: {
          codTienda: row.codTienda,
          idDeposito: { notIn: [...idsEnItem] },
        },
      });
    } else {
      await tx.prodTiendaStock.deleteMany({
        where: { codTienda: row.codTienda },
      });
    }
  }
}

async function syncListasPreciosEnTransaccion(
  tx: Prisma.TransactionClient,
  items: RecordProdTienda[]
): Promise<void> {
  for (const row of items) {
    const idsEnItem = new Set<number>();
    for (const pl of row.precios) {
      if (!Number.isFinite(pl.idLista)) continue;
      idsEnItem.add(pl.idLista);
      await tx.prodTiendaPrecio.upsert({
        where: {
          codTienda_idLista: { codTienda: row.codTienda, idLista: pl.idLista },
        },
        create: {
          codTienda: row.codTienda,
          idLista: pl.idLista,
          precio: new Prisma.Decimal(pl.precio),
        },
        update: {
          precio: new Prisma.Decimal(pl.precio),
        },
      });
    }
    if (idsEnItem.size > 0) {
      await tx.prodTiendaPrecio.deleteMany({
        where: {
          codTienda: row.codTienda,
          idLista: { notIn: [...idsEnItem] },
        },
      });
    } else {
      await tx.prodTiendaPrecio.deleteMany({
        where: { codTienda: row.codTienda },
      });
    }
  }
}

async function persistProdTiendaChunk(chunk: RecordProdTienda[]): Promise<void> {
        await prisma.$transaction(
          async (tx) => {
            const marcasUnicas = [
              ...new Set(
                chunk
                  .map((r) => r.marca?.trim())
                  .filter((n): n is string => Boolean(n && n.length > 0))
              ),
            ];
            const mapaMarca = new Map<string, string>();
            for (const nombre of marcasUnicas) {
              const m = await tx.marca.upsert({
                where: { nombre },
                create: { nombre },
                update: {},
              });
              mapaMarca.set(nombre, m.id);
            }
            for (const row of chunk) {
              const nombreMarca = row.marca?.trim();
              const idMarca = nombreMarca ? mapaMarca.get(nombreMarca) ?? null : null;
              const lastSync = new Date();
        await tx.prodTienda.upsert({
                where: { codTienda: row.codTienda },
                create: {
                  codTienda: row.codTienda,
                  rubro: row.rubro,
                  subRubro: row.subRubro,
                  marca: row.marca,
                  idMarca,
                  descripcionTienda: row.descripcionTienda,
                  costoCompra: new Prisma.Decimal(row.costoCompra),
                  lastSync,
                },
                update: {
                  codTienda: row.codTienda,
                  rubro: row.rubro,
                  subRubro: row.subRubro,
                  marca: row.marca,
                  idMarca,
                  descripcionTienda: row.descripcionTienda,
                  costoCompra: new Prisma.Decimal(row.costoCompra),
                  lastSync,
                },
              });
            }
          },
          { timeout: TRANSACTION_TIMEOUT_MS }
        );
}

async function persistStockChunk(
  chunk: RecordProdTienda[],
  idDepositosVistos: Set<number>
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await upsertDepositosCatalogoEnTransaccion(tx, chunk, idDepositosVistos);
      await syncStocksEnTransaccion(tx, chunk);
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

async function persistPreciosChunk(
  chunk: RecordProdTienda[],
  idListasVistas: Set<number>
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await upsertListasCatalogoEnTransaccion(tx, chunk, idListasVistas);
      await syncListasPreciosEnTransaccion(tx, chunk);
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

export type SyncPhase = "sincronizando" | "guardando";

export interface SyncProgressCallback {
  onProgress?(processed: number, total: number, phase?: SyncPhase): void | Promise<void>;
  timeBudgetMs?: number;
}

export interface SyncListaPrecioTiendaStepResult extends SyncListaPrecioTiendaResult {
  done: boolean;
  continuing: boolean;
}

async function emitProgress(
  onProgress: SyncProgressCallback["onProgress"],
  processed: number,
  total: number,
  phase: SyncPhase
): Promise<void> {
  if (!onProgress) return;
  await onProgress(processed, total, phase);
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tras fetch DUX: persiste la página y actualiza estado.
 * Pensado para ejecutarse en paralelo con `delayMs(DELAY_MS)` (rate limit).
 */
async function persistPaginaDuxYActualizarEstado(
  batch: RecordProdTienda[],
  worker: SyncDuxWorkerState,
  totalApi: number,
  fetchOffsetAntes: number,
  apiFetchComplete: boolean,
  onProgress: SyncProgressCallback["onProgress"]
): Promise<SyncDuxWorkerState> {
  await assertListaPrecioTiendaSyncNotCancelled();
  const meta = await persistRecordBatch(batch, worker.meta);
  const processed = worker.processed + batch.length;
  const fetchOffset = fetchOffsetAntes + DUX_API_PAGE_LIMIT;

  await saveSyncDuxWorkerStateInDb({
    processed,
    total: totalApi,
    fetchOffset,
    meta,
    phase: "sincronizando",
    apiFetchComplete,
  });
  await emitProgress(onProgress, processed, totalApi, "sincronizando");

  const pct = totalApi > 0 ? Math.round((processed / totalApi) * 100) : 0;
  console.log(`Sync DUX offset ${fetchOffset}: ${processed}/${totalApi} (${pct}%)`);

  return {
    ...worker,
    processed,
    fetchOffset,
    total: totalApi,
    meta,
    apiFetchComplete,
  };
}

async function persistRecordBatch(
  items: RecordProdTienda[],
  meta: SyncDuxWorkerMeta
): Promise<SyncDuxWorkerMeta> {
  const depSet = new Set(meta.depositosVistos);
  const lisSet = new Set(meta.listasVistas);

  for (let i = 0; i < items.length; i += CHUNK_PERSIST_SIZE) {
    const slice = items.slice(i, i + CHUNK_PERSIST_SIZE);
    const byCodTienda = new Map<string, RecordProdTienda>();
    for (const row of slice) byCodTienda.set(row.codTienda, row);
    const chunk = Array.from(byCodTienda.values());
    if (chunk.length === 0) continue;

    await persistProdTiendaChunk(chunk);
    await persistStockChunk(chunk, depSet);
    await persistPreciosChunk(chunk, lisSet);
  }

  return {
    ...meta,
    depositosVistos: [...depSet],
    listasVistas: [...lisSet],
  };
}

async function finalizeSyncWorker(
  worker: SyncDuxWorkerState,
  errores: string[],
  onProgress: SyncProgressCallback["onProgress"]
): Promise<SyncListaPrecioTiendaResult> {
  const inicioMs = Date.now();
  await saveSyncDuxWorkerStateInDb({
    phase: "guardando",
    processed: worker.processed,
    total: worker.total,
  });
  await emitProgress(onProgress, worker.processed, worker.total, "guardando");

  let eliminados = 0;
  if (worker.startedAt && worker.processed > 0) {
    try {
      eliminados = await eliminarProdTiendaAusentesEnSyncDux(worker.startedAt);
      if (eliminados > 0) {
        console.log(
          `Sync DUX: eliminados ${eliminados} ítem(s) de prod_tienda ausentes en DUX.`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`Limpieza cod_tienda ausentes: ${msg}`);
      console.error("Error en limpieza de cod_tienda ausentes:", msg);
    }
  }

  try {
    const huerfanos = await limpiarHuerfanosProdTienda({ execute: true });
    const totalHuerfanos = huerfanos.reduce((s, r) => s + r.aplicados, 0);
    if (totalHuerfanos > 0) {
      console.log(
        `Limpieza huérfanos prod_tienda: ${totalHuerfanos} fila(s) en ${huerfanos.filter((r) => r.aplicados > 0).length} tabla(s)`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errores.push(`Limpieza huérfanos prod_tienda: ${msg}`);
    console.error("Error en limpieza huérfanos prod_tienda:", msg);
  }

  const listasVistas = worker.meta.listasVistas;
  if (listasVistas.length > 0) {
    try {
      await prisma.prodTiendaPrecio.deleteMany({
        where: { idLista: { notIn: listasVistas } },
      });
      await prisma.prodTiendaListaPrecio.deleteMany({
        where: { idLista: { notIn: listasVistas } },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`Eliminar listas DUX en desuso: ${msg}`);
      console.error("Error eliminando listas DUX en desuso:", msg);
    }
  }

  const depositosVistos = worker.meta.depositosVistos;
  if (depositosVistos.length > 0) {
    try {
      await prisma.globalDeposito.updateMany({
        where: { idDeposito: { notIn: depositosVistos } },
        data: { activa: false },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`Marcar depósitos DUX inactivos: ${msg}`);
      console.error("Error marcando depósitos DUX inactivos:", msg);
    }
  }

  const countAfter = await prisma.prodTienda.count();
  const creados = Math.max(0, countAfter - worker.meta.countBefore);
  const actualizados = Math.max(0, worker.processed - creados);

  return {
    creados,
    actualizados,
    eliminados,
    totalProcesados: worker.processed,
    totalApi: worker.total,
    duracionMs: Date.now() - inicioMs,
    errores,
  };
}

/**
 * Un paso reanudable de sync DUX (límite serverless ~300 s en Vercel).
 *
 * **Dos optimizaciones complementarias (no excluyentes):**
 * 1. **Pasos reanudables** — cada invocación trabaja como máximo `SYNC_STEP_TIME_BUDGET_MS`
 *    (~4 min); si el catálogo crece, el cliente encadena POST con `continuing: true` y el
 *    estado en `sync_dux_status` (`fetch_offset`, `meta`, …) permite retomar.
 * 2. **Pipeline consulta/guardado** — tras cada página DUX, la persistencia corre en paralelo
 *    con `delayMs(DELAY_MS)` para no sumar espera + guardado en cada lote.
 *
 * El cliente debe llamar POST repetidamente mientras `continuing === true`.
 */
export async function syncListaPrecioTiendaRunStep(
  options?: SyncProgressCallback
): Promise<SyncListaPrecioTiendaStepResult> {
  const timeBudgetMs = options?.timeBudgetMs ?? SYNC_STEP_TIME_BUDGET_MS;
  const onProgress = options?.onProgress;
  const deadline = Date.now() + timeBudgetMs;
  const errores: string[] = [];
  const stepStartedMs = Date.now();

  let worker = await getSyncDuxWorkerStateFromDb();
  if (!worker.running) {
    throw new Error("No hay sincronización en curso.");
  }

  if (worker.apiFetchComplete) {
    const result = await finalizeSyncWorker(worker, errores, onProgress);
    return { ...result, done: true, continuing: false };
  }

  let totalApi = worker.total;

  while (Date.now() < deadline) {
    await assertListaPrecioTiendaSyncNotCancelled();

    // Timeout y reintentos 429 viven en `fetchItemsPage` (no envolver con Promise.race:
    // un tope de 15 s abortaba el backoff 429 ≥10 s y mataba syncs que antes funcionaban).
    const { results, total, hasMore } = await fetchItemsPage(
      worker.fetchOffset,
      DUX_API_PAGE_LIMIT
    );

    if (total > 0 && totalApi === 0) totalApi = total;

    if (results.length === 0) {
      await saveSyncDuxWorkerStateInDb({
        apiFetchComplete: true,
        total: totalApi,
      });
      break;
    }

    const batch = results.map(itemDuxToProdTiendaRecord).filter((r) => r.codTienda);
    if (batch.length === 0) {
      worker.fetchOffset += DUX_API_PAGE_LIMIT;
      await saveSyncDuxWorkerStateInDb({ fetchOffset: worker.fetchOffset, total: totalApi });
      if (!hasMore) {
        await saveSyncDuxWorkerStateInDb({ apiFetchComplete: true, total: totalApi });
        break;
      }
      if (Date.now() + DELAY_MS >= deadline) break;
      await delayMs(DELAY_MS);
      worker = await getSyncDuxWorkerStateFromDb();
      continue;
    }

    const fetchOffsetAntes = worker.fetchOffset;
    const apiFetchComplete = !hasMore;

    try {
      if (apiFetchComplete || Date.now() + DELAY_MS >= deadline) {
        // Última página o sin tiempo para otra espera: persistir antes de salir del paso.
        worker = await persistPaginaDuxYActualizarEstado(
          batch,
          worker,
          totalApi,
          fetchOffsetAntes,
          apiFetchComplete,
          onProgress
        );
      } else {
        // Aprovechar la espera obligatoria DUX para guardar en Neon en paralelo.
        worker = await Promise.all([
          delayMs(DELAY_MS),
          persistPaginaDuxYActualizarEstado(
            batch,
            worker,
            totalApi,
            fetchOffsetAntes,
            false,
            onProgress
          ),
        ]).then(([, w]) => w);
        worker = await getSyncDuxWorkerStateFromDb();
      }
    } catch (e) {
      if (e instanceof SyncListaPrecioTiendaCancelledError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`Persistir offset ${fetchOffsetAntes}: ${msg}`);
      console.error(`Error persistiendo página DUX offset ${fetchOffsetAntes}:`, msg);
      throw new Error(`No se pudo guardar productos en la base de datos. ${msg}`);
    }

    if (apiFetchComplete) break;
    // Presupuesto de paso agotado: salir y dejar `continuing: true` para la siguiente invocación POST.
    if (Date.now() >= deadline) break;
  }

  worker = await getSyncDuxWorkerStateFromDb();

  if (worker.apiFetchComplete) {
    if (worker.processed === 0 && worker.total > 0) {
      throw new Error("La consulta DUX terminó pero no se guardó ningún producto.");
    }
    if (Date.now() < deadline) {
      const result = await finalizeSyncWorker(worker, errores, onProgress);
      return { ...result, done: true, continuing: false };
    }
  }

  return {
    creados: 0,
    actualizados: 0,
    eliminados: 0,
    totalProcesados: worker.processed,
    totalApi: worker.total,
    duracionMs: Date.now() - stepStartedMs,
    errores,
    done: false,
    continuing: true,
  };
}

