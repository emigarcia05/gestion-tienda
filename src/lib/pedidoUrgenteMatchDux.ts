/**
 * Match lista de proveedor ↔ `prod_tienda` para Pedido Urgente.
 * No persiste `cod_tienda`: solo clasifica **Registrados en Dux**.
 */

const STOP_TOKENS = new Set(["DE", "LA", "EL", "LOS", "LAS", "Y", "EN", "PARA", "CON", "X"]);

const UNIDADES = new Set(["LT", "KG", "CC", "ML"]);

export type ProdTiendaMatchDux = {
  codTienda: string;
  descripcionTienda: string;
};

type CandidatoTiendaDux = {
  codTienda: string;
  descripcionTienda: string;
  tokens: Set<string>;
};

export type IndiceMatchDuxPedidoUrgente = {
  porCodTienda: Map<string, ProdTiendaMatchDux>;
  porCostoCodExt: Map<string, ProdTiendaMatchDux>;
  porFirma: Map<string, ProdTiendaMatchDux | "AMB">;
  porPresentacion: Map<string, CandidatoTiendaDux[]>;
};

export function tokensDescProductoDux(descripcion: string): string[] {
  const n = descripcion
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/EXT\s*[-/.]\s*INT/g, "EXT INT")
    .replace(/\bLTS\b|\bLITROS?\b/g, "LT")
    .replace(/\bKGS\b|\bKILOS?\b/g, "KG")
    .replace(/\bX(?=\d)/g, " ")
    .replace(/(\d+)(LT|KG|CC|ML)\b/g, "$1 $2")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return [];
  return n.split(" ").filter((t) => t.length > 0 && !STOP_TOKENS.has(t));
}

export function firmaDescProductoDux(descripcion: string): string {
  return [...new Set(tokensDescProductoDux(descripcion))].sort().join(" ");
}

function clavePresentacion(tokens: Iterable<string>): string {
  const toks = [...tokens];
  const nums = toks.filter((t) => /^\d+$/.test(t)).sort((a, b) => Number(a) - Number(b));
  const units = toks.filter((t) => UNIDADES.has(t)).sort();
  return `${nums.join(",")}|${units.join(",")}`;
}

function esSubconjunto(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) {
    if (!b.has(t)) return false;
  }
  return true;
}

export function construirIndiceMatchDuxPedidoUrgente(
  catalogo: Array<{
    codTienda: string;
    descripcionTienda: string | null;
    costoCompraCodExt: string | null;
  }>
): IndiceMatchDuxPedidoUrgente {
  const porCodTienda = new Map<string, ProdTiendaMatchDux>();
  const porCostoCodExt = new Map<string, ProdTiendaMatchDux>();
  const porFirma = new Map<string, ProdTiendaMatchDux | "AMB">();
  const porPresentacion = new Map<string, CandidatoTiendaDux[]>();

  for (const row of catalogo) {
    const codTienda = row.codTienda.trim();
    if (!codTienda) continue;
    const descripcionTienda = (row.descripcionTienda ?? "").trim();
    const hit: ProdTiendaMatchDux = { codTienda, descripcionTienda };
    porCodTienda.set(codTienda, hit);

    const costo = row.costoCompraCodExt?.trim();
    if (costo && !porCostoCodExt.has(costo)) {
      porCostoCodExt.set(costo, hit);
    }

    if (!descripcionTienda) continue;
    const tokens = new Set(tokensDescProductoDux(descripcionTienda));
    if (tokens.size === 0) continue;
    const firma = [...tokens].sort().join(" ");
    const prev = porFirma.get(firma);
    if (prev == null) {
      porFirma.set(firma, hit);
    } else if (prev !== "AMB" && prev.codTienda !== codTienda) {
      porFirma.set(firma, "AMB");
    }

    const clave = clavePresentacion(tokens);
    const arr = porPresentacion.get(clave) ?? [];
    arr.push({ codTienda, descripcionTienda, tokens });
    porPresentacion.set(clave, arr);
  }

  return { porCodTienda, porCostoCodExt, porFirma, porPresentacion };
}

function matchPorDescripcion(
  descripcionProveedor: string,
  indice: IndiceMatchDuxPedidoUrgente
): ProdTiendaMatchDux | null {
  const desc = descripcionProveedor.trim();
  if (!desc) return null;
  const tokensLista = new Set(tokensDescProductoDux(desc));
  if (tokensLista.size < 3) return null;

  const firma = [...tokensLista].sort().join(" ");
  const exacto = indice.porFirma.get(firma);
  if (exacto && exacto !== "AMB") return exacto;

  const clave = clavePresentacion(tokensLista);
  const candidatos = indice.porPresentacion.get(clave) ?? [];
  const compatibles = candidatos.filter(
    (c) =>
      c.tokens.size >= 3 &&
      (esSubconjunto(tokensLista, c.tokens) || esSubconjunto(c.tokens, tokensLista))
  );
  if (compatibles.length !== 1) return null;
  return {
    codTienda: compatibles[0]!.codTienda,
    descripcionTienda: compatibles[0]!.descripcionTienda,
  };
}

/**
 * Prioridad: FK `cod_tienda` con fila real → CX PROD (`costo_compra_cod_ext`) →
 * descripción única (misma presentación / tokens).
 */
export function resolverTiendaPedidoUrgente(opts: {
  codTiendaVinculo: string | null | undefined;
  codExt: string;
  descripcionProveedor: string;
  indice: IndiceMatchDuxPedidoUrgente;
}): ProdTiendaMatchDux | null {
  const fk = opts.codTiendaVinculo?.trim() ?? "";
  if (fk) {
    return opts.indice.porCodTienda.get(fk) ?? null;
  }
  const porCosto = opts.indice.porCostoCodExt.get(opts.codExt.trim());
  if (porCosto) return porCosto;
  return matchPorDescripcion(opts.descripcionProveedor, opts.indice);
}
