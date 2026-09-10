import { DUX_API_BATCH_SIZE } from "@/lib/duxApiBatchPolicy";
import { parseImporteFacturaDux } from "@/lib/finFactCobrosFacturas";

export const DUX_COBROS_BASE_URL =
  "https://erp.duxsoftware.com.ar/WSERP/rest/services/v2/cobros";

export const DUX_COBROS_API_PAGE_LIMIT = DUX_API_BATCH_SIZE;

const FETCH_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.DUX_FETCH_TIMEOUT_MS) || 30_000
);

export type LineaCobranzaDux = {
  descripcion: string;
  monto: number;
  idTarjeta: bigint | null;
  idPlanTarjeta: bigint | null;
  idTerminal: bigint | null;
  tipoValor: string;
};

export type CobroDux = {
  idCobro: bigint;
  idSucursal: number;
  fecha: string;
  cobranza: LineaCobranzaDux[];
};

interface CobrosApiResponseRaw {
  datos?: unknown;
  paginacion?: {
    total?: unknown;
    offset?: unknown;
    limit?: unknown;
    hay_mas?: unknown;
  };
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

function parseDuxInt64(raw: unknown): bigint | null {
  if (typeof raw === "bigint" && raw > 0n) return raw;
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0) {
    return BigInt(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = BigInt(raw.trim());
    return n > 0n ? n : null;
  }
  return null;
}

function parseDuxInt(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function mapLineaCobranzaDux(raw: unknown): LineaCobranzaDux | null {
  if (!isRecord(raw)) return null;
  const tipoValor = String(raw.tipo_valor ?? "")
    .trim()
    .toLocaleUpperCase("es-AR");
  if (!tipoValor) return null;
  return {
    descripcion: String(raw.descripcion ?? "").trim(),
    monto: parseImporteFacturaDux(raw.monto),
    idTarjeta: parseDuxInt64(raw.id_tarjeta),
    idPlanTarjeta: parseDuxInt64(raw.id_plan_tarjeta),
    idTerminal: parseDuxInt64(raw.id_terminal),
    tipoValor,
  };
}

export function mapCobroDux(raw: unknown): CobroDux | null {
  if (!isRecord(raw)) return null;
  const idCobro = parseDuxInt64(raw.id_cobro);
  const idSucursal = parseDuxInt(raw.id_sucursal);
  const fecha = String(raw.fecha ?? "").trim();
  if (idCobro == null || idSucursal == null || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return null;
  }
  const cobranzaRaw = Array.isArray(raw.cobranza) ? raw.cobranza : [];
  const cobranza: LineaCobranzaDux[] = [];
  for (const linea of cobranzaRaw) {
    const mapped = mapLineaCobranzaDux(linea);
    if (mapped) cobranza.push(mapped);
  }
  if (cobranza.length === 0) return null;
  return {
    idCobro,
    idSucursal,
    fecha: fecha.slice(0, 10),
    cobranza,
  };
}

/**
 * GET `/v2/cobros` — [listar_cobros](https://developers.duxsoftware.com.ar/reference/listar_cobros).
 * Auth Bearer (`DUX_API_TOKEN`).
 */
export async function fetchCobrosPage(params: {
  fechaDesde: string;
  fechaHasta: string;
  idEmpresa: number;
  idSucursal: number;
  offset?: number;
  limit?: number;
}): Promise<{ cobros: CobroDux[]; hayMas: boolean }> {
  const token = process.env.DUX_API_TOKEN;
  if (!token) throw new Error("DUX_API_TOKEN no configurado.");

  const limitCapped = Math.min(
    Math.max(params.limit ?? DUX_COBROS_API_PAGE_LIMIT, 1),
    DUX_COBROS_API_PAGE_LIMIT
  );
  const offset = Math.max(0, params.offset ?? 0);

  const qs = new URLSearchParams({
    id_empresa: String(params.idEmpresa),
    id_sucursal: String(params.idSucursal),
    fecha_desde: params.fechaDesde,
    fecha_hasta: params.fechaHasta,
    limit: String(limitCapped),
    offset: String(offset),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DUX_COBROS_BASE_URL}?${qs.toString()}`, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(
        `Error API DUX cobros: ${res.status} ${res.statusText}. ${bodyText}`.trim()
      );
    }
    const json: CobrosApiResponseRaw = (await res.json()) as CobrosApiResponseRaw;
    const rawDatos: unknown[] = Array.isArray(json.datos) ? json.datos : [];
    const cobros: CobroDux[] = [];
    for (const row of rawDatos) {
      const mapped = mapCobroDux(row);
      if (mapped) cobros.push(mapped);
    }
    const hayMasFlag = json.paginacion?.hay_mas;
    const hayMas =
      typeof hayMasFlag === "boolean" ? hayMasFlag : cobros.length >= limitCapped;
    return { cobros, hayMas };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      const secs = Math.round(FETCH_TIMEOUT_MS / 1000);
      throw new Error(`La petición a DUX cobros no respondió a tiempo (${secs} s).`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
