/**
 * Generación de PDF de comprobante (Factura · Crear) con jsPDF.
 * Cliente o servidor; sin persistencia.
 *
 * Bloques: ENCABEZADO fijo (logo 40 % | letra 20 % | datos empresa 40 %, los tres al borde superior) → CLIENTE → DETALLE → TOTAL.
 */

import { jsPDF } from "jspdf";
import {
  esFacturaTipoFiscal,
  FACTURA_CLIENTE_CONSUMIDOR_FINAL,
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
  type FacturaComprobantePdfFiscal,
} from "@/lib/facturaComprobantePdfEmisor";
import {
  LEYENDA_A_CONSUMIDOR_FINAL,
  LEYENDA_TRANSPARENCIA_FISCAL,
} from "@/lib/facturaFiscal";

const MARGIN = 14;
const PRIMARY = { r: 0, g: 114, b: 187 };
/** Azul suave ya usado en guías (Balance mensual: `#A9D6F1`). */
const PRIMARY_SOFT = { r: 169, g: 214, b: 241 };
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
  /** Presente solo si ARCA autorizó el comprobante. */
  fiscal?: FacturaComprobantePdfFiscal | null;
};

function letraComprobantePdf(input: FacturaComprobantePdfInput): string {
  const letra = input.letra?.trim();
  if (letra) return letra.toLocaleUpperCase("es-AR");
  return "X";
}

function tipoComprobantePdfLabel(tipo: FacturaTipo): string {
  if (tipo === "factura_fiscal") return "FACTURA";
  if (tipo === "factura_no_fiscal") return "COMPROBANTE";
  if (tipo === "nota_credito_fiscal" || tipo === "nota_credito_no_fiscal") {
    return "NOTA CREDITO";
  }
  return "PRESUPUESTO";
}

