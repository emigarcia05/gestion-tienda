import { descargarPdfBytes } from "@/lib/descargarPdfBase64";
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

/**
 * `Cliente - fecha (dd-mm-aa) - N° Comprobante.pdf`
 */
export function nombreArchivoComprobanteFactura(opts: {
  cliente: string;
  fechaIso: string;
  nroComprobante: string;
}): string {
  const cliente = sanitizarSegmentoNombreArchivo(opts.cliente) || "SIN CLIENTE";
  const fecha = formatIsoYmdDdMmYyGuionesArchivo(opts.fechaIso);
  const nro =
    sanitizarSegmentoNombreArchivo(opts.nroComprobante) || "S-N";
  return `${cliente} - ${fecha} - ${nro}.pdf`;
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
