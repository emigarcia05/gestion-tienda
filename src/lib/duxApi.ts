import { DUX_API_BATCH_SIZE } from "@/lib/duxApiBatchPolicy";

export const DUX_BASE_URL = "https://erp.duxsoftware.com.ar/WSERP/rest/services/items";

/** Rate limit DUX: 1 petición cada 5 segundos. Respetar en el cliente (ej. sync service) con delay >= 5s entre llamadas. */

// IDs fijos de precios y sucursales en el sistema Dux de TiendaColor
export const ID_PRECIO_LISTA      = 56994;
export const ID_PRECIO_MAYORISTA  = 57160;

/** Lista DUX “principal” (persistida en `prod_tienda_precios`). Override: `DUX_ID_PRECIO_LISTA`. */
export function getIdPrecioListaPrincipal(): number {
  const raw = process.env.DUX_ID_PRECIO_LISTA;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return ID_PRECIO_LISTA;
}

export type PrecioListaDux = {
  idLista: number;
  nombre: string;
  precio: number;
};

export type StockDepositoDux = {
  idDeposito: number;
  nombre: string;
  stockReal: number;
  /** `null` = DUX no informó `ctd_disponible` en ese depósito. */
  ctdDisponible: number | null;
};

export const ID_STOCK_GUAYMALLEN = 4565;
export const ID_STOCK_MAIPU = 16923;

/** Depósito DUX Guaymallén. Override: `DUX_ID_STOCK_GUAYMALLEN`. Debe coincidir con `global_sucursales.id_deposito` de `guaymallen`. */
export function getIdDepositoGuaymallen(): number {
  const raw = process.env.DUX_ID_STOCK_GUAYMALLEN;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return ID_STOCK_GUAYMALLEN;
}

/** Depósito DUX Maipú. Override: `DUX_ID_STOCK_MAIPU`. Debe coincidir con `global_sucursales.id_deposito` de `maipu`. */
export function getIdDepositoMaipu(): number {
  const raw = process.env.DUX_ID_STOCK_MAIPU;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return ID_STOCK_MAIPU;
}

export interface ItemDux {
  codItem:         string;
  descripcion:     string;
  rubro:           string | null;
  subRubro:        string | null;
  marca:           string | null;
  proveedorDux:    string | null;
  codigoExterno:   string | null;
  costo:           number;
  porcIva:         number;
  precioLista:     number;
  precioMayorista: number;
  /** Todas las listas del ítem en DUX (`precios[]`). */
  precios:         PrecioListaDux[];
  /** Todos los depósitos del ítem en DUX (`stock[]`). Origen de verdad para persistencia. */
  stocks:          StockDepositoDux[];
  /** Derivados de `stocks` (Maipú / Guaymallén) para compatibilidad en tipos cliente. */
  stockGuaymallen: number;
  stockMaipu:      number;
  /** true solo si DUX informa `ctd_disponible` no nulo en Guaymallén y en Maipú. */
  stockeable:      boolean;
  habilitado:      boolean;
}

export function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? 0 : n;
}

/** Forma esperada de un ítem en la respuesta JSON de la API Dux (campos opcionales). */
interface ItemDuxRaw {
  cod_item?: unknown;
  item?: unknown;
  rubro?: { nombre?: string } | null;
  sub_rubro?: { nombre?: string } | null;
  marca?: { marca?: string } | null;
  proveedor?: { proveedor?: string } | null;
  codigo_externo?: string | null;
  costo?: unknown;
  porc_iva?: unknown;
  precios?: Array<{ id: number; nombre?: string; precio?: unknown }>;
  stock?: Array<{ id: number; stock_real?: unknown; ctd_disponible?: unknown }>;
  habilitado?: string;
}

function isItemDuxRaw(val: unknown): val is ItemDuxRaw {
  return val !== null && typeof val === "object";
}

function parseStocksDesdeRaw(raw: ItemDuxRaw): StockDepositoDux[] {
  const stocks: StockDepositoDux[] = [];
  if (!Array.isArray(raw.stock)) return stocks;
  for (const s of raw.stock) {
    if (s == null || typeof s !== "object") continue;
    const entry = s as { id?: unknown; stock_real?: unknown; ctd_disponible?: unknown };
    const idDeposito = Number(entry.id);
    if (!Number.isFinite(idDeposito)) continue;
    const ctdRaw = entry.ctd_disponible;
    stocks.push({
      idDeposito,
      nombre: `DEPOSITO ${idDeposito}`,
      stockReal: Math.round(parseNum(entry.stock_real)),
      ctdDisponible: ctdRaw != null ? parseNum(ctdRaw) : null,
    });
  }
  return stocks;
}

function stockRealFromStocks(stocks: StockDepositoDux[], idDeposito: number): number {
  return stocks.find((s) => s.idDeposito === idDeposito)?.stockReal ?? 0;
}

/** Regla stockeable: `ctd_disponible` informado en Guaymallén y Maipú. */
export function computeStockeableDesdeStocks(stocks: StockDepositoDux[]): boolean {
  return (
    stocks.some((s) => s.idDeposito === getIdDepositoGuaymallen() && s.ctdDisponible != null) &&
    stocks.some((s) => s.idDeposito === getIdDepositoMaipu() && s.ctdDisponible != null)
  );
}

