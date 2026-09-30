/**
 * QR de comprobante electrónico.
 * Especificación ARCA (versión 1): https://www.arca.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
 * El cuerpo de esa especificación fija la URL. El ejemplo del pie todavía muestra afip.gob.ar.
 */

import { roundArs2 } from "@/lib/facturaFiscal";

/** URL normativa del cuerpo de la especificación vigente. */
export const ARCA_QR_URL = "https://www.arca.gob.ar/fe/qr/";

export type QrComprobanteFiscalInput = {
  fechaIso: string;
  cuitEmisor: string;
  ptoVenta: number;
  cbteTipo: number;
  cbteNro: number;
  impTotal: number;
  moneda: string;
  cotizacion: number;
  receptorDocTipo: number;
  receptorDocNro: string;
  cae: string;
};

function soloDigitos(raw: string): string {
  return raw.replace(/\D/g, "");
}

function importeJson(n: number): string {
  const v = roundArs2(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function cotizacionJson(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "1";
  return Number.isInteger(n) ? String(n) : String(n);
}

function base64Ascii(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** JSON versión 1, sin espacios, con CUIT y CAE como números (no pierden dígitos). */
export function jsonQrComprobanteFiscal(input: QrComprobanteFiscalInput): string {
  const cuit = soloDigitos(input.cuitEmisor);
  const cae = soloDigitos(input.cae);
  const doc = soloDigitos(input.receptorDocNro) || "0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fechaIso)) {
    throw new Error("La fecha del QR fiscal es inválida.");
  }
  if (!/^\d{11}$/.test(cuit)) {
    throw new Error("El CUIT del emisor no puede ir en el QR.");
  }
  if (!/^\d{14}$/.test(cae)) {
    throw new Error("El CAE no puede ir en el QR.");
  }
  const moneda = input.moneda.trim().toUpperCase() || "PES";
  if (moneda.length !== 3) {
    throw new Error("La moneda del QR fiscal es inválida.");
  }
  return (
    "{" +
    `"ver":1,` +
    `"fecha":${JSON.stringify(input.fechaIso)},` +
    `"cuit":${cuit},` +
    `"ptoVta":${input.ptoVenta},` +
    `"tipoCmp":${input.cbteTipo},` +
    `"nroCmp":${input.cbteNro},` +
    `"importe":${importeJson(input.impTotal)},` +
    `"moneda":${JSON.stringify(moneda)},` +
    `"ctz":${cotizacionJson(input.cotizacion)},` +
    `"tipoDocRec":${input.receptorDocTipo},` +
    `"nroDocRec":${doc},` +
    `"tipoCodAut":"E",` +
    `"codAut":${cae}` +
    "}"
  );
}

export function urlQrComprobanteFiscal(input: QrComprobanteFiscalInput): string {
  return `${ARCA_QR_URL}?p=${base64Ascii(jsonQrComprobanteFiscal(input))}`;
}

type QrCodeApi = {
  toDataURL: (
    text: string,
    options: { errorCorrectionLevel: "M"; margin: number; width: number }
  ) => Promise<string>;
};

export async function dataUrlQrComprobanteFiscal(
  input: QrComprobanteFiscalInput
): Promise<string> {
  const cargado = (await import("qrcode")) as QrCodeApi & { default?: QrCodeApi };
  const api = typeof cargado.toDataURL === "function" ? cargado : cargado.default;
  if (!api) throw new Error("No se pudo generar el código QR.");
  return api.toDataURL(urlQrComprobanteFiscal(input), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
  });
}
