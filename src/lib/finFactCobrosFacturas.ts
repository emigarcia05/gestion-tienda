import { dateToIsoYmdArgentina } from "@/lib/fechaArgentina";

const LETRAS_GRAVADO = new Set(["A", "C"]);

export function parseMontoGravadoDux(raw: unknown): number {
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

export function esLetraCompGravadoFactCobros(letraComp: string): boolean {
  return LETRAS_GRAVADO.has(letraComp.trim().toUpperCase());
}

export function esNotaCreditoTipoCompDux(tipoComp: string): boolean {
  return tipoComp.trim().toUpperCase().startsWith("NOTA_CREDITO");
}

export function facturaDuxEstaAnulada(params: {
  anuladaBoolean: boolean;
  anulada: string;
}): boolean {
  if (params.anuladaBoolean) return true;
  return params.anulada.trim().toUpperCase() === "S";
}

/** `1` suma, `-1` resta (NC), `0` se ignora. */
export function signoMontoGravadoFactCobros(params: {
  letraComp: string;
  tipoComp: string;
  anulada: boolean;
}): 1 | -1 | 0 {
  if (params.anulada) return 0;
  if (!esLetraCompGravadoFactCobros(params.letraComp)) return 0;
  if (esNotaCreditoTipoCompDux(params.tipoComp)) return -1;
  return 1;
}

export function periodoCalendarioDesdeFechaCompDux(
  fechaComp: string
): { mes: number; anio: number } | null {
  const d = new Date(fechaComp);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = dateToIsoYmdArgentina(d);
  const [ys, ms] = ymd.split("-");
  const anio = Number(ys);
  const mes = Number(ms);
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
