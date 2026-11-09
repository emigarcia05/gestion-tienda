/**
 * Bloque FORMAS DE PAGO del PDF de presupuesto.
 * Cada fila sale del catálogo escrito en Cobros & Desc.: DESC. | formas.
 */

export type LineaFormaPagoPdf =
  | { tipo: "titulo"; texto: string }
  | { tipo: "indentada"; texto: string }
  | { tipo: "simple"; texto: string }
  | { tipo: "grupo"; pct: string; texto: string }
  | { tipo: "grupoSigue"; texto: string }
  | { tipo: "vacia" };

const TITULO_TODAS = "FORMAS DE PAGO";

export type FilaFormaPagoPresupuestoPdf = {
  descuento: number;
  formas: readonly { nombre: string; cuotas: readonly { nombre: string }[] }[];
};

/** Formas sin cuotas por su nombre; las que tienen, por cada cuota elegida. */
export function textoFormasPagoPresupuesto(
  formas: readonly { nombre: string; cuotas: readonly { nombre: string }[] }[]
): string {
  const partes: string[] = [];
  for (const forma of formas) {
    const nombre = forma.nombre.trim();
    if (forma.cuotas.length === 0) {
      if (nombre) partes.push(nombre);
      continue;
    }
    for (const cuota of forma.cuotas) {
      const texto = cuota.nombre.trim();
      if (!texto) continue;
      partes.push(nombre ? `${nombre} · ${texto}` : texto);
    }
  }
  return partes.join(" - ");
}

export function lineasDesdeTextosFormasPagoPresupuesto(
  filas: readonly FilaFormaPagoPresupuestoPdf[]
): LineaFormaPagoPdf[] {
  const utiles = filas.flatMap((fila) => {
    const texto = textoFormasPagoPresupuesto(fila.formas);
    if (!texto) return [];
    return [{ tipo: "grupo" as const, pct: `${fila.descuento}%`, texto }];
  });
  if (utiles.length === 0) return [];
  return [{ tipo: "titulo", texto: TITULO_TODAS }, { tipo: "vacia" }, ...utiles];
}

export function serializarLineasFormasPagoPdf(lineas: readonly LineaFormaPagoPdf[]): string | null {
  if (lineas.length === 0) return null;
  return JSON.stringify(lineas);
}

export function parsearLineasFormasPagoPdf(raw: string | null | undefined): LineaFormaPagoPdf[] | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const lineas: LineaFormaPagoPdf[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") return null;
      const tipo = "tipo" in item ? item.tipo : null;
      if (tipo === "vacia") {
        lineas.push({ tipo: "vacia" });
        continue;
      }
      if (tipo === "grupoSigue" && "texto" in item && typeof item.texto === "string") {
        lineas.push({ tipo: "grupoSigue", texto: item.texto });
        continue;
      }
      if (
        (tipo === "titulo" || tipo === "indentada" || tipo === "simple") &&
        "texto" in item &&
        typeof item.texto === "string"
      ) {
        lineas.push({ tipo, texto: item.texto });
        continue;
      }
      if (tipo === "grupo" && "pct" in item && "texto" in item && typeof item.pct === "string" && typeof item.texto === "string") {
        lineas.push({ tipo: "grupo", pct: item.pct, texto: item.texto });
        continue;
      }
      return null;
    }
    return lineas.length > 0 ? lineas : null;
  } catch {
    return null;
  }
}
