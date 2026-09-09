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

/** Letra de la factura asociada (`FACTURA C-00007-…` → `C`). El remito suele ser X. */
export function letraFacturaAsociadaDesdeNro(nroFactura: string): "A" | "C" | null {
  const m = nroFactura.trim().toUpperCase().match(/\bFACTURA\s+([AC])\b/);
  if (m?.[1] === "A" || m?.[1] === "C") return m[1];
  return null;
}

/** Remito entra en el TOTAL: no anulado, factura asociada A o C, y `total_factura_asociada` > 0. */
export function remitoVentaEntraEnTotal(params: {
  anulado: boolean;
  nroFacturaString: string;
  totalFacturaAsociada: unknown;
}): boolean {
  if (params.anulado) return false;
  if (letraFacturaAsociadaDesdeNro(params.nroFacturaString) == null) return false;
  return parseImporteFacturaDux(params.totalFacturaAsociada) > 0;
}
