export const DUX_COMPRAS_BASE_URL = "https://erp.duxsoftware.com.ar/WSERP/rest/services/compras";

/** Máximo de registros que devuelve `/compras` por petición (DUX no acepta más por página). */
export const DUX_COMPRAS_API_PAGE_LIMIT = 50;

export interface CompraDux {
  comprobante: string;
  total?: string;
  montoAplicado?: string;
  /** Alias histórico en respuesta DUX (`id_sucursal`). */
  idSucursal?: string;
  /** Preferido para persistencia en `fin_compras_comprobante.id_sucursal_empresa`. */
  idSucursalEmpresa?: string;
  idProveedor?: string;
  fechaComp?: string;
  tipoComp?: string;
}

interface CompraDuxRaw {
  comprobante?: unknown;
  total?: unknown;
  monto_aplicado?: unknown;
  monto_pagado?: unknown;
  id_sucursal?: unknown;
  id_sucursal_empresa?: unknown;
  id_proveedor?: unknown;
  fecha_comp?: unknown;
  tipo_comp?: unknown;
  tipo_comprobante?: unknown;
}

interface ComprasApiResponseRaw {
  results?: unknown;
  paging?: unknown;
}

function isCompraDuxRaw(val: unknown): val is CompraDuxRaw {
  return val !== null && typeof val === "object";
}

export function mapCompra(raw: unknown): CompraDux {
  if (!isCompraDuxRaw(raw)) {
    return { comprobante: "" };
  }

  const idSucursalEmpresa =
    raw.id_sucursal_empresa != null
      ? String(raw.id_sucursal_empresa)
      : raw.id_sucursal != null
        ? String(raw.id_sucursal)
        : undefined;

  const idProveedor = raw.id_proveedor != null ? String(raw.id_proveedor) : undefined;

  const fechaComp = raw.fecha_comp != null ? String(raw.fecha_comp) : undefined;

  const tipoComp =
    raw.tipo_comp != null
      ? String(raw.tipo_comp)
      : raw.tipo_comprobante != null
        ? String(raw.tipo_comprobante)
        : undefined;

  const montoAplicado =
    raw.monto_aplicado != null
      ? String(raw.monto_aplicado)
      : raw.monto_pagado != null
        ? String(raw.monto_pagado)
        : undefined;

  return {
    comprobante: String(raw.comprobante ?? ""),
    total: raw.total != null ? String(raw.total) : undefined,
    montoAplicado,
    idSucursal: raw.id_sucursal != null ? String(raw.id_sucursal) : undefined,
    idSucursalEmpresa,
    idProveedor,
    fechaComp,
    tipoComp,
  };
}

export function parseFechaDuxToQuery(fecha: string): string {
  return fecha;
}

/**
 * Tamaño de página para sync (nunca mayor que {@link DUX_COMPRAS_API_PAGE_LIMIT}).
 * `DUX_COMPRAS_SYNC_LIMIT` en `.env` solo permite 1..50.
 */
function duxComprasSyncPageSize(): number {
  const raw = process.env.DUX_COMPRAS_SYNC_LIMIT;
  if (raw == null || raw === "") return DUX_COMPRAS_API_PAGE_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DUX_COMPRAS_API_PAGE_LIMIT;
  return Math.min(n, DUX_COMPRAS_API_PAGE_LIMIT);
}

/** Tope de páginas por sucursal (50 filas c/u). Default alto; acotar con `DUX_COMPRAS_SYNC_MAX_PAGES`. */
function duxComprasSyncMaxPages(): number {
  const raw = process.env.DUX_COMPRAS_SYNC_MAX_PAGES;
  if (raw == null || raw === "") return 500;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 500;
}

function duxComprasMinIntervalMs(): number {
  const raw = process.env.DUX_COMPRAS_MIN_INTERVAL_MS;
  if (raw == null || raw === "") return 5000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 5000;
}

function delayComprasMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Una petición GET a `/compras`. `limit` se acota a {@link DUX_COMPRAS_API_PAGE_LIMIT}.
 * Paginación: `offset` 0, 50, 100… (mismo contrato que curl DUX).
 */
export async function fetchComprasPage(params: {
  fechaDesde: string;
  fechaHasta: string;
  idEmpresa: number;
  /** Filtro por sucursal DUX (`sucursales.id_dux`). */
  idSucursal?: number;
  limit?: number;
  offset?: number;
}): Promise<CompraDux[]> {
  const token = process.env.DUX_API_TOKEN;
  if (!token) throw new Error("DUX_API_TOKEN no configurado.");

  const { fechaDesde, fechaHasta, idEmpresa, idSucursal, limit = 1, offset } = params;
  const limitCapped = Math.min(Math.max(limit, 1), DUX_COMPRAS_API_PAGE_LIMIT);

  const headers: HeadersInit = {
    accept: "application/json",
    Authorization: token,
  };

  const url =
    `${DUX_COMPRAS_BASE_URL}` +
    `?fechaDesde=${encodeURIComponent(parseFechaDuxToQuery(fechaDesde))}` +
    `&fechaHasta=${encodeURIComponent(parseFechaDuxToQuery(fechaHasta))}` +
    `&idEmpresa=${encodeURIComponent(String(idEmpresa))}` +
    (idSucursal != null
      ? `&idSucursal=${encodeURIComponent(String(idSucursal))}`
      : "") +
    `&limit=${encodeURIComponent(String(limitCapped))}` +
    (offset != null && offset > 0
      ? `&offset=${encodeURIComponent(String(offset))}`
      : "");

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Error API DUX compras: ${res.status} ${res.statusText}. ${bodyText}`.trim());
  }

  const json: ComprasApiResponseRaw = (await res.json()) as ComprasApiResponseRaw;
  const rawResults: unknown[] = Array.isArray(json.results) ? json.results : [];
  return rawResults.map(mapCompra);
}

/**
 * Por cada sucursal: pide `/compras` en páginas de {@link DUX_COMPRAS_API_PAGE_LIMIT} filas
 * con `offset` 0, 50, 100… hasta respuesta vacía o menos de 50 ítems o tope de páginas.
 * Entre páginas aplica `DUX_COMPRAS_MIN_INTERVAL_MS` (misma regla anti-429 que entre sucursales).
 */
export async function fetchComprasPagesAcumulado(params: {
  fechaDesde: string;
  fechaHasta: string;
  idEmpresa: number;
  idSucursal: number;
}): Promise<CompraDux[]> {
  const pageSize = duxComprasSyncPageSize();
  const maxPages = duxComprasSyncMaxPages();
  const intervalMs = duxComprasMinIntervalMs();
  const all: CompraDux[] = [];

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && intervalMs > 0) {
      await delayComprasMs(intervalMs);
    }
    const offset = page * pageSize;
    const batch = await fetchComprasPage({
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      idEmpresa: params.idEmpresa,
      idSucursal: params.idSucursal,
      limit: pageSize,
      offset: offset > 0 ? offset : undefined,
    });
    all.push(...batch);
    if (batch.length === 0 || batch.length < pageSize) break;
  }

  return all;
}
