export function parseImporteFacturaDux(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!text) return 0;
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  let normalized = text;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandSeparator = decimalSeparator === "." ? "," : ".";
    normalized = text.split(thousandSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = text.replace(",", ".");
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Periodo desde `fecha` ISO `yyyy-MM-dd` (sin `Date`, evita corrimiento TZ).
 */
export function periodoCalendarioDesdeFechaIsoYmd(
  fecha: string
): { mes: number; anio: number } | null {
  const m = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return null;
  }
  return { mes, anio };
}

export function rangoIsoMesCalendario(
  mes: number,
  anio: number
): { fechaDesde: string; fechaHasta: string } {
  const last = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    fechaDesde: `${anio}-${pad(mes)}-01`,
    fechaHasta: `${anio}-${pad(mes)}-${pad(last)}`,
  };
}

/** `nro_pto_vta` DUX → entero para cruzar con `global_pto_vtas.pto_venta`. */
export function parseNroPtoVtaDux(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

const LETRA_COMPROBANTE_RE =
  /(?:FACTURA|NOTA\s+DE\s+CR[EÉ]DITO|NOTA\s+DE\s+D[EÉ]BITO|TIQUE(?:TE)?(?:\s+FACTURA)?)\s+([A-Z])(?:\s|-|$)/;

/**
 * Letra del comprobante asociado (`FACTURA A-…`, `FACTURA B-…`, NC/ND, etc.).
 * No usar `letra_comp` del remito (suele ser X).
 */
export function letraComprobanteAsociadoRemito(params: {
  nroFacturaString: string;
  nrosFacturaVinculados: string[];
}): string | null {
  const candidatos = [params.nroFacturaString, ...params.nrosFacturaVinculados];
  for (const raw of candidatos) {
    const u = raw.trim().toUpperCase();
    const m = u.match(LETRA_COMPROBANTE_RE);
    if (m?.[1] && /^[A-Z]$/.test(m[1])) return m[1];
    const m2 = u.match(/\b([A-Z])-\d{4,}/);
    if (m2?.[1] && /^[A-Z]$/.test(m2[1])) return m2[1];
  }
  return null;
}

const ACUMULADO_SEP = "|";

export function claveAcumuladoFactCobros(ptoVtaId: string, letra: string): string {
  return `${ptoVtaId}${ACUMULADO_SEP}${letra}`;
}

export function parseClaveAcumuladoFactCobros(
  clave: string
): { ptoVtaId: string; letra: string } | null {
  const i = clave.lastIndexOf(ACUMULADO_SEP);
  if (i <= 0 || i === clave.length - 1) return null;
  const ptoVtaId = clave.slice(0, i);
  const letra = clave.slice(i + 1);
  if (!ptoVtaId || !/^[A-Z]$/.test(letra)) return null;
  return { ptoVtaId, letra };
}

/** Remito entra en el total: no anulado, hay letra de comprobante y `total_factura_asociada` > 0. */
export function remitoVentaEntraEnTotal(params: {
  anulado: boolean;
  nroFacturaString: string;
  nrosFacturaVinculados: string[];
  totalFacturaAsociada: unknown;
}): boolean {
  if (params.anulado) return false;
  if (
    letraComprobanteAsociadoRemito({
      nroFacturaString: params.nroFacturaString,
      nrosFacturaVinculados: params.nrosFacturaVinculados,
    }) == null
  ) {
    return false;
  }
  return parseImporteFacturaDux(params.totalFacturaAsociada) > 0;
}
