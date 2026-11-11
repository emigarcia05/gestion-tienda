/**
 * Generación de PDF de comprobante (Factura · Crear) con jsPDF.
 * Cliente o servidor; sin persistencia.
 *
 * Bloques: ENCABEZADO fijo (logo 40 % | letra 20 % | datos empresa 40 %, los tres al borde superior) → CLIENTE → DETALLE → TOTAL.
 */

import { jsPDF } from "jspdf";
import { VWTEXT_BOLD_BASE64, VWTEXT_REGULAR_BASE64 } from "@/lib/vwTextPdfFuente";
import { descripcionConCodColor } from "@/lib/codColorTintometrico";
import {
  esFacturaTipoFiscal,
  esFacturaTipoVenta,
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
import { fmtCantidad, fmtPorcentajeTabla, fmtPrecio } from "@/lib/format";
import {
  formatoCuitPdf,
  type FacturaComprobantePdfEmisor,
  type FacturaComprobantePdfFiscal,
} from "@/lib/facturaComprobantePdfEmisor";
import {
  LEYENDA_A_CONSUMIDOR_FINAL,
  LEYENDA_TRANSPARENCIA_FISCAL,
} from "@/lib/facturaFiscal";
import {
  INSTAGRAM_COMPROBANTE,
  type FacturaComprobantePdfRedes,
  type SucursalPiePdf,
} from "@/lib/facturaComprobantePdfRedes";
import type { LineaFormaPagoPdf } from "@/lib/facturaFormasPagoPdf";

const MARGIN = 14;
/** Recuadro de contacto (Instagram / WhatsApp / sucursal), en mm. */
const PIE_CONTACTO_ALTO = 30;
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
  /** `sucursales.whatsapp` de la sucursal del comprobante. */
  whatsapp?: string | null;
  /** Dirección, Maps y horario de esa sucursal. El QR lo arma el cliente. */
  sucursalPie?: SucursalPiePdf | null;
  /** QR de Instagram y WhatsApp. Lo arma el cliente antes de dibujar. */
  redes?: FacturaComprobantePdfRedes | null;
  /**
   * Formas de pago del descuento ya guardadas en el presupuesto.
   * La vista previa usa `descuento`; la reimpresión usa este texto.
   */
  formasPagoDescuento?: string | null;
  /** Presupuesto: bloque de formas de pago bajo la tabla. */
  formasPagoPresupuesto?: LineaFormaPagoPdf[] | null;
  /** Presupuesto con el interruptor apagado: no imprime formas de pago. */
  ocultarFormasPago?: boolean;
};

/** Recuadro de formas de pago: pie de página, encima del contacto. */
const FORMAS_PAD_X = 2;
const FORMAS_TITULO_H = 7;
const FORMAS_FILA_H = 4.25;
const FORMAS_PAD_ABAJO = 1.25;
const FORMAS_SEP = 1.2;
/** Alto mínimo de un descuento con % para que quepan el número y «Desc.». */
const FORMAS_PCT_MIN = 7.6;
const FORMAS_FONT_TITULO = 7.8;
const FORMAS_FONT_PCT = 8;
/** El número del descuento: 50 % más que `FORMAS_FONT_PCT`. La fila sin % sigue en 8 pt. */
const FORMAS_FONT_NUMERO = 12;
const FORMAS_FONT_DESC = 5.5;
const FORMAS_FONT_TEXTO = 5;
const FORMAS_FONT_TEXTO_MIN = 3.25;
const FORMAS_ETIQUETA_DESC = "Desc.";
const FORMAS_COLS = 3;
const FORMAS_TITULO_CONTACTO = "DATOS DE CONTACTO";

type FilaCajaFormasPago = { pct: string; texto: string; centrada: boolean; inicio: boolean };

type GrupoCajaFormas = { pct: string; centrada: boolean; textos: string[] };

