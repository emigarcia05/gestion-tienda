/**
 * Bloque FORMAS DE PAGO del PDF de presupuesto.
 * Con un descuento atado a medios: válidas y, debajo, las demás.
 * Sin ese descuento: todas, agrupadas por %.
 */

export type OfertaFormaPagoPresupuesto = {
  clave: string;
  pagoId: string;
  cuotaId: string | null;
  etiqueta: string;
  esCuota: boolean;
  descuento: number;
};

export type VinculoFormaPagoPresupuesto = {
  pagoId: string;
  nombre: string;
  cuotaId?: string | null;
  cuotaEtiqueta?: string | null;
};

export type LineaFormaPagoPdf =
  | { tipo: "titulo"; texto: string }
  | { tipo: "indentada"; texto: string }
  | { tipo: "simple"; texto: string }
  | { tipo: "grupo"; pct: string; texto: string }
  | { tipo: "grupoSigue"; texto: string }
  | { tipo: "vacia" };

const TITULO_VALIDO = "DESCUENTO VÁLIDO ABONANDO CON:";
const TITULO_OTRAS = "OTRAS FORMAS DE PAGO";
const TITULO_TODAS = "FORMAS DE PAGO";

function mayus(valor: string): string {
  return valor.trim().toLocaleUpperCase("es-AR");
}

function pctEntero(descuento: number): string {
  return `${Math.round(descuento)}% DESCUENTO`;
}

function ordenarEtiquetas(ofertas: readonly OfertaFormaPagoPresupuesto[]): OfertaFormaPagoPresupuesto[] {
  return ofertas.slice().sort((a, b) => {
    const na = Number.parseInt(a.etiqueta, 10);
    const nb = Number.parseInt(b.etiqueta, 10);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    if (aNum !== bNum) return aNum ? -1 : 1;
    return a.etiqueta.localeCompare(b.etiqueta, "es");
  });
}

function lineasDeGrupo(descuento: number, ofertas: readonly OfertaFormaPagoPresupuesto[]): LineaFormaPagoPdf[] {
  const orden = ordenarEtiquetas(ofertas);
  const sinCuota = orden.filter((o) => !o.esCuota).map((o) => o.etiqueta);
  const conCuota = orden.filter((o) => o.esCuota).map((o) => o.etiqueta);
  if (descuento <= 0) {
    return [...sinCuota, ...conCuota].map((texto) => ({ tipo: "simple" as const, texto }));
  }
  const pct = pctEntero(descuento);
  const lineas: LineaFormaPagoPdf[] = [];
  if (sinCuota.length > 0) {
    lineas.push({ tipo: "grupo", pct, texto: sinCuota.join(" - ") });
    for (const cuota of conCuota) {
      lineas.push({ tipo: "grupoSigue", texto: `& ${cuota}` });
    }
    return lineas;
  }
  const [primera, ...resto] = conCuota;
  if (!primera) return lineas;
  lineas.push({ tipo: "grupo", pct, texto: `& ${primera}` });
  for (const cuota of resto) {
    lineas.push({ tipo: "grupoSigue", texto: `& ${cuota}` });
  }
  return lineas;
}

function lineasCatalogo(ofertas: readonly OfertaFormaPagoPresupuesto[]): LineaFormaPagoPdf[] {
  if (ofertas.length === 0) return [];
  const porPct = new Map<number, OfertaFormaPagoPresupuesto[]>();
  for (const oferta of ofertas) {
    const pct = Math.round(oferta.descuento);
    const actual = porPct.get(pct);
    if (actual) actual.push(oferta);
    else porPct.set(pct, [oferta]);
  }
  const grupos = [...porPct.entries()].sort((a, b) => b[0] - a[0]);
  const lineas: LineaFormaPagoPdf[] = [{ tipo: "titulo", texto: TITULO_TODAS }, { tipo: "vacia" }];
  for (const [pct, filas] of grupos) {
    lineas.push(...lineasDeGrupo(pct, filas));
  }
  return lineas;
}

function etiquetaVinculo(vinculo: VinculoFormaPagoPresupuesto): { texto: string; esCuota: boolean } {
  const cuota = mayus(vinculo.cuotaEtiqueta ?? "");
  if (cuota) return { texto: cuota, esCuota: true };
  return { texto: mayus(vinculo.nombre), esCuota: false };
}

export function lineasFormasPagoPresupuestoPdf(args: {
  ofertas: readonly OfertaFormaPagoPresupuesto[];
  hayDescuento: boolean;
  vinculos: readonly VinculoFormaPagoPresupuesto[];
}): LineaFormaPagoPdf[] {
  const validas = new Set(args.vinculos.map((v) => `${v.pagoId}:${v.cuotaId ?? ""}`));
  if (!args.hayDescuento || validas.size === 0) {
    return lineasCatalogo(args.ofertas);
  }

  const vistas = args.vinculos.map(etiquetaVinculo).filter((v) => v.texto);
  const sinCuota = vistas.filter((v) => !v.esCuota).map((v) => v.texto);
  const conCuota = vistas.filter((v) => v.esCuota).map((v) => v.texto);
  const lineas: LineaFormaPagoPdf[] = [{ tipo: "titulo", texto: TITULO_VALIDO }];
  if (sinCuota.length > 0) {
    lineas.push({ tipo: "indentada", texto: sinCuota.join(" - ") });
  }
  for (const cuota of conCuota) {
    lineas.push({ tipo: "indentada", texto: cuota });
  }

  const otras = args.ofertas.filter((o) => !validas.has(o.clave));
  if (otras.length === 0) return lineas;

  lineas.push({ tipo: "vacia" }, { tipo: "titulo", texto: TITULO_OTRAS });
  const orden = otras.slice().sort((a, b) => b.descuento - a.descuento || a.etiqueta.localeCompare(b.etiqueta, "es"));
  for (const oferta of orden) {
    const pct = Math.round(oferta.descuento);
    lineas.push({
      tipo: "simple",
      texto: pct > 0 ? `${oferta.etiqueta} & ${pct}% DESCUENTO` : oferta.etiqueta,
    });
  }
  return lineas;
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
