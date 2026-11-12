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

/** Nº del comprobante, sin punto de venta y con al menos 2 dígitos. */
export function nroPresupuestoMensaje(nroComprobante: string): string {
  const parte = nroComprobante.includes("-")
    ? nroComprobante.slice(nroComprobante.lastIndexOf("-") + 1)
    : nroComprobante;
  const digits = parte.replace(/\D/g, "").replace(/^0+/, "") || "0";
  return digits.padStart(2, "0");
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

function bloqueConDescuento(pct: number, medios: readonly string[], total: number): string[] {
  const formas = unicos(medios);
  if (formas.length === 0) return [];
  return [
    `${pct}% de descuento abonando con ${formas.join(" / ")}`,
    `Total con descuento ${pesosMensaje(total * (1 - pct / 100))}`,
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
  const otros: string[] = [];

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
      else otros.push(linea);
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
      "Cuotas sin interés",
      ...cuotasOrden.map((cuota) => `${cuota} Cuotas de ${pesosMensaje(input.total / cuota)}`),
    ]);
  }
  const sueltos = unicos(otros);
  if (sueltos.length > 0) bloques.push(sueltos);

  const cabeza = [
    `El presupuesto Nº${nroPresupuestoMensaje(input.nroComprobante)} tiene un valor final de ${pesosMensaje(input.total)}`,
    "Las formas de pago son las siguientes",
  ];
  if (bloques.length === 0) return cabeza.join("\n");
  return [cabeza.join("\n"), ...bloques.map((bloque) => bloque.join("\n"))].join("\n\n");
}
