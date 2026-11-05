/**
 * PDF de los productos de tienda cuyo costo de compra cambió en la importación.
 * Sección 1: promedio por marca y rubro. La marca y el rubro enlazan a la sección 2.
 * Sección 2: ítems agrupados por marca y, dentro, por rubro.
 */
import { jsPDF } from "jspdf";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";

export interface AumentoImportListaPdfItem {
  marca: string;
  rubro: string;
  descripcion: string;
  aumentoPct: number;
}

export interface ResumenAumentosImportListaPdf {
  proveedor: string;
  items: AumentoImportListaPdfItem[];
}

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PRIMARY = { r: 0, g: 114, b: 187 };
const ROW_ALT = { r: 244, g: 248, b: 252 };
const INK = { r: 17, g: 17, b: 17 };

type DestinoPdf = { page: number; y: number };
type ZonaEnlacePdf = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  marca: string;
  /** `null`: el clic abre la marca. Con rubro: abre esa marca y ese rubro. */
  rubro: string | null;
};

function claveRubro(marca: string, rubro: string): string {
  return `${marca}\u0000${rubro}`;
}

function fmtAumento(pct: number): string {
  return `${pct.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function promedio(items: readonly { aumentoPct: number }[]): number {
  const suma = items.reduce((acc, item) => acc + item.aumentoPct, 0);
  return Math.round((suma / items.length) * 100) / 100;
}

export function generarPdfResumenAumentosImport(resumen: ResumenAumentosImportListaPdf): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;

  function asegurar(alto: number) {
    if (y + alto <= PAGE_H - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  }

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RESUMEN DE CAMBIOS DE COSTO", PAGE_W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(resumen.proveedor.toLocaleUpperCase("es"), PAGE_W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(formatDdMmHhMmArgentina(new Date()), PAGE_W / 2, y, { align: "center" });
  y += 5;
  doc.text("Costo de compra (precio final sin IVA).", PAGE_W / 2, y, { align: "center" });
  y += 8;

  const porMarcaRubro = new Map<string, Map<string, AumentoImportListaPdfItem[]>>();
  for (const item of resumen.items) {
    const rubros = porMarcaRubro.get(item.marca) ?? new Map<string, AumentoImportListaPdfItem[]>();
    const lista = rubros.get(item.rubro) ?? [];
    lista.push(item);
    rubros.set(item.rubro, lista);
    porMarcaRubro.set(item.marca, rubros);
  }
  const marcas = [...porMarcaRubro.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const zonas: ZonaEnlacePdf[] = [];
  const destMarca = new Map<string, DestinoPdf>();
  const destRubro = new Map<string, DestinoPdf>();

  function subrayar(texto: string, x: number, baseline: number, maxW: number) {
    const ancho = Math.min(doc.getTextWidth(texto), maxW);
    if (!(ancho > 0)) return;
    doc.setDrawColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    doc.setLineWidth(0.2);
    doc.line(x, baseline + 0.7, x + ancho, baseline + 0.7);
  }

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  asegurar(10);
  doc.text("1. PROMEDIO POR MARCA Y RUBRO", MARGIN, y);
  y += 6;

  if (marcas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("SIN CAMBIOS DE COSTO.", MARGIN, y);
    y += 8;
  } else {
    const wMarca = 70;
    const wRubro = 78;
    const wAum = CONTENT_W - wMarca - wRubro;
    const altoFila = 7;

    asegurar(altoFila);
    doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    doc.rect(MARGIN, y - 5, CONTENT_W, altoFila, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("MARCA", MARGIN + 2, y);
    doc.text("RUBRO", MARGIN + wMarca + 2, y);
    doc.text("VARIACIÓN PROMEDIO", MARGIN + wMarca + wRubro + wAum - 2, y, { align: "right" });
    y += altoFila - 1;
    doc.setTextColor(INK.r, INK.g, INK.b);

    let fila = 0;
    for (const marca of marcas) {
      const rubros = [...(porMarcaRubro.get(marca)?.entries() ?? [])].sort((a, b) =>
        a[0].localeCompare(b[0], "es")
      );
      rubros.forEach(([rubro, items], indice) => {
        asegurar(altoFila);
        if (fila % 2 === 0) {
          doc.setFillColor(ROW_ALT.r, ROW_ALT.g, ROW_ALT.b);
          doc.rect(MARGIN, y - 4.5, CONTENT_W, altoFila, "F");
        }
        const filaTop = y - 4.5;
        const paginaFila = doc.getCurrentPageInfo().pageNumber;
        doc.setFont("helvetica", indice === 0 ? "bold" : "normal");
        doc.setFontSize(8);
        if (indice === 0) {
          doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
          doc.text(marca, MARGIN + 2, y, { maxWidth: wMarca - 4 });
          subrayar(marca, MARGIN + 2, y, wMarca - 4);
          zonas.push({
            page: paginaFila,
            x: MARGIN,
            y: filaTop,
            w: wMarca,
            h: altoFila,
            marca,
            rubro: null,
          });
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
        doc.text(rubro, MARGIN + wMarca + 2, y, { maxWidth: wRubro - 4 });
        subrayar(rubro, MARGIN + wMarca + 2, y, wRubro - 4);
        zonas.push({
          page: paginaFila,
          x: MARGIN + wMarca,
          y: filaTop,
          w: wRubro,
          h: altoFila,
          marca,
          rubro,
        });
        doc.setTextColor(INK.r, INK.g, INK.b);
        doc.text(fmtAumento(promedio(items)), MARGIN + CONTENT_W - 2, y, { align: "right" });
        y += altoFila;
        fila += 1;
      });
    }
    y += 6;
  }

  asegurar(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("2. VARIACIÓN POR ÍTEM", MARGIN, y);
  y += 7;

  if (marcas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("SIN CAMBIOS DE COSTO.", MARGIN, y);
  } else {
    for (const marca of marcas) {
      const rubros = [...(porMarcaRubro.get(marca)?.entries() ?? [])].sort((a, b) =>
        a[0].localeCompare(b[0], "es")
      );
      asegurar(8);
      destMarca.set(marca, { page: doc.getCurrentPageInfo().pageNumber, y: y - 4 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(INK.r, INK.g, INK.b);
      doc.text(marca, MARGIN, y);
      y += 5;
      for (const [rubro, items] of rubros) {
        const ordenados = [...items].sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));
        asegurar(6);
        destRubro.set(claveRubro(marca, rubro), {
          page: doc.getCurrentPageInfo().pageNumber,
          y: y - 3.5,
        });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(rubro, MARGIN + 3, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        for (const item of ordenados) {
          const lineas = doc.splitTextToSize(item.descripcion, CONTENT_W - 32) as string[];
          const alto = Math.max(5, lineas.length * 4);
          asegurar(alto);
          doc.text(lineas, MARGIN + 6, y);
          doc.text(fmtAumento(item.aumentoPct), MARGIN + CONTENT_W, y, { align: "right" });
          y += alto;
        }
        y += 2;
      }
      y += 2;
    }
  }

  for (const zona of zonas) {
    const dest =
      zona.rubro == null ? destMarca.get(zona.marca) : destRubro.get(claveRubro(zona.marca, zona.rubro));
    if (!dest) continue;
    doc.setPage(zona.page);
    doc.link(zona.x, zona.y, zona.w, zona.h, { pageNumber: dest.page, top: dest.y });
  }

  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf instanceof ArrayBuffer ? buf : (buf as unknown as ArrayBuffer));
}