function datoOVacio(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export function generarPdfFacturaComprobante(
  input: FacturaComprobantePdfInput
): Uint8Array {
  if (esFacturaTipoFiscal(input.tipo)) {
    if (!input.cae?.trim()) {
      throw new Error("El comprobante fiscal no está autorizado por ARCA.");
    }
    if (!input.fiscal?.qrDataUrl) {
      throw new Error("Falta el código QR del comprobante fiscal.");
    }
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentWidth = 210 - 2 * MARGIN;
  let y = MARGIN;

  y = dibujarEncabezado(doc, input, y);
  y = dibujarBloqueCliente(doc, input, y, contentWidth);

  const pctGlobal = porcentajeDescuentoGlobal(input.lineas, input.descuento);
  const col = {
    cod: 18,
    desc: 74,
    px: 20,
    descPct: 15,
    pxDesc: 20,
    cant: 10,
    total: 25,
  };
  const headerDetalleH = 11;

  function drawHeader() {
    doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    doc.rect(MARGIN, y, contentWidth, headerDetalleH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    /** 6.5 pt × 1,2. */
    const headerFont = 7.8;
    doc.setFontSize(headerFont);
    const columnas: { lineas: string[]; w: number }[] = [
      { lineas: ["COD."], w: col.cod },
      { lineas: ["DESCRIPCIÓN"], w: col.desc },
      { lineas: ["PRECIO", "LISTA"], w: col.px },
      { lineas: ["DESC."], w: col.descPct },
      { lineas: ["PRECIO", "CON DESC."], w: col.pxDesc },
      { lineas: ["CANT."], w: col.cant },
      { lineas: ["TOTAL"], w: col.total },
    ];
    let x = MARGIN;
    const paso = 4;
    const capH = headerFont * 0.352778 * 0.72;
    const centroY = y + headerDetalleH / 2;
    for (const columna of columnas) {
      const base =
        centroY - ((columna.lineas.length - 1) * paso) / 2 + capH / 2;
      columna.lineas.forEach((linea, i) => {
        doc.text(linea, x + columna.w / 2, base + i * paso, {
          align: "center",
        });
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
    for (let idx = 0; idx < input.lineas.length; idx += 1) {
      const linea = input.lineas[idx]!;
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

      let x = MARGIN;
      const ty = y + 3.5;
      doc.text(String(linea.codTienda), x + col.cod / 2, ty, { align: "center" });
      x += col.cod;
      doc.text(descLines, x + 1, ty);
      if (comentarioLines.length > 0) {
        doc.setFontSize(6.5);
        doc.setTextColor(80, 80, 80);
        doc.text(comentarioLines, x + 1, ty + descLines.length * 3.2);
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
      if (idx < input.lineas.length - 1) {
        doc.setDrawColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y, MARGIN + contentWidth, y);
        doc.setDrawColor(INK.r, INK.g, INK.b);
      }
    }
  }

  const resumen = resumenTotalesFactura(input.lineas, input.descuento);
  const fiscal = input.fiscal ?? null;
  if (fiscal?.discriminarIva) {
    y = dibujarDiscriminacionIva(doc, fiscal, y, contentWidth);
  }
  const totalMostrado = fiscal ? fiscal.impTotal : resumen.totalConDesc;
  const footerH = 8;
  y += 2;
  if (y + footerH > 270) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFillColor(PRIMARY_SOFT.r, PRIMARY_SOFT.g, PRIMARY_SOFT.b);
  doc.rect(MARGIN, y, contentWidth, footerH, "F");
  const footerY = y + 5.2;
  doc.setFont("helvetica", "bold");
  /** Mismo tamaño que filas de tabla, conservando negrita. */
  doc.setFontSize(7.5);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const totalColX = MARGIN + col.cod + col.desc + col.px + col.descPct + col.pxDesc + col.cant;
  const totalColCenterX = totalColX + col.total / 2;
  const totalValue = `$${fmtPrecio(totalMostrado)}`;
  /** Mantiene etiqueta y valor juntos, pero alinea el monto con la columna TOTAL. */
  doc.text("TOTAL:", totalColCenterX - doc.getTextWidth(totalValue) / 2 - 0.8, footerY, {
    align: "right",
  });
  doc.text(totalValue, totalColCenterX, footerY, { align: "center" });
  y += footerH;
  doc.setTextColor(INK.r, INK.g, INK.b);

  if (fiscal?.qrDataUrl && input.cae?.trim()) {
    y = dibujarPieFiscal(doc, input, fiscal, y, contentWidth);
  }

  const buf = doc.output("arraybuffer");
  return new Uint8Array(
    buf instanceof ArrayBuffer ? buf : (buf as unknown as ArrayBuffer)
  );
}

function dibujarDiscriminacionIva(
  doc: jsPDF,
  fiscal: FacturaComprobantePdfFiscal,
  y0: number,
  contentWidth: number
): number {
  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: "NETO GRAVADO", valor: `$${fmtPrecio(fiscal.impNeto)}` },
    ...fiscal.alicuotas.map((a) => ({
      etiqueta: `IVA ${fmtPorcentajeTabla(a.alicuota)}`,
      valor: `$${fmtPrecio(a.importe)}`,
    })),
    {
      etiqueta: "OTROS TRIBUTOS",
      valor: `$${fmtPrecio(fiscal.impTrib)}`,
    },
  ];
  let y = y0 + 1.5;
  doc.setFontSize(7.5);
  doc.setTextColor(INK.r, INK.g, INK.b);
  for (const fila of filas) {
    if (y > 272) {
      doc.addPage();
      y = MARGIN;
    }
    const right = MARGIN + contentWidth;
    doc.setFont("helvetica", "bold");
    doc.text(fila.etiqueta, right - 28, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(fila.valor, right, y, { align: "right" });
    y += 3.6;
  }
  return y;
}

function dibujarPieFiscal(
  doc: jsPDF,
  input: FacturaComprobantePdfInput,
  fiscal: FacturaComprobantePdfFiscal,
  y0: number,
  contentWidth: number
): number {
  const qrSize = 32;
  const bloqueTransparencia = fiscal.transparenciaFiscal ? 16 : 0;
  const bloqueH = qrSize + bloqueTransparencia + 4;
  let y = y0 + 4;
  if (y + bloqueH > 280) {
    doc.addPage();
    y = MARGIN;
  }
  const qr = fiscal.qrDataUrl;
  if (qr) {
    doc.addImage(qr, "PNG", MARGIN, y, qrSize, qrSize);
  }
  const textX = MARGIN + qrSize + 4;
  const cae = input.cae?.trim() ?? "";
  const vto = input.caeVtoIso ? formatIsoYmdDdMmYyyyArgentina(input.caeVtoIso) : "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(`CAE: ${cae}`, textX, y + 8);
  doc.text(`Vto. CAE: ${vto}`, textX, y + 14);
  y += qrSize + 3;
  if (fiscal.transparenciaFiscal) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const titulo = doc.splitTextToSize(LEYENDA_TRANSPARENCIA_FISCAL, contentWidth);
    doc.text(titulo, MARGIN, y);
    const lineasTitulo = Array.isArray(titulo) ? titulo.length : 1;
    y += lineasTitulo * 3.6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`IVA Contenido: $${fmtPrecio(fiscal.impIva)}`, MARGIN, y);
    y += 3.8;
    doc.text(
      `Otros Impuestos Nacionales Indirectos: $${fmtPrecio(fiscal.impTrib)}`,
      MARGIN,
      y
    );
    y += 4;
  }
  return y;
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
  const proyecto = datoOVacio(input.proyectoNombre);
  const colW = contentWidth / 2;
  const col1X = MARGIN;
  const col2X = MARGIN + colW;
  const filaGap = 1.2;

  let yCol1 = y0;
  const hCliente = dibujarDatoEtiquetaValor(
    doc,
    "CLIENTE",
    cliente,
    col1X,
    yCol1,
    colW - 2
  );
  yCol1 += hCliente + filaGap;
  if (proyecto) {
    const hProyecto = dibujarDatoEtiquetaValor(
      doc,
      "PROYECTO",
      proyecto,
      col1X,
      yCol1,
      colW - 2
    );
    yCol1 += hProyecto + filaGap;
  }

  let yCol2 = y0;
  if (fiscal) {
    const etiquetaDoc =
      input.fiscal?.receptorDocTipo === 96
        ? "DNI"
        : input.fiscal?.receptorDocTipo === 86
          ? "CUIL"
          : "CUIT";
    const hCuit = dibujarDatoEtiquetaValor(
      doc,
      etiquetaDoc,
      formatoCuitPdf(input.clienteCuit ?? null),
      col2X,
      yCol2,
      colW - 2
    );
    yCol2 += hCuit + filaGap;
    const hCondIva = dibujarDatoEtiquetaValor(
      doc,
      "COND. IVA",
      datoOVacio(input.clienteCondicionIva),
      col2X,
      yCol2,
      colW - 2
    );
    yCol2 += hCondIva + filaGap;
    const domicilio = datoOVacio(input.fiscal?.receptorDomicilio);
    if (domicilio) {
      const hDom = dibujarDatoEtiquetaValor(
        doc,
        "DOMICILIO",
        domicilio,
        col2X,
        yCol2,
        colW - 2,
        false
      );
      yCol2 += hDom + filaGap;
    }
  }
  if (input.fiscal?.leyendaConsumidorFinal) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(LEYENDA_A_CONSUMIDOR_FINAL, col1X, yCol1);
    yCol1 += 4.2;
  }

  let y = Math.max(yCol1, yCol2) + 1;

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
  const contentW = 210 - 2 * MARGIN;
  const colLogoW = contentW * 0.4;
  const colLetraW = contentW * 0.2;
  const colDatosW = contentW * 0.4;
  const colLogoX = MARGIN;
  const colLetraX = colLogoX + colLogoW;
  const colDatosX = colLetraX + colLetraW;
  const letraCenterX = colLetraX + colLetraW / 2;
  const leyendaEmisor = datoOVacio(input.fiscal?.leyendaEmisor);
  const headerH = 36 + (leyendaEmisor ? 4 : 0);
  const logoSlot = { w: Math.min(52, colLogoW), h: 28 };
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
    const lx = colLogoX + (colLogoW - drawW) / 2;
    const format = logo.dataUrl.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(logo.dataUrl, format, lx, y0, drawW, drawH);
  }

  const letra = letraComprobantePdf(input);
  const tipoLabel = tipoComprobantePdfLabel(input.tipo);
  const boxX = letraCenterX - box / 2;
  const boxY = y0;
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.6);
  doc.rect(boxX, boxY, box, box, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(letra, letraCenterX, boxY + 12.2, { align: "center" });
  doc.setFontSize(7);
  doc.text(tipoLabel, letraCenterX, boxY + box + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  if (nro) {
    doc.setFontSize(9.75);
    doc.text(`N° ${nro}`, letraCenterX, boxY + box + 8, { align: "center" });
    doc.setFontSize(6.5);
  }
  const cbteTipo = input.fiscal?.cbteTipo;
  if (cbteTipo != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(
      `Código Nº ${String(cbteTipo).padStart(3, "0")}`,
      letraCenterX,
      boxY + box + 11.4,
      { align: "center" }
    );
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
        ...(leyendaEmisor ? [{ etiqueta: "COND. IVA", valor: leyendaEmisor }] : []),
      ]
    : [];
  /** FECHA y empresa al borde superior de su columna, alineados al margen derecho. */
  let ey = y0 + 2.6;
  ey = dibujarDatoColumna(
    doc,
    "FECHA",
    fecha,
    colDatosX,
    ey,
    lineH,
    gapEtiquetaDato,
    colDatosW,
    "right"
  );
  for (const row of filasEmpresa) {
    ey = dibujarDatoColumna(
      doc,
      row.etiqueta,
      row.valor,
      colDatosX,
      ey,
      lineH,
      gapEtiquetaDato,
      colDatosW,
      "right"
    );
  }

  return y0 + headerH + 6;
}

function dibujarDatoColumna(
  doc: jsPDF,
  etiqueta: string,
  valor: string,
  x: number,
  ey: number,
  lineH: number,
  gapEtiquetaDato: number,
  maxW: number,
  align: "left" | "right" = "left"
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  const label = `${etiqueta}:`;
  const etiquetaW = doc.getTextWidth(label);
  const valorMaxW = Math.max(12, maxW - etiquetaW - gapEtiquetaDato);
  const rightEdge = x + maxW;
  doc.setFont("helvetica", "normal");
  const split = valor ? doc.splitTextToSize(valor, valorMaxW) : [""];
  const lines = Array.isArray(split) ? split : [split];
  const primera = lines[0] ?? "";
  const primeraW = doc.getTextWidth(primera);
  const totalWPrimera = etiquetaW + gapEtiquetaDato + primeraW;
  const inicioX =
    align === "right" ? Math.max(x, rightEdge - totalWPrimera) : x;
  const valorX = inicioX + etiquetaW + gapEtiquetaDato;
  doc.setFont("helvetica", "bold");
  doc.text(label, inicioX, ey);
  doc.setFont("helvetica", "normal");
  doc.text(primera, valorX, ey);
  let y = ey;
  for (let i = 1; i < lines.length; i += 1) {
    y += lineH;
    const extra = lines[i] ?? "";
    if (align === "right") {
      doc.text(extra, rightEdge, y, { align: "right" });
    } else {
      doc.text(extra, valorX, y);
    }
  }
  return y + lineH;
}
