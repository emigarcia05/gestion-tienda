/**
 * Generación de PDF de comprobante (Factura · Crear) con jsPDF.
 * Cliente o servidor; sin persistencia.
 */

import { jsPDF } from "jspdf";
import {
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

const MARGIN = 14;
const PRIMARY = { r: 0, g: 114, b: 187 };

export type FacturaComprobantePdfInput = {
  tipo: FacturaTipo;
  fechaIso: string;
  cliente: string;
  nroComprobante: string;
  lineas: FacturaLineaLocal[];
  descuento: FacturaDescuentoEstado | null;
};

export function generarPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const contentWidth = pageWidth - 2 * MARGIN;
  let y = MARGIN;

  const titulo = FACTURA_TIPO_LABELS[input.tipo];
  doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setTextColor(17, 17, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const cliente = input.cliente.trim() || "—";
  const nro = input.nroComprobante.trim() || "—";
  const fecha = formatIsoYmdDdMmYyyyArgentina(input.fechaIso);
  doc.text(`Cliente: ${cliente}`, MARGIN, y);
  doc.text(`Fecha: ${fecha}`, MARGIN + contentWidth / 2, y);
  y += 5;
  doc.text(`N° Comprobante: ${nro}`, MARGIN, y);
  y += 8;

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
    doc.setTextColor(17, 17, 17);
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
      const rowH = Math.max(6, descLines.length * 3.2 + 2);

      let x = MARGIN + 1;
      const ty = y + 3.5;
      doc.text(String(linea.codTienda), x, ty);
      x += col.cod;
      doc.text(descLines, x, ty);
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

  const buf = doc.output("arraybuffer");
  return new Uint8Array(
    buf instanceof ArrayBuffer ? buf : (buf as unknown as ArrayBuffer)
  );
}