function filasCajaFormasPago(lineas: readonly LineaFormaPagoPdf[]): {
  titulo: string;
  filas: FilaCajaFormasPago[];
} {
  let titulo = "FORMAS DE PAGO";
  const filas: FilaCajaFormasPago[] = [];
  for (const linea of lineas) {
    if (linea.tipo === "titulo" && linea.texto.trim()) {
      titulo = linea.texto.trim();
    } else if (linea.tipo === "grupo") {
      filas.push({ pct: linea.pct.trim(), texto: linea.texto.trim(), centrada: false, inicio: true });
    } else if (linea.tipo === "simple") {
      const texto = linea.texto.replace(/^&\s*/, "").trim();
      if (texto) filas.push({ pct: "", texto, centrada: true, inicio: true });
    } else if (linea.tipo === "grupoSigue" || linea.tipo === "indentada") {
      const texto = linea.texto.replace(/^&\s*/, "").trim();
      if (texto) filas.push({ pct: "", texto, centrada: false, inicio: false });
    }
  }
  return { titulo, filas };
}

function gruposCajaFormasPago(filas: readonly FilaCajaFormasPago[]): GrupoCajaFormas[] {
  const grupos: GrupoCajaFormas[] = [];
  for (const fila of filas) {
    if (fila.inicio || grupos.length === 0) {
      grupos.push({
        pct: fila.pct,
        centrada: fila.centrada,
        textos: fila.texto ? [fila.texto] : [],
      });
      continue;
    }
    const actual = grupos[grupos.length - 1];
    if (actual && fila.texto) actual.textos.push(fila.texto);
  }
  return grupos;
}

function maxOpcionesGrupo(grupos: readonly GrupoCajaFormas[]): number {
  let maximo = 1;
  for (const grupo of grupos) {
    maximo = Math.max(maximo, grupo.centrada ? 1 : Math.max(1, grupo.textos.length));
  }
  return maximo;
}

function altoBandaFormasPago(grupos: readonly GrupoCajaFormas[]): number {
  const hayPct = grupos.some((grupo) => grupo.pct.length > 0);
  return Math.max(hayPct ? FORMAS_PCT_MIN : FORMAS_FILA_H, maxOpcionesGrupo(grupos) * FORMAS_FILA_H);
}

type GrupoCajaUbicado = GrupoCajaFormas & { fila: number; columna: number; altoBanda: number };

function pctGrupoCaja(grupo: GrupoCajaFormas): number | null {
  const n = Number.parseInt(grupo.pct, 10);
  return grupo.pct.length > 0 && Number.isFinite(n) ? n : null;
}

/** Mayor % primero, de izquierda a derecha. Sin % (sin descuento) al final. */
function ordenarGruposCajaFormasPago(grupos: readonly GrupoCajaFormas[]): GrupoCajaFormas[] {
  return grupos
    .map((grupo, indice) => ({ grupo, indice }))
    .sort((a, b) => {
      const pa = pctGrupoCaja(a.grupo);
      const pb = pctGrupoCaja(b.grupo);
      if (pa == null && pb == null) return a.indice - b.indice;
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pa !== pb) return pb - pa;
      return a.indice - b.indice;
    })
    .map((item) => item.grupo);
}

function ubicarGruposCajaFormasPago(filas: readonly FilaCajaFormasPago[]): GrupoCajaUbicado[] {
  const grupos = ordenarGruposCajaFormasPago(gruposCajaFormasPago(filas));
  const altoBanda = altoBandaFormasPago(grupos);
  return grupos.map((grupo, indice) => ({
    ...grupo,
    fila: Math.floor(indice / FORMAS_COLS),
    columna: indice % FORMAS_COLS,
    altoBanda,
  }));
}

function altoFilasCajaFormasPago(filas: readonly FilaCajaFormasPago[]): number {
  const grupos = gruposCajaFormasPago(filas);
  if (grupos.length === 0) return 0;
  const filasGrilla = Math.ceil(grupos.length / FORMAS_COLS);
  return filasGrilla * altoBandaFormasPago(grupos) + Math.max(0, filasGrilla - 1) * FORMAS_SEP;
}

function dibujarCabezalPie(doc: jsPDF, y: number, contentWidth: number, titulo: string): void {
  doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.rect(MARGIN, y, contentWidth, FORMAS_TITULO_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FORMAS_FONT_TITULO);
  const cap = FORMAS_FONT_TITULO * 0.352778 * 0.72;
  doc.text(titulo, MARGIN + contentWidth / 2, y + FORMAS_TITULO_H / 2 + cap / 2, { align: "center" });
}

