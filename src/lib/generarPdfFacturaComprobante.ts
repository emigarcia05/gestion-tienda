/**
 * Generación de PDF de comprobante (Factura · Crear) con jsPDF.
 * Cliente o servidor; sin persistencia.
 *
 * Bloques: ENCABEZADO fijo (logo izq. | letra centrada | datos `ptos_vtas` a la derecha solo si fiscal) → CLIENTE → DETALLE → TOTAL.
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
  /** CUIT del receptor; se imprime solo si el tipo es fiscal. */
  clienteCuit?: string | null;
  /** Descripción ARCA MAYÚSCULAS; se imprime solo si el tipo es fiscal. */
  clienteCondicionIva?: string | null;
  /** Nombre de proyecto; `null` = no imprimir (un solo proyecto o ninguno). */
  proyectoNombre?: string | null;
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
  y = dibujarBloqueCliente(doc, input, y, contentWidth);

  const pctGlobal = porcentajeDescuentoGlobal(input.lineas, input.descuento);
  const col = {
    cod: 16,
    desc: 46,
    px: 28,
    descPct: 26,
    pxDesc: 32,
    cant: 14,
    total: 20,
  };
  const headerDetalleH = 11;

  function drawHeader() {
    doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    doc.rect(MARGIN, y, contentWidth, headerDetalleH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    const columnas: { lineas: string[]; w: number; centrado: boolean }[] = [
      { lineas: ["COD."], w: col.cod, centrado: false },
      { lineas: ["DESCRIPCIÓN"], w: col.desc, centrado: false },
      { lineas: ["PRECIO", "LISTA"], w: col.px, centrado: true },
      { lineas: ["DESCUENTO"], w: col.descPct, centrado: true },
      { lineas: ["PRECIO", "CON DESC."], w: col.pxDesc, centrado: true },
      { lineas: ["CANT."], w: col.cant, centrado: true },
      { lineas: ["TOTAL"], w: col.total, centrado: true },
    ];
    let x = MARGIN;
    const paso = 3.3;
    for (const columna of columnas) {
      const bloque = columna.lineas.length * paso;
      const base = y + (headerDetalleH - bloque) / 2 + 2.5;
      columna.lineas.forEach((linea, i) => {
        const ty = base + i * paso;
        if (columna.centrado) {
          doc.text(linea, x + columna.w / 2, ty, { align: "center" });
        } else {
          doc.text(linea, x + 1, ty);
        }
      });
      x += columna.w;
    }
    y += headerDetalleH;
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
      doc.text(String(linea.cantidad), x + col.cant / 2, ty, { align: "center" });
      x += col.cant;
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

function dibujarDatoEtiquetaValor(
  doc: jsPDF,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  maxW: number,
  unaLinea = true
): number {
  const gap = 1.2;
  const label = `${etiqueta}:`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(label, x, y);
  const labelW = doc.getTextWidth(label);
  doc.setFont("helvetica", "normal");
  const valorW = Math.max(8, maxW - labelW - gap);
  const lines = doc.splitTextToSize(valor, valorW);
  const arr = Array.isArray(lines) ? lines : [lines];
  const dibujo = unaLinea ? arr.slice(0, 1) : arr;
  doc.text(dibujo, x + labelW + gap, y);
  return Math.max(4.2, dibujo.length * 3.6);
}

function dibujarBloqueCliente(
  doc: jsPDF,
  input: FacturaComprobantePdfInput,
  y0: number,
  contentWidth: number
): number {
  const fiscal = esFacturaTipoFiscal(input.tipo);
  const cliente = input.cliente.trim() || FACTURA_CLIENTE_CONSUMIDOR_FINAL;
  const campos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "CLIENTE", valor: cliente },
  ];
  if (fiscal) {
    const cuit = formatoCuitPdf(input.clienteCuit ?? null);
    if ((input.clienteCuit ?? "").replace(/\D/g, "").length === 11) {
      campos.push({ etiqueta: "CUIT", valor: cuit });
    }
    const condIva = datoOVacio(input.clienteCondicionIva);
    if (condIva) campos.push({ etiqueta: "COND. IVA", valor: condIva });
  }
  const proyecto = datoOVacio(input.proyectoNombre);
  if (proyecto) campos.push({ etiqueta: "PROYECTO", valor: proyecto });

  const colW = contentWidth / campos.length;
  let rowH = 0;
  for (let i = 0; i < campos.length; i += 1) {
    const h = dibujarDatoEtiquetaValor(
      doc,
      campos[i].etiqueta,
      campos[i].valor,
      MARGIN + i * colW,
      y0,
      colW - 2
    );
    rowH = Math.max(rowH, h);
  }
  let y = y0 + rowH + 2;

  const comentarios = input.comentarios.trim();
  if (comentarios) {
    const h = dibujarDatoEtiquetaValor(
      doc,
      "COMENTARIOS",
      comentarios,
      MARGIN,
      y,
      contentWidth,
      false
    );
    y += h + 2;
  }
  return y + 2;
}

