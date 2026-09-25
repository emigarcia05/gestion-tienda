import { descargarPdfBytes } from "@/lib/descargarPdfBase64";
import { ENVIOS_PDF_MAX_BYTES } from "@/lib/envios";
import type { FacturaComprobantePdfInput } from "@/lib/generarPdfFacturaComprobante";

/** `2026-03-15` → `15-03-26` (nombre de archivo). */
export function formatIsoYmdDdMmYyGuionesArchivo(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-");
  if (!y || !m || !d) return isoYmd;
  return `${d}-${m}-${y.slice(-2)}`;
}

function sanitizarSegmentoNombreArchivo(raw: string): string {
  return raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

/** Últimos 4 dígitos del N° comprobante (si no hay dígitos → `S-N`). */
export function ultimos4NumerosComprobante(nroComprobante: string): string {
  const digits = nroComprobante.replace(/\D/g, "");
  if (!digits) return "S-N";
  return digits.slice(-4);
}

/**
 * `Cliente - dd-mm-aa - {últimos 4 del comprobante} - (Comentarios).pdf`
 * Si no hay comentarios, se omite el segmento entre paréntesis.
 */
export function nombreArchivoComprobanteFactura(opts: {
  cliente: string;
  fechaIso: string;
  nroComprobante: string;
  comentarios?: string;
}): string {
  const cliente = sanitizarSegmentoNombreArchivo(opts.cliente) || "SIN CLIENTE";
  const fecha = formatIsoYmdDdMmYyGuionesArchivo(opts.fechaIso);
  const nro = ultimos4NumerosComprobante(opts.nroComprobante);
  const comentarios = sanitizarSegmentoNombreArchivo(opts.comentarios ?? "");
  const base = `${cliente} - ${fecha} - ${nro}`;
  if (!comentarios) return `${base}.pdf`;
  return `${base} - (${comentarios}).pdf`;
}

export function bytesPdfAAdjuntoEnvio(
  nombre: string,
  bytes: Uint8Array
): { nombre: string; base64: string } | null {
  if (bytes.byteLength > ENVIOS_PDF_MAX_BYTES) return null;
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { nombre, base64: btoa(binary) };
}

export async function generarBytesPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Promise<Uint8Array> {
  const { generarPdfFacturaComprobante } = await import(
    "@/lib/generarPdfFacturaComprobante"
  );
  return generarPdfFacturaComprobante(input);
}

export async function descargarPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Promise<void> {
  const bytes = await generarBytesPdfFacturaComprobante(input);
  const filename = nombreArchivoComprobanteFactura({
    cliente: input.cliente,
    fechaIso: input.fechaIso,
    nroComprobante: input.nroComprobante,
    comentarios: input.comentarios,
  });
  descargarPdfBytes(bytes, filename);
}

export async function imprimirPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Promise<void> {
  const bytes = await generarBytesPdfFacturaComprobante(input);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, "_blank");
  if (!ventana) {
    URL.revokeObjectURL(url);
    throw new Error(
      "No se pudo abrir la ventana de impresión. Revisá el bloqueo de ventanas emergentes."
    );
  }
  const disparar = () => {
    try {
      ventana.focus();
      ventana.print();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };
  ventana.addEventListener("load", disparar);
  window.setTimeout(disparar, 600);
}

export async function imprimirYDescargarPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Promise<void> {
  await descargarPdfFacturaComprobante(input);
  await imprimirPdfFacturaComprobante(input);
}