function altoBloqueFormasPago(lineas: readonly LineaFormaPagoPdf[], _paso: number): number {
  const { filas } = filasCajaFormasPago(lineas);
  if (filas.length === 0) return 0;
  return FORMAS_TITULO_H + altoFilasCajaFormasPago(filas) + FORMAS_PAD_ABAJO;
}

function dibujarBloqueFormasPago(
  doc: jsPDF,
  lineas: readonly LineaFormaPagoPdf[],
  y0: number,
  contentWidth: number,
  _font: number,
  _paso: number,
  sinBordeAbajo = false
): number {
  const { titulo, filas } = filasCajaFormasPago(lineas);
  if (filas.length === 0) return y0;
  const boxY = y0;
  const ubicadas = ubicarGruposCajaFormasPago(filas);
  const altoFilas = altoFilasCajaFormasPago(filas);
  const boxH = FORMAS_TITULO_H + altoFilas + FORMAS_PAD_ABAJO;
  const boxRight = MARGIN + contentWidth;
  const contenidoY = boxY + FORMAS_TITULO_H;

  dibujarCabezalPie(doc, boxY, contentWidth, titulo);

  const colSlot = contentWidth / FORMAS_COLS;
  const filasGrilla = Math.max(1, Math.ceil(ubicadas.length / FORMAS_COLS));
  const altoBanda = ubicadas[0]?.altoBanda ?? FORMAS_FILA_H;

  doc.setFont("VWText", "bold");
  doc.setFontSize(FORMAS_FONT_NUMERO);
  let anchoPct = doc.getTextWidth("100%");
  for (const grupo of ubicadas) {
    if (grupo.pct) anchoPct = Math.max(anchoPct, doc.getTextWidth(grupo.pct));
  }
  doc.setFontSize(FORMAS_FONT_DESC);
  anchoPct = Math.max(anchoPct, doc.getTextWidth(FORMAS_ETIQUETA_DESC));

  doc.setDrawColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, boxY, boxRight, boxY);
  doc.line(MARGIN, boxY, MARGIN, boxY + boxH);
  doc.line(boxRight, boxY, boxRight, boxY + boxH);
  if (!sinBordeAbajo) doc.line(MARGIN, boxY + boxH, boxRight, boxY + boxH);

  doc.setLineWidth(0.2);
  for (let fila = 0; fila < filasGrilla; fila += 1) {
    const yBanda = contenidoY + fila * (altoBanda + FORMAS_SEP);
    if (fila > 0) doc.line(MARGIN, yBanda - FORMAS_SEP / 2, boxRight, yBanda - FORMAS_SEP / 2);
    for (let columna = 1; columna < FORMAS_COLS; columna += 1) {
      const x = MARGIN + columna * colSlot;
      doc.line(x, yBanda, x, yBanda + altoBanda);
    }
  }

  const capNum = FORMAS_FONT_NUMERO * 0.352778 * 0.72;
  const capDesc = FORMAS_FONT_DESC * 0.352778 * 0.72;
  const saltoDesc = 0.5;
  doc.setTextColor(INK.r, INK.g, INK.b);
  for (const grupo of ubicadas) {
    const yBanda = contenidoY + grupo.fila * (altoBanda + FORMAS_SEP);
    const xCol = MARGIN + grupo.columna * colSlot;
    if (grupo.centrada) {
      const texto = grupo.textos.join(" - ");
      if (!texto) continue;
      doc.setFont("VWText", "bold");
      let size = FORMAS_FONT_PCT;
      doc.setFontSize(size);
      const maxTexto = Math.max(8, colSlot - FORMAS_PAD_X * 2);
      while (size > FORMAS_FONT_TEXTO_MIN && doc.getTextWidth(texto) > maxTexto) {
        size -= 0.25;
        doc.setFontSize(size);
      }
      const cap = size * 0.352778 * 0.72;
      doc.text(texto, xCol + colSlot / 2, yBanda + altoBanda / 2 + cap / 2, { align: "center" });
      continue;
    }
    const cantidad = Math.max(1, grupo.textos.length);
    const altoPila = cantidad * FORMAS_FILA_H;
    const altoPar = capNum + saltoDesc + capDesc;
    const altoBloque = Math.max(altoPila, altoPar);
    const centro = yBanda + (altoBanda - altoBloque) / 2 + altoBloque / 2;
    const yPila = centro - altoPila / 2;
    const gap = 3;
    const maxOpcion = Math.max(8, colSlot - FORMAS_PAD_X * 2 - anchoPct - gap);
    doc.setFont("VWText", "normal");
    doc.setFontSize(FORMAS_FONT_TEXTO);
    let anchoTexto = 0;
    for (const texto of grupo.textos) {
      anchoTexto = Math.max(anchoTexto, doc.getTextWidth(texto));
    }
    const anchoUsado = Math.min(anchoTexto, maxOpcion);
    const anchoBloqueX = anchoPct + gap + anchoUsado;
    const xBloque = xCol + Math.max(FORMAS_PAD_X, (colSlot - anchoBloqueX) / 2);
    const xOpcion = xBloque + anchoPct + gap;
    grupo.textos.forEach((texto, indice) => {
      doc.setFont("VWText", "normal");
      let size = FORMAS_FONT_TEXTO;
      doc.setFontSize(size);
      while (size > FORMAS_FONT_TEXTO_MIN && doc.getTextWidth(texto) > maxOpcion) {
        size -= 0.25;
        doc.setFontSize(size);
      }
      const cap = size * 0.352778 * 0.72;
      doc.text(texto, xOpcion, yPila + indice * FORMAS_FILA_H + FORMAS_FILA_H / 2 + cap / 2, {
        align: "left",
      });
    });
    if (!grupo.pct) continue;
    const baselinePct = centro - altoPar / 2 + capNum;
    doc.setFont("VWText", "bold");
    doc.setFontSize(FORMAS_FONT_NUMERO);
    doc.text(grupo.pct, xBloque + anchoPct / 2, baselinePct, { align: "center" });
    doc.setFontSize(FORMAS_FONT_DESC);
    doc.text(FORMAS_ETIQUETA_DESC, xBloque + anchoPct / 2, baselinePct + saltoDesc + capDesc, {
      align: "center",
    });
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "normal");
  return boxY + boxH;
}

