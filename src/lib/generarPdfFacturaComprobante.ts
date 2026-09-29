/**
 * Generación de PDF de comprobante (Factura · Crear) con jsPDF.
 * Cliente o servidor; sin persistencia.
 *
 * Bloques: ENCABEZADO (logo | letra | datos `ptos_vtas`) → CLIENTE → DETALLE → TOTAL.
 */

import { jsPDF } from "jspdf";
import {
  esFacturaTipoFiscal,
  FACTURA_CLIENTE_CONSUMIDOR_FINAL,
  FACTURA_TIPO_LABELS,
  porcentajeDescuentoGlobal,
  porcentajeDescuentoLinea,
  pxConDescuento,
  resumenTotalesFactura,
  totalLineaConDescuento,
  type FacturaDescuentoEstado,
  type FacturaLineaLocal,
  type FacturaTipo,
} from "@/lib/factura";
import { formatIsoYmdDdMmYyyyArgentina } from "@/lib/fechaArgentina";
import { fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import {
  formatoCuitPdf,
  type FacturaComprobantePdfEmisor,
} from "@/lib/facturaComprobantePdfEmisor";

const MARGIN = 14;
const PRIMARY = { r: 0, g: 114, b: 187 };
const INK = { r: 17, g: 17, b: 17 };

export type { FacturaComprobantePdfEmisor } from "@/lib/facturaComprobantePdfEmisor";
export {
  emisorPdfDesdePtoVta,
  formatoCuitPdf,
} from "@/lib/facturaComprobantePdfEmisor";

export type FacturaComprobantePdfLogo = {
  dataUrl: string;
  naturalW: number;
  naturalH: number;
};

export type FacturaComprobantePdfInput = {
  tipo: FacturaTipo;
  fechaIso: string;
  cliente: string;
  nroComprobante: string;
  comentarios: string;
  lineas: FacturaLineaLocal[];
  descuento: FacturaDescuentoEstado | null;
  cae?: string | null;
  caeVtoIso?: string | null;
  letra?: string | null;
  emisor?: FacturaComprobantePdfEmisor | null;
  logo?: FacturaComprobantePdfLogo | null;
};

function letraComprobantePdf(input: FacturaComprobantePdfInput): string {
  const letra = input.letra?.trim();
  if (letra) return letra.toLocaleUpperCase("es-AR");
  return "X";
}

function datoOVacio(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export function generarPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentWidth = 210 - 2 * MARGIN;
  let y = MARGIN;

  y = dibujarEncabezado(doc, input, y);

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const cliente = input.cliente.trim() || FACTURA_CLIENTE_CONSUMIDOR_FINAL;
  doc.text(`Cliente: ${cliente}`, MARGIN, y);
  y += 5;
  const comentarios = input.comentarios.trim();
  if (comentarios) {
    const comentarioLines = doc.splitTextToSize(
      `Comentarios: ${comentarios}`,
      contentWidth
    );
    doc.text(comentarioLines, MARGIN, y);
    y += Math.max(5, comentarioLines.length * 4 + 1);
  }
  y += 3;

  const pctGlobal = porcentajeDescuentoGlobal(input.lineas, input.descuento);
  const col = {
    cod: 18,
    desc: 58,
    cant: 16,
    px: 24,
    descPct: 18,
    pxDesc: 24,
    total: 24,
  };

  function drawHeader() {
    doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    doc.rect(MARGIN, y, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    let x = MARGIN + 1;
    const hy = y + 4.5;
    doc.text("COD.", x, hy);
    x += col.cod;
    doc.text("DESCRIPCIÓN", x, hy);
    x += col.desc;
    doc.text("CANT.", x + col.cant / 2, hy, { align: "center" });
    x += col.cant;
    doc.text("PX. LISTA", x + col.px / 2, hy, { align: "center" });
    x += col.px;
    doc.text("DESC.", x + col.descPct / 2, hy, { align: "center" });
    x += col.descPct;
    doc.text("PX C/D", x + col.pxDesc / 2, hy, { align: "center" });
    x += col.pxDesc;
    doc.text("TOTAL", x + col.total / 2, hy, { align: "center" });
    y += 7;
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("helvetica", "normal");
  }

  drawHeader();

  if (input.lineas.length === 0) {
    doc.setFontSize(9);
    doc.text("Sin ítems.", MARGIN, y + 6);
  } else {
    doc.setFontSize(7.5);
    for (const linea of input.lineas) {
      if (y > 270) {
        doc.addPage();
        y = MARGIN;
        drawHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
      }
      const pct = porcentajeDescuentoLinea(linea, pctGlobal);
      const pxDesc = pxConDescuento(linea.pxLista, pct);
      const total = totalLineaConDescuento(linea, pct);
      const descLines = doc.splitTextToSize(linea.descripcion, col.desc - 2);
      const comentario = linea.comentario.trim();
      const comentarioLines = comentario
        ? doc.splitTextToSize(comentario, col.desc - 2)
        : [];
      const rowH = Math.max(
        6,
        descLines.length * 3.2 + comentarioLines.length * 3 + 2
      );

      let x = MARGIN + 1;
      const ty = y + 3.5;
      doc.text(String(linea.codTienda), x, ty);
      x += col.cod;
      doc.text(descLines, x, ty);
      if (comentarioLines.length > 0) {
        doc.setFontSize(6.5);
        doc.setTextColor(80, 80, 80);
        doc.text(comentarioLines, x, ty + descLines.length * 3.2);
        doc.setTextColor(INK.r, INK.g, INK.b);
        doc.setFontSize(7.5);
      }
      x += col.desc;
      doc.text(String(linea.cantidad), x + col.cant / 2, ty, { align: "center" });
      x += col.cant;
      doc.text(`$${fmtPrecio(linea.pxLista)}`, x + col.px / 2, ty, {
        align: "center",
      });
      x += col.px;
      doc.text(fmtPorcentajeTabla(pct), x + col.descPct / 2, ty, {
        align: "center",
      });
      x += col.descPct;
      doc.text(`$${fmtPrecio(pxDesc)}`, x + col.pxDesc / 2, ty, {
        align: "center",
      });
      x += col.pxDesc;
      doc.text(`$${fmtPrecio(total)}`, x + col.total / 2, ty, {
        align: "center",
      });
      y += rowH;
    }
  }

  const resumen = resumenTotalesFactura(input.lineas, input.descuento);
  y += 6;
  if (y > 270) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`TOTAL ITEM: ${resumen.totalItem}`, MARGIN, y);
  y += 5;
  doc.text(`TOTAL $: $${fmtPrecio(resumen.totalLista)}`, MARGIN, y);
  y += 5;
  doc.text(
    `DESC. % PROMEDIO: ${fmtPorcentajeTabla(resumen.descPctPromedio)}`,
    MARGIN,
    y
  );
  y += 5;
  doc.text(`DESC. $: $${fmtPrecio(resumen.descPesos)}`, MARGIN, y);
  y += 5;
  doc.text(`TOTAL C/ DESC.: $${fmtPrecio(resumen.totalConDesc)}`, MARGIN, y);

  const cae = input.cae?.trim();
  if (cae) {
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`CAE: ${cae}`, MARGIN, y);
    y += 5;
    const vto = input.caeVtoIso
      ? formatIsoYmdDdMmYyyyArgentina(input.caeVtoIso)
      : "";
    doc.text(`Vto. CAE: ${vto}`, MARGIN, y);
  }

  const buf = doc.output("arraybuffer");
  return new Uint8Array(
    buf instanceof ArrayBuffer ? buf : (buf as unknown as ArrayBuffer)
  );
}

