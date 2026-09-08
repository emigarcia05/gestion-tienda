import { DUX_API_BATCH_SIZE } from "@/lib/duxApiBatchPolicy";

export const DUX_REMITOS_VENTA_BASE_URL =
  "https://erp.duxsoftware.com.ar/WSERP/rest/services/v2/remitos-venta";

export const DUX_REMITOS_VENTA_API_PAGE_LIMIT = DUX_API_BATCH_SIZE;

const FETCH_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.DUX_FETCH_TIMEOUT_MS) || 30_000
);

export type RemitoVentaDux = {
  idRemitoVenta: number;
  nroPtoVta: string;
  fecha: string;
  anulado: boolean;
  estadoFacturacion: string;
  totalFacturaAsociada: unknown;
};

interface RemitosApiResponseRaw {
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

export function mapRemitoVentaDux(raw: unknown): RemitoVentaDux | null {
  if (!isRecord(raw)) return null;
  const idRemitoVenta = Number(raw.id_remito_venta);
  if (!Number.isFinite(idRemitoVenta) || idRemitoVenta <= 0) return null;
  const nroPtoVta = String(raw.nro_pto_vta ?? "").trim();
  if (!nroPtoVta) return null;
  return {
    idRemitoVenta,
    nroPtoVta,
    fecha: String(raw.fecha ?? "").trim(),
    anulado: raw.anulado === true,
    estadoFacturacion: String(raw.estado_facturacion ?? "").trim(),
    totalFacturaAsociada: raw.total_factura_asociada,
  };
}

/**
 * GET `/v2/remitos-venta` — [listar_remitos_venta](https://developers.duxsoftware.com.ar/reference/listar_remitos_venta).
 * Auth Bearer (`DUX_API_TOKEN`).
 */
export async function fetchRemitosVentaPage(params: {
  fechaDesde: string;
  fechaHasta: string;
  idEmpresa: number;
  idSucursal: number;
  offset?: number;
  limit?: number;
}): Promise<{ remitos: RemitoVentaDux[]; hayMas: boolean }> {
  const token = process.env.DUX_API_TOKEN;
  if (!token) throw new Error("DUX_API_TOKEN no configurado.");

  const limitCapped = Math.min(
    Math.max(params.limit ?? DUX_REMITOS_VENTA_API_PAGE_LIMIT, 1),
    DUX_REMITOS_VENTA_API_PAGE_LIMIT
  );
  const offset = Math.max(0, params.offset ?? 0);

  const qs = new URLSearchParams({
    id_empresa: String(params.idEmpresa),
    id_sucursal: String(params.idSucursal),
    fecha_desde: params.fechaDesde,
    fecha_hasta: params.fechaHasta,
    anulado: "false",
    limit: String(limitCapped),
    offset: String(offset),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DUX_REMITOS_VENTA_BASE_URL}?${qs.toString()}`, {
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
        `Error API DUX remitos de venta: ${res.status} ${res.statusText}. ${bodyText}`.trim()
      );
    }
    const json: RemitosApiResponseRaw = (await res.json()) as RemitosApiResponseRaw;
    const rawDatos: unknown[] = Array.isArray(json.datos) ? json.datos : [];
    const remitos: RemitoVentaDux[] = [];
    for (const row of rawDatos) {
      const mapped = mapRemitoVentaDux(row);
      if (mapped) remitos.push(mapped);
    }
    const hayMasFlag = json.paginacion?.hay_mas;
    const hayMas =
      typeof hayMasFlag === "boolean" ? hayMasFlag : remitos.length >= limitCapped;
    return { remitos, hayMas };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      const secs = Math.round(FETCH_TIMEOUT_MS / 1000);
      throw new Error(`La petición a DUX remitos de venta no respondió a tiempo (${secs} s).`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