export function mapItem(raw: unknown): ItemDux {
  if (!isItemDuxRaw(raw)) {
    return {
      codItem: "", descripcion: "", rubro: null, subRubro: null, marca: null,
      proveedorDux: null, codigoExterno: null, costo: 0, porcIva: 0,
      precioLista: 0, precioMayorista: 0, precios: [], stocks: [],
      stockGuaymallen: 0, stockMaipu: 0,
      stockeable: false,
      habilitado: false,
    };
  }
  const precioMap: Record<number, number> = {};
  const precios: PrecioListaDux[] = [];
  if (Array.isArray(raw.precios)) {
    for (const p of raw.precios) {
      if (p == null || typeof p !== "object") continue;
      const idLista = Number((p as { id?: unknown }).id);
      if (!Number.isFinite(idLista)) continue;
      const precio = parseNum((p as { precio?: unknown }).precio);
      const nombre = String((p as { nombre?: unknown }).nombre ?? "").trim() || `LISTA ${idLista}`;
      precioMap[idLista] = precio;
      precios.push({ idLista, nombre, precio });
    }
  }
  const idListaPrincipal = getIdPrecioListaPrincipal();
  const stocks = parseStocksDesdeRaw(raw);
  const stockeable = computeStockeableDesdeStocks(stocks);
  return {
    codItem:         String(raw.cod_item ?? ""),
    descripcion:     String(raw.item ?? ""),
    rubro:           raw.rubro?.nombre ?? null,
    subRubro:        raw.sub_rubro?.nombre ?? null,
    marca:           raw.marca?.marca ?? null,
    proveedorDux:    raw.proveedor?.proveedor ?? null,
    codigoExterno:   raw.codigo_externo ?? null,
    costo:           parseNum(raw.costo),
    porcIva:         parseNum(raw.porc_iva),
    precioLista:     precioMap[idListaPrincipal]     ?? 0,
    precioMayorista: precioMap[ID_PRECIO_MAYORISTA] ?? 0,
    precios,
    stocks,
    stockGuaymallen: stockRealFromStocks(stocks, getIdDepositoGuaymallen()),
    stockMaipu: stockRealFromStocks(stocks, getIdDepositoMaipu()),
    stockeable,
    habilitado:      raw.habilitado === "S",
  };
}

/** Límite máximo por petición que permite la API DUX. SSOT: `DUX_API_BATCH_SIZE`. */
export const DUX_API_PAGE_LIMIT = DUX_API_BATCH_SIZE;

export interface FetchItemsPageResult {
  results: ItemDux[];
  total: number;
  hasMore: boolean;
}

const MAX_RETRIES_429 = 5;
const RETRY_429_BASE_MS = 10000;

/**
 * Timeout por intento HTTP a DUX (headers + body JSON). Configurable con `DUX_FETCH_TIMEOUT_MS`.
 * No cubre las esperas de reintento 429 (esas ocurren entre intentos).
 * Default 30 s: páginas de 50 ítems con stocks/precios pueden ser pesadas.
 */
const FETCH_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.DUX_FETCH_TIMEOUT_MS) || 30_000
);

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError")
  );
}

function duxFetchTimeoutError(): Error {
  const secs = Math.round(FETCH_TIMEOUT_MS / 1000);
  return new Error(
    `La petición a DUX no respondió a tiempo (${secs} s). Reintentá más tarde.`
  );
}

/**
 * Consume el body de la respuesta para liberar la conexión (evita fugas y cierres incorrectos).
 */
async function consumeBody(res: Response): Promise<void> {
  try {
    await res.text();
  } catch {
    // ignorar si el body ya fue consumido o hay error de lectura
  }
}

/**
 * Obtiene una página de ítems de la API DUX (limit=50 por restricción de la API).
 * Para sincronización paginada con prod_precios_tienda.
 * Ante 429 Too Many Requests: consume el body, respeta Retry-After si viene en la respuesta,
 * y reintenta con backoff exponencial (10s, 20s, 40s, 80s, 160s).
 *
 * El AbortSignal cubre fetch + lectura JSON del intento; las esperas 429 quedan fuera del timeout.
 */
export async function fetchItemsPage(offset: number, limit: number = DUX_API_PAGE_LIMIT): Promise<FetchItemsPageResult> {
  const token = process.env.DUX_API_TOKEN;
  if (!token) throw new Error("DUX_API_TOKEN no configurado.");

  const headers: HeadersInit = {
    accept: "application/json",
    Authorization: token,
  };

  const url = `${DUX_BASE_URL}?limit=${limit}&offset=${offset}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      if (res.ok) {
        // Mantener el timeout activo hasta parsear el body (no solo hasta headers).
        const json: unknown = await res.json();
        const record =
          json && typeof json === "object" ? (json as Record<string, unknown>) : {};
        const rawResults: unknown[] = Array.isArray(record.results)
          ? record.results
          : [];
        const paging =
          record.paging && typeof record.paging === "object"
            ? (record.paging as Record<string, unknown>)
            : {};
        const total = Number(paging.total ?? 0);
        const results = rawResults.map(mapItem);
        const pageLen = rawResults.length;
        /**
         * Página llena ⇒ hay más (aunque `paging.total` falte o sea 0).
         * Si `total` es fiable, también comparar offset+page vs total.
         * Una página final exacta de `limit` ítems se cierra en el fetch siguiente (0 resultados).
         */
        const hasMore =
          pageLen >= limit || (total > 0 && offset + pageLen < total);
        return {
          results,
          total,
          hasMore,
        };
      }

      await consumeBody(res);
      lastError = new Error(`Error API Dux: ${res.status} ${res.statusText}`);

      if (res.status === 429 && attempt < MAX_RETRIES_429) {
        let waitMs = RETRY_429_BASE_MS * Math.pow(2, attempt);
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!Number.isNaN(seconds)) waitMs = Math.max(waitMs, seconds * 1000);
        }
        console.warn(
          `[DUX API] 429 Too Many Requests (offset ${offset}) — reintento en ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${MAX_RETRIES_429})`
        );
        clearTimeout(timeoutId);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      throw lastError;
    } catch (fetchErr) {
      if (isAbortError(fetchErr)) {
        throw duxFetchTimeoutError();
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("Error API Dux: desconocido");
}