function formasPagoDescuentoPdf(input: FacturaComprobantePdfInput): string {
  return input.formasPagoDescuento?.trim() ?? "";
}

function dibujarPieTotales(
  doc: jsPDF,
  input: FacturaComprobantePdfInput,
  resumen: ReturnType<typeof resumenTotalesFactura>,
  yInicio: number,
  contentWidth: number,
  col: {
    cod: number;
    desc: number;
    px: number;
    descPct: number;
    pxDesc: number;
    cant: number;
    total: number;
  },
  yMax: number
): number {
  const totalColCenterX =
    MARGIN +
    col.cod +
    col.desc +
    col.px +
    col.descPct +
    col.pxDesc +
    col.cant +
    col.total / 2;
  const esPresupuesto = input.tipo === "presupuesto";
  const pieConDescuento = esPresupuesto || esFacturaTipoVenta(input.tipo);
  const filas: { etiqueta: string; valor: string }[] = pieConDescuento
    ? [
        { etiqueta: "TOTAL S/ DESC.", valor: `$${fmtPrecio(resumen.totalLista)}` },
        ...(resumen.hayDescuento
          ? [
              {
                etiqueta: `DESC. (${Math.round(resumen.descPctPromedio)}%)`,
                valor: `$${fmtPrecio(resumen.descPesos)}`,
              },
              {
                etiqueta: "TOTAL C/ DESC.",
                valor: `$${fmtPrecio(resumen.totalConDesc)}`,
              },
            ]
          : []),
      ]
    : [
        {
          etiqueta: "TOTAL:",
          valor: `$${fmtPrecio(input.fiscal ? input.fiscal.impTotal : resumen.totalConDesc)}`,
        },
      ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const paso = 4.5;
  const altoFilas = 2.4 + filas.length * paso;
  const anchoValores = Math.max(...filas.map((fila) => doc.getTextWidth(fila.valor)));
  const anchoEtiquetas = Math.max(...filas.map((fila) => doc.getTextWidth(fila.etiqueta)));
  const etiquetaX = totalColCenterX - anchoValores / 2 - 1.2;
  const formas = esPresupuesto && resumen.hayDescuento ? formasPagoDescuentoPdf(input) : "";
  const fontMensaje = 8;
  const pasoMensaje = 3.8;
  const padMensajeX = 2.4;
  const anchoMensaje = Math.max(
    48,
    etiquetaX - anchoEtiquetas - MARGIN - padMensajeX - 4
  );
  let lineasMensaje: string[] = [];
  const etiquetaMensaje = "DESCUENTO VÁLIDO ABONANDO CON:";
  if (formas) {
    doc.setFont("VWText", "normal");
    doc.setFontSize(fontMensaje);
    lineasMensaje = doc.splitTextToSize(formas, anchoMensaje) as string[];
  }
  const altoMensaje = lineasMensaje.length > 0 ? (1 + lineasMensaje.length) * pasoMensaje + 3 : 0;
  const barraH = Math.max(altoFilas, altoMensaje);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  let y = yInicio + 2;
  if (y + barraH > yMax) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFillColor(PRIMARY_SOFT.r, PRIMARY_SOFT.g, PRIMARY_SOFT.b);
  doc.rect(MARGIN, y, contentWidth, barraH, "F");
  doc.setTextColor(INK.r, INK.g, INK.b);
  const yTotales = y + (barraH - filas.length * paso) / 2 + 2.8;
  filas.forEach((fila, idx) => {
    const yy = yTotales + idx * paso;
    doc.text(fila.etiqueta, etiquetaX, yy, { align: "right" });
    doc.text(fila.valor, totalColCenterX, yy, { align: "center" });
  });

  if (lineasMensaje.length > 0) {
    const cap = fontMensaje * 0.352778 * 0.72;
    const altoBloque = (1 + lineasMensaje.length) * pasoMensaje;
    const yMensaje = y + (barraH - altoBloque) / 2 + pasoMensaje / 2 + cap / 2;
    doc.setFont("VWText", "bold");
    doc.setFontSize(fontMensaje);
    doc.text(etiquetaMensaje, MARGIN + padMensajeX, yMensaje);
    doc.setFont("VWText", "normal");
    doc.text(lineasMensaje, MARGIN + padMensajeX, yMensaje + pasoMensaje);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(INK.r, INK.g, INK.b);
  return y + barraH;
}

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
  registrarFuenteVwText(doc);
  const contentWidth = 210 - 2 * MARGIN;
  const lineasFormasPie =
    input.tipo === "presupuesto" && !input.ocultarFormasPago ? (input.formasPagoPresupuesto ?? []) : [];
  const altoFormasPie = altoBloqueFormasPago(lineasFormasPie, 0);
  const unirPies = altoFormasPie > 0 && Boolean(input.redes);
  const altoContactoPie = input.redes ? PIE_CONTACTO_ALTO + (unirPies ? FORMAS_TITULO_H : 0) : 0;
  const zonaPie = altoFormasPie + altoContactoPie;
  const topeCuerpo = 297 - MARGIN - zonaPie - 2;
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
      if (y > topeCuerpo) {
        doc.addPage();
        y = MARGIN;
        drawHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
      }
      const pct = porcentajeDescuentoLinea(linea, pctGlobal);
      const pxDesc = pxConDescuento(linea.pxLista, pct);
      const total = totalLineaConDescuento(linea, pct);
      const descLines = doc.splitTextToSize(
        descripcionConCodColor(linea.descripcion, linea.codColor),
        col.desc - 2
      );
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
      doc.text(fmtCantidad(linea.cantidad), x + col.cant / 2, ty, { align: "center" });
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
  y = dibujarPieTotales(doc, input, resumen, y, contentWidth, col, topeCuerpo);
  if (fiscal?.discriminarIva) {
    const totalColCenterX =
      MARGIN + col.cod + col.desc + col.px + col.descPct + col.pxDesc + col.cant + col.total / 2;
    y = dibujarDiscriminacionIva(doc, fiscal, y, totalColCenterX);
  }

  if (fiscal?.qrDataUrl && input.cae?.trim()) {
    y = dibujarPieFiscal(doc, input, fiscal, y, contentWidth);
  }
  if (zonaPie > 0) {
    const bottom = 297 - MARGIN;
    if (y + 2 + zonaPie > bottom) doc.addPage();
    const contactoY = bottom - altoContactoPie;
    if (altoFormasPie > 0) {
      const formasY = altoContactoPie > 0 ? contactoY - altoFormasPie : bottom - altoFormasPie;
      dibujarBloqueFormasPago(doc, lineasFormasPie, formasY, contentWidth, 0, 0, unirPies);
    }
    if (input.redes) dibujarPieRedes(doc, input.redes, y, contactoY, unirPies);
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
  totalColCenterX: number
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const paso = 4.2;
  const anchoMax = Math.max(...filas.map((fila) => doc.getTextWidth(fila.valor)));
  const etiquetaX = totalColCenterX - anchoMax / 2 - 1.2;
  /** Hueco bajo el pie azul: el texto no entra en el relleno. */
  let y = y0 + 6;
  doc.setTextColor(INK.r, INK.g, INK.b);
  for (const fila of filas) {
    if (y > 272) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.text(fila.etiqueta, etiquetaX, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(fila.valor, totalColCenterX, y, { align: "center" });
    y += paso;
  }
  return y;
}

function registrarFuenteVwText(doc: jsPDF): void {
  doc.addFileToVFS("VWText-Bold.ttf", VWTEXT_BOLD_BASE64);
  doc.addFont("VWText-Bold.ttf", "VWText", "bold");
  doc.addFileToVFS("VWText-Regular.ttf", VWTEXT_REGULAR_BASE64);
  doc.addFont("VWText-Regular.ttf", "VWText", "normal");
}

function dibujarPieRedes(
  doc: jsPDF,
  redes: FacturaComprobantePdfRedes,
  yContenido: number,
  yAnclado?: number,
  conCabezal = false
): void {
  const pageH = 297;
  /** 3 cm de datos; con cabezal, el título va encima y no suma una línea contra formas de pago. */
  const boxH = PIE_CONTACTO_ALTO;
  const altoTotal = boxH + (conCabezal ? FORMAS_TITULO_H : 0);
  const bottom = pageH - MARGIN;
  if (yAnclado == null && yContenido + 4 + altoTotal > bottom) doc.addPage();
  const y = yAnclado ?? bottom - altoTotal;
  const contentWidth = 210 - 2 * MARGIN;
  const colW = contentWidth / 3;
  const boxRight = MARGIN + contentWidth;
  const yCuerpo = y + (conCabezal ? FORMAS_TITULO_H : 0);
  if (conCabezal) dibujarCabezalPie(doc, y, contentWidth, FORMAS_TITULO_CONTACTO);
  doc.setDrawColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.setLineWidth(0.4);
  if (!conCabezal) doc.line(MARGIN, y, boxRight, y);
  doc.line(MARGIN, y, MARGIN, yCuerpo + boxH);
  doc.line(boxRight, y, boxRight, yCuerpo + boxH);
  doc.line(MARGIN, yCuerpo + boxH, boxRight, yCuerpo + boxH);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + colW, yCuerpo, MARGIN + colW, yCuerpo + boxH);
  doc.line(MARGIN + colW * 2, yCuerpo, MARGIN + colW * 2, yCuerpo + boxH);
  const ejes = ejesPieRedes(
    doc,
    yCuerpo,
    boxH,
    colW,
    Boolean(redes.instagramQr),
    Boolean(redes.whatsappQr)
  );
  dibujarColumnaRed(
    doc,
    MARGIN,
    yCuerpo,
    colW,
    boxH,
    redes.instagramQr,
    "instagram",
    "Seguinos en INSTAGRAM",
    INSTAGRAM_COMPROBANTE,
    ejes,
    null
  );
  dibujarColumnaRed(
    doc,
    MARGIN + colW,
    yCuerpo,
    colW,
    boxH,
    redes.whatsappQr,
    "whatsapp",
    "Escribinos por WHATSAPP",
    redes.whatsappTexto,
    ejes,
    redes.whatsappIcono
  );
  dibujarColumnaSucursal(
    doc,
    MARGIN + colW * 2,
    yCuerpo,
    colW,
    boxH,
    redes.mapsQr,
    redes.direccion,
    redes.horario
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
}

const PIE_RED_PAD = 2.5;
const PIE_RED_ICONO = 5;
/** Textos del pie de página: 20 % más que 9 / 11 / 6,5 pt. */
const PIE_RED_ESCALA = 1.2;
const PIE_RED_TITULO = 9 * PIE_RED_ESCALA;
const PIE_RED_VALOR = 11 * PIE_RED_ESCALA;
const PIE_RED_VALOR_MIN = 6 * PIE_RED_ESCALA;
const PIE_RED_SUCURSAL = 6.5 * PIE_RED_ESCALA;
const PIE_RED_SUCURSAL_MIN = 4.5 * PIE_RED_ESCALA;
const PIE_RED_LINEA = 3.6 * PIE_RED_ESCALA;

type EjesPieRed = {
  iconCy: number;
  tituloY: number;
  valorY: number;
};

/** Ícono, título y valor de las dos columnas comparten el mismo eje horizontal. */
function ejesPieRedes(
  doc: jsPDF,
  y: number,
  alto: number,
  ancho: number,
  instagramTieneQr: boolean,
  whatsappTieneQr: boolean
): EjesPieRed {
  const igW = anchoTextoRed(ancho, alto, instagramTieneQr);
  const waW = anchoTextoRed(ancho, alto, whatsappTieneQr);
  doc.setFont("VWText", "bold");
  doc.setFontSize(PIE_RED_TITULO);
  const lineas = Math.max(
    doc.splitTextToSize("Seguinos en INSTAGRAM", igW).length,
    doc.splitTextToSize("Escribinos por WHATSAPP", waW).length,
    1
  );
  const tituloAlto = lineas * PIE_RED_LINEA;
  const gap = 1.6;
  const valorAlto = 4.2 * PIE_RED_ESCALA;
  const bloque = PIE_RED_ICONO + gap + tituloAlto + gap + valorAlto;
  const top = y + (alto - bloque) / 2;
  return {
    iconCy: top + PIE_RED_ICONO / 2,
    tituloY: top + PIE_RED_ICONO + gap + 3.1 * PIE_RED_ESCALA,
    valorY: top + PIE_RED_ICONO + gap + tituloAlto + gap + 3.2 * PIE_RED_ESCALA,
  };
}

/** Mismo cuadrado en Instagram, WhatsApp y Maps. */
function tamanoQrPie(alto: number): number {
  return Math.min(24, alto - PIE_RED_PAD * 2);
}

function anchoTextoRed(ancho: number, alto: number, tieneQr: boolean): number {
  const qrSize = tieneQr ? tamanoQrPie(alto) : 0;
  const usado = PIE_RED_PAD + (tieneQr ? qrSize + 2.5 : 0);
  return Math.max(16, ancho - usado - PIE_RED_PAD);
}

function dibujarColumnaRed(
  doc: jsPDF,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  qr: string | null,
  red: "instagram" | "whatsapp",
  titulo: string,
  detalle: string | null,
  ejes: EjesPieRed,
  iconoWhatsapp: string | null
): void {
  const qrSize = qr ? tamanoQrPie(alto) : 0;
  if (qr) {
    doc.addImage(qr, "PNG", x + PIE_RED_PAD, y + (alto - qrSize) / 2, qrSize, qrSize);
  }
  const textX = x + PIE_RED_PAD + (qr ? qrSize + 2.5 : 0);
  const textW = Math.max(16, ancho - (textX - x) - PIE_RED_PAD);
  const centro = textX + textW / 2;
  if (red === "instagram") dibujarIconoInstagram(doc, centro, ejes.iconCy, PIE_RED_ICONO);
  else if (iconoWhatsapp) {
    doc.addImage(
      iconoWhatsapp,
      "PNG",
      centro - PIE_RED_ICONO / 2,
      ejes.iconCy - PIE_RED_ICONO / 2,
      PIE_RED_ICONO,
      PIE_RED_ICONO
    );
  }
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("VWText", "bold");
  doc.setFontSize(PIE_RED_TITULO);
  const tituloLineas = doc.splitTextToSize(titulo, textW);
  doc.text(tituloLineas, centro, ejes.tituloY, { align: "center" });
  if (detalle) {
    doc.setFont("VWText", "normal");
    doc.setFontSize(tamanoUnaLinea(doc, detalle, textW, PIE_RED_VALOR, PIE_RED_VALOR_MIN));
    doc.text(detalle, centro, ejes.valorY, { align: "center" });
  }
}

/** Baja el cuerpo hasta que el texto entra en una sola fila. */
function tamanoUnaLinea(
  doc: jsPDF,
  texto: string,
  ancho: number,
  inicial: number,
  minimo = 6
): number {
  let size = inicial;
  doc.setFont("VWText", "normal");
  while (size > minimo) {
    doc.setFontSize(size);
    if (doc.getTextWidth(texto) <= ancho) return size;
    size -= 0.25;
  }
  return minimo;
}

/** Tercera columna: QR de Maps a la izquierda; dirección y horarios centrados a la derecha. */
function dibujarColumnaSucursal(
  doc: jsPDF,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  qr: string | null,
  direccion: string | null,
  horario: string | null
): void {
  const qrSize = qr ? tamanoQrPie(alto) : 0;
  if (qr) {
    doc.addImage(qr, "PNG", x + PIE_RED_PAD, y + (alto - qrSize) / 2, qrSize, qrSize);
  }
  const textX = x + PIE_RED_PAD + (qr ? qrSize + 2.5 : 0);
  const textW = Math.max(14, ancho - (textX - x) - PIE_RED_PAD);
  const centro = textX + textW / 2;
  doc.setTextColor(INK.r, INK.g, INK.b);

  const direccionTexto = (direccion ?? "").trim();
  doc.setFont("VWText", "normal");
  doc.setFontSize(PIE_RED_SUCURSAL);
  const lineasDireccion = direccionTexto
    ? (doc.splitTextToSize(direccionTexto, textW) as string[]).slice(0, 3)
    : [];
  const dias = (horario ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);
  const fontDia =
    dias.length > 0
      ? Math.min(
          ...dias.map((dia) => tamanoUnaLinea(doc, dia, textW, PIE_RED_SUCURSAL, PIE_RED_SUCURSAL_MIN))
        )
      : PIE_RED_SUCURSAL;

  const altoLabel = 3.2 * PIE_RED_ESCALA;
  const altoLinea = 2.7 * PIE_RED_ESCALA;
  const gap = 1.5;
  let altoBloque = 0;
  if (lineasDireccion.length > 0) {
    altoBloque += altoLabel + lineasDireccion.length * altoLinea;
  }
  if (dias.length > 0) {
    if (altoBloque > 0) altoBloque += gap;
    altoBloque += altoLabel + dias.length * altoLinea;
  }
  if (altoBloque === 0) return;

  let cursor = y + Math.max(3.2 * PIE_RED_ESCALA, (alto - altoBloque) / 2) + 2.2 * PIE_RED_ESCALA;
  const label = (titulo: string) => {
    doc.setFont("VWText", "bold");
    doc.setFontSize(PIE_RED_SUCURSAL);
    doc.text(titulo, centro, cursor, { align: "center" });
    cursor += altoLabel;
  };
  if (lineasDireccion.length > 0) {
    label("DIRECCIÓN");
    doc.setFont("VWText", "normal");
    doc.setFontSize(PIE_RED_SUCURSAL);
    for (const linea of lineasDireccion) {
      doc.text(linea, centro, cursor, { align: "center" });
      cursor += altoLinea;
    }
  }
  if (dias.length > 0) {
    if (lineasDireccion.length > 0) cursor += gap;
    label("HORARIOS");
    doc.setFont("VWText", "normal");
    doc.setFontSize(fontDia);
    for (const dia of dias) {
      doc.text(dia, centro, cursor, { align: "center" });
      cursor += altoLinea;
    }
  }
}

function dibujarIconoInstagram(doc: jsPDF, cx: number, cy: number, size: number): void {
  const x = cx - size / 2;
  const y = cy - size / 2;
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setFillColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, size, size, size * 0.22, size * 0.22);
  doc.circle(cx, cy + size * 0.04, size * 0.22);
  doc.circle(cx + size * 0.28, cy - size * 0.26, size * 0.07, "F");
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
