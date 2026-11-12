import { fmtPrecio } from "@/lib/format";

/** Un descuento con SE MUESTRA EN PRESUPUESTOS, tal como está en Descuentos. */
export type DescuentoMensajePresupuesto = {
  descuento: number;
  /** Líneas de DESCUENTO VÁLIDO ABONANDO CON. */
  abonandoCon: readonly string[];
  /** Líneas de FORMA DE PAGO EN PRESUPUESTO. */
  lineasFormaPago: readonly string[];
  /** CANT. CUOTAS mayor a 1. Solo se usa cuando el descuento es 0. */
  cuotas: readonly number[];
};

/** Nº del comprobante, sin punto de venta y con al menos 3 dígitos. */
export function nroPresupuestoMensaje(nroComprobante: string): string {
  const parte = nroComprobante.includes("-")
    ? nroComprobante.slice(nroComprobante.lastIndexOf("-") + 1)
    : nroComprobante;
  const digits = parte.replace(/\D/g, "").replace(/^0+/, "") || "0";
  return digits.padStart(3, "0");
}

function pesosMensaje(n: number): string {
  const redondo = Math.round(n * 100) / 100;
  if (Math.abs(redondo - Math.round(redondo)) < 0.001) return `$${fmtPrecio(redondo)}`;
  return `$${redondo.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function textos(lineas: readonly string[]): string[] {
  return lineas.map((linea) => linea.trim()).filter((linea) => linea.length > 0);
}

function unicos(lineas: readonly string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const linea of lineas) {
    const clave = linea.toLocaleUpperCase("es-AR");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(linea);
  }
  return out;
}

function cuotasEnTexto(linea: string): number | null {
  const match = /(\d+)\s*cuotas?\b/i.exec(linea);
  const n = match ? Number.parseInt(match[1] ?? "", 10) : NaN;
  return Number.isFinite(n) && n > 1 ? n : null;
}

/** «EFECTIVO, TRANSFERENCIA O DÉBITO». */
function listaO(medios: readonly string[]): string {
  const formas = unicos(medios).map((medio) => medio.toLocaleUpperCase("es-AR"));
  if (formas.length <= 1) return formas[0] ?? "";
  if (formas.length === 2) return `${formas[0]} O ${formas[1]}`;
  return `${formas.slice(0, -1).join(", ")} O ${formas[formas.length - 1]}`;
}

function bloqueConDescuento(pct: number, medios: readonly string[], total: number): string[] {
  const formas = listaO(medios);
  if (!formas) return [];
  const conDescuento = total * (1 - pct / 100);
  return [
    `PAGANDO EN ${formas} TENÉS UN ${pct}% DE DESCUENTO:`,
    `➡️ *${pesosMensaje(conDescuento)}*`,
  ];
}

/** Texto para WhatsApp a partir del total del presupuesto y los descuentos que se muestran. */
export function mensajeWhatsappPresupuesto(input: {
  nroComprobante: string;
  total: number;
  descuentos: readonly DescuentoMensajePresupuesto[];
}): string {
  const porPct = new Map<number, { abonando: string[]; lineas: string[] }>();
  const cuotas = new Set<number>();

  for (const descuento of input.descuentos) {
    if (descuento.descuento > 0) {
      const actual = porPct.get(descuento.descuento) ?? { abonando: [], lineas: [] };
      actual.abonando.push(...textos(descuento.abonandoCon));
      actual.lineas.push(...textos(descuento.lineasFormaPago));
      porPct.set(descuento.descuento, actual);
      continue;
    }
    const propias = descuento.cuotas.filter((cuota) => cuota > 1);
    for (const cuota of propias) cuotas.add(cuota);
    if (propias.length > 0) continue;
    for (const linea of textos(descuento.lineasFormaPago)) {
      const cuota = cuotasEnTexto(linea);
      if (cuota != null) cuotas.add(cuota);
    }
  }

  const bloques: string[][] = [];
  for (const pct of [...porPct.keys()].sort((a, b) => b - a)) {
    const grupo = porPct.get(pct);
    if (!grupo) continue;
    const bloque = bloqueConDescuento(
      pct,
      grupo.abonando.length > 0 ? grupo.abonando : grupo.lineas,
      input.total
    );
    if (bloque.length > 0) bloques.push(bloque);
  }
  const cuotasOrden = [...cuotas].sort((a, b) => a - b);
  if (cuotasOrden.length > 0) {
    bloques.push([
      "PAGANDO EN CUOTAS:",
      ...cuotasOrden.map(
        (cuota) => `➡️ ${cuota} cuotas sin interés de *${pesosMensaje(input.total / cuota)}*`
      ),
    ]);
  }

  const partes = [
    `PRESUPUESTO N° ${nroPresupuestoMensaje(input.nroComprobante)}`,
    `💰 *TOTAL: ${pesosMensaje(input.total)}*`,
    ...bloques.map((bloque) => bloque.join("\n")),
  ];
  return partes.join("\n\n");
}