function dibujarEncabezado(
  doc: jsPDF,
  input: FacturaComprobantePdfInput,
  y0: number
): number {
  const pageW = 210;
  const pageCenterX = pageW / 2;
  const rightX = pageW - MARGIN;
  const logoMaxW = 52;
  const logoMaxH = 28;
  const box = 18;
  const lineH = 3.4;
  const gapEtiquetaDato = 1.2;
  const muestraEmisor = esFacturaTipoFiscal(input.tipo);
  const emisor = muestraEmisor ? (input.emisor ?? null) : null;

  const empresaRows = muestraEmisor
    ? [
        { etiqueta: "CUIT", valor: formatoCuitPdf(emisor?.cuit ?? null) },
        { etiqueta: "RAZÓN SOCIAL", valor: datoOVacio(emisor?.razonSocial) },
        { etiqueta: "IIBB", valor: datoOVacio(emisor?.iiBb) },
        { etiqueta: "DOMICILIO", valor: datoOVacio(emisor?.domicilio) },
        {
          etiqueta: "INICIO ACTIVIDADES",
          valor: emisor?.inicioActividadesIso
            ? formatIsoYmdDdMmYyyyArgentina(emisor.inicioActividadesIso)
            : "",
        },
      ]
    : [];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  const empresaMaxW = 72;
  const wrapped: { etiqueta: string; lines: string[] }[] = [];
  let empresaBodyH = 0;
  for (const row of empresaRows) {
    const etiquetaW = doc.getTextWidth(`${row.etiqueta}:`);
    const valorMaxW = Math.max(18, empresaMaxW - etiquetaW - gapEtiquetaDato);
    const split = row.valor
      ? doc.splitTextToSize(row.valor, valorMaxW)
      : [""];
    const lines = Array.isArray(split) ? split : [split];
    wrapped.push({ etiqueta: row.etiqueta, lines });
    empresaBodyH += Math.max(lineH, lines.length * lineH);
  }

  const letra = letraComprobantePdf(input);
  const tipoLabel = FACTURA_TIPO_LABELS[input.tipo];
  const nro = input.nroComprobante.trim();
  const fecha = formatIsoYmdDdMmYyyyArgentina(input.fechaIso);
  const letraBlockH = box + 14;
  const headerH = Math.max(logoMaxH, letraBlockH, empresaBodyH, 28);

  const logo = input.logo;
  if (logo && logo.naturalW > 0 && logo.naturalH > 0) {
    const scale = Math.min(logoMaxW / logo.naturalW, logoMaxH / logo.naturalH);
    const drawW = logo.naturalW * scale;
    const drawH = logo.naturalH * scale;
    const ly = y0 + (headerH - drawH) / 2;
    const format = logo.dataUrl.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(logo.dataUrl, format, MARGIN, ly, drawW, drawH);
  }

  const boxX = pageCenterX - box / 2;
  const boxY = y0 + (headerH - letraBlockH) / 2;
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.6);
  doc.rect(boxX, boxY, box, box, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(letra, pageCenterX, boxY + 12.2, { align: "center" });
  doc.setFontSize(7);
  doc.text(tipoLabel, pageCenterX, boxY + box + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  if (nro) {
    doc.text(`N° ${nro}`, pageCenterX, boxY + box + 8, { align: "center" });
  }
  doc.text(`FECHA ${fecha}`, pageCenterX, boxY + box + 11.4, {
    align: "center",
  });

  if (muestraEmisor) {
    let ey = y0 + (headerH - empresaBodyH) / 2 + 2.4;
    for (const row of wrapped) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      const etiqueta = `${row.etiqueta}:`;
      const etiquetaW = doc.getTextWidth(etiqueta);
      doc.setFont("helvetica", "normal");
      const primera = row.lines[0] ?? "";
      const primeraW = doc.getTextWidth(primera);
      const lineaW = etiquetaW + gapEtiquetaDato + primeraW;
      const lineaX = rightX - lineaW;
      doc.setFont("helvetica", "bold");
      doc.text(etiqueta, lineaX, ey);
      doc.setFont("helvetica", "normal");
      doc.text(primera, lineaX + etiquetaW + gapEtiquetaDato, ey);
      for (let i = 1; i < row.lines.length; i += 1) {
        ey += lineH;
        doc.text(row.lines[i] ?? "", rightX, ey, { align: "right" });
      }
      ey += lineH;
    }
  }

  return y0 + headerH + 6;
}