function dibujarEncabezado(
  doc: jsPDF,
  input: FacturaComprobantePdfInput,
  y0: number
): number {
  const pageW = 210;
  const pageCenterX = pageW / 2;
  const rightX = pageW - MARGIN;
  const headerH = 36;
  const logoSlot = { x: MARGIN, w: 52, h: 28 };
  const box = 18;
  /** 6.5 pt × 1,2: FECHA y datos de empresa. */
  const lineH = 4.08;
  const gapEtiquetaDato = 1.2;
  const muestraEmisor = esFacturaTipoFiscal(input.tipo);
  const emisor = muestraEmisor ? (input.emisor ?? null) : null;
  const nro = input.nroComprobante.trim();
  const fecha = formatIsoYmdDdMmYyyyArgentina(input.fechaIso);
  const logo = input.logo;
  if (logo && logo.naturalW > 0 && logo.naturalH > 0) {
    const scale = Math.min(
      logoSlot.w / logo.naturalW,
      logoSlot.h / logo.naturalH
    );
    const drawW = logo.naturalW * scale;
    const drawH = logo.naturalH * scale;
    const lx = logoSlot.x + (logoSlot.w - drawW) / 2;
    const format = logo.dataUrl.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(logo.dataUrl, format, lx, y0, drawW, drawH);
  }

  const letra = letraComprobantePdf(input);
  const tipoLabel = FACTURA_TIPO_LABELS[input.tipo];
  const boxX = pageCenterX - box / 2;
  const boxY = y0;
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

  const filasEmpresa = muestraEmisor
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
  /** FECHA siempre arriba a la derecha; empresa debajo (solo fiscal). */
  let ey = y0 + 2.4;
  ey = dibujarDatoDerecha(
    doc,
    "FECHA",
    fecha,
    rightX,
    ey,
    lineH,
    gapEtiquetaDato,
    72
  );
  for (const row of filasEmpresa) {
    ey = dibujarDatoDerecha(
      doc,
      row.etiqueta,
      row.valor,
      rightX,
      ey,
      lineH,
      gapEtiquetaDato,
      72
    );
  }

  return y0 + headerH + 6;
}

function dibujarDatoDerecha(
  doc: jsPDF,
  etiqueta: string,
  valor: string,
  rightX: number,
  ey: number,
  lineH: number,
  gapEtiquetaDato: number,
  empresaMaxW: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  const label = `${etiqueta}:`;
  const etiquetaW = doc.getTextWidth(label);
  const valorMaxW = Math.max(18, empresaMaxW - etiquetaW - gapEtiquetaDato);
  doc.setFont("helvetica", "normal");
  const split = valor ? doc.splitTextToSize(valor, valorMaxW) : [""];
  const lines = Array.isArray(split) ? split : [split];
  const primera = lines[0] ?? "";
  const primeraW = doc.getTextWidth(primera);
  const lineaX = rightX - (etiquetaW + gapEtiquetaDato + primeraW);
  doc.setFont("helvetica", "bold");
  doc.text(label, lineaX, ey);
  doc.setFont("helvetica", "normal");
  doc.text(primera, lineaX + etiquetaW + gapEtiquetaDato, ey);
  let y = ey;
  for (let i = 1; i < lines.length; i += 1) {
    y += lineH;
    doc.text(lines[i] ?? "", rightX, y, { align: "right" });
  }
  return y + lineH;
}
