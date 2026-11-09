/**
 * Bloque FORMAS DE PAGO del PDF de presupuesto.
 * Cada descuento con MOSTRAR EN PRESUPUESTO agrupa sus formas: el % va en la primera y las siguientes quedan debajo.
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
  formas: readonly string[];
};

export function lineasDesdeTextosFormasPagoPresupuesto(
  filas: readonly FilaFormaPagoPresupuestoPdf[]
): LineaFormaPagoPdf[] {
  const utiles = filas.flatMap((fila) => {
    const textos = fila.formas.map((forma) => forma.trim()).filter((forma) => forma.length > 0);
    return textos.map((texto, indice) =>
      indice === 0
        ? { tipo: "grupo" as const, pct: `${fila.descuento}%`, texto }
        : { tipo: "grupoSigue" as const, texto }
    );
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
