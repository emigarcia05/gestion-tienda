import { DUX_API_BATCH_SIZE } from "@/lib/duxApiBatchPolicy";

export const DUX_FACTURAS_BASE_URL =
  "https://erp.duxsoftware.com.ar/WSERP/rest/services/facturas";

export const DUX_FACTURAS_API_PAGE_LIMIT = DUX_API_BATCH_SIZE;

const FETCH_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.DUX_FETCH_TIMEOUT_MS) || 30_000
);

export type FacturaVentaDux = {
  id: number;
  nroPtoVta: string;
  letraComp: string;
  tipoComp: string;
  fechaComp: string;
  montoGravado: unknown;
  anulada: string;
  anuladaBoolean: boolean;
};

interface FacturasApiResponseRaw {
  results?: unknown;
  paging?: { total?: unknown };
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

export function mapFacturaVentaDux(raw: unknown): FacturaVentaDux | null {
  if (!isRecord(raw)) return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const nroPtoVta = String(raw.nro_pto_vta ?? "").trim();
  if (!nroPtoVta) return null;
  return {
    id,
    nroPtoVta,
    letraComp: String(raw.letra_comp ?? ""),
    tipoComp: String(raw.tipo_comp ?? ""),
    fechaComp: String(raw.fecha_comp ?? ""),
    montoGravado: raw.monto_gravado,
    anulada: String(raw.anulada ?? ""),
    anuladaBoolean: raw.anulada_boolean === true,
  };
}

export async function fetchFacturasVentasPage(params: {
  fechaDesde: string;
  fechaHasta: string;
  idEmpresa: number;
  idSucursal: number;
  offset?: number;
  limit?: number;
}): Promise<{ facturas: FacturaVentaDux[]; total: number }> {
  const token = process.env.DUX_API_TOKEN;
  if (!token) throw new Error("DUX_API_TOKEN no configurado.");

  const limitCapped = Math.min(
    Math.max(params.limit ?? DUX_FACTURAS_API_PAGE_LIMIT, 1),
    DUX_FACTURAS_API_PAGE_LIMIT
  );
  const offset = Math.max(0, params.offset ?? 0);

  const qs = new URLSearchParams({
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    idEmpresa: String(params.idEmpresa),
    idSucursal: String(params.idSucursal),
    anuladas: "false",
    limit: String(limitCapped),
    offset: String(offset),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DUX_FACTURAS_BASE_URL}?${qs.toString()}`, {
      headers: {
        accept: "application/json",
        Authorization: token,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(
        `Error API DUX facturas: ${res.status} ${res.statusText}. ${bodyText}`.trim()
      );
    }
    const json: FacturasApiResponseRaw = (await res.json()) as FacturasApiResponseRaw;
    const rawResults: unknown[] = Array.isArray(json.results) ? json.results : [];
    const facturas: FacturaVentaDux[] = [];
    for (const row of rawResults) {
      const mapped = mapFacturaVentaDux(row);
      if (mapped) facturas.push(mapped);
    }
    const totalRaw = json.paging?.total;
    const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : facturas.length;
    return { facturas, total };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      const secs = Math.round(FETCH_TIMEOUT_MS / 1000);
      throw new Error(`La petición a DUX facturas no respondió a tiempo (${secs} s).`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
