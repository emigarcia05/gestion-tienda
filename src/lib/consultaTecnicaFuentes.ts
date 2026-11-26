const HOSTS_NO = [
  "scribd.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "mercadolibre.",
  "tiktok.com",
  "pinterest.",
  "wikipedia.org",
  "sikaguia.com",
];

const PALABRAS_SUELTAS = new Set([
  "para",
  "con",
  "los",
  "las",
  "una",
  "del",
  "por",
  "kg",
  "lts",
  "litro",
  "litros",
  "mortero",
  "pintura",
  "latex",
  "color",
  "bolsa",
  "balde",
  "envase",
  "cementicio",
  "impermeabilizante",
  "sellador",
  "producto",
]);

export type FuenteOficial = {
  /** Página de la que se lee el texto. */
  leer: string | null;
  /** URL que se muestra al final. Prioriza el PDF del fabricante. */
  ficha: string | null;
};

function slug(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function tokensDeProducto(marca: string, descripcion: string): string[] {
  const partes = `${marca} ${descripcion}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((parte) => parte.length > 0);
  const unicos = new Set<string>();
  for (const parte of partes) {
    if (PALABRAS_SUELTAS.has(parte)) continue;
    if (/^\d+$/.test(parte)) {
      if (parte.length >= 2 && parte.length <= 4) unicos.add(parte);
      continue;
    }
    if (parte.length >= 4) unicos.add(parte);
  }
  const marcaSlug = slug(marca);
  if (marcaSlug.length >= 3) unicos.add(marcaSlug);
  return [...unicos].filter((token) => token.length > 0);
}

function urlHttps(valor: string): URL | null {
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (HOSTS_NO.some((malo) => host.includes(malo))) return null;
    return url;
  } catch {
    return null;
  }
}

function puntos(url: string, tokens: string[]): number {
  const texto = decodeURIComponent(url).toLowerCase();
  return tokens.reduce((suma, token) => (texto.includes(token) ? suma + 1 : suma), 0);
}

/** Se queda con páginas del fabricante. No usa el texto que redacta el modelo, solo las fuentes de la búsqueda. */
export function elegirFuenteOficial(
  urls: string[],
  marca: string,
  descripcion: string
): FuenteOficial {
  const tokens = tokensDeProducto(marca, descripcion);
  const marcaSlug = slug(marca);
  const candidatas = urls
    .map((valor) => ({ valor, url: urlHttps(valor) }))
    .filter((item): item is { valor: string; url: URL } => item.url != null)
    .map((item) => ({
      valor: item.valor,
      puntos: puntos(item.valor, tokens),
      deMarca: marcaSlug.length >= 3 && item.url.hostname.toLowerCase().includes(marcaSlug),
      pdf: item.valor.toLowerCase().includes(".pdf"),
    }))
    .filter((item) => item.deMarca || item.puntos >= 2);

  const deMarca = candidatas.some((item) => item.deMarca)
    ? candidatas.filter((item) => item.deMarca)
    : candidatas;
  const deArgentina = deMarca.filter((item) => {
    try {
      return new URL(item.valor).hostname.toLowerCase().startsWith("arg.");
    } catch {
      return false;
    }
  });
  const pool = deArgentina.length > 0 ? deArgentina : deMarca;
  const mejor = (pdf: boolean) =>
    pool
      .filter((item) => item.pdf === pdf)
      .sort((a, b) => b.puntos - a.puntos)[0]?.valor ?? null;
  const html = mejor(false);
  const pdf = mejor(true);
  return { leer: html ?? pdf, ficha: pdf ?? html };
}

const ANCLAS_HOJA = [
  "calidad del sustrato",
  "pre-tratamiento",
  "pretratamiento",
  "proporción de la mezcla",
  "proporcion de la mezcla",
  "instrucciones de aplicación",
  "instrucciones de aplicacion",
];

export function htmlATexto(html: string): string {
  const sinMarca = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
  const bajo = sinMarca.toLowerCase();
  let inicio = -1;
  for (const ancla of ANCLAS_HOJA) {
    const en = bajo.indexOf(ancla);
    if (en >= 0 && (inicio < 0 || en < inicio)) inicio = en;
  }
  const desde = inicio >= 0 ? Math.max(0, inicio - 120) : 0;
  const recorte = sinMarca.slice(desde);
  const corteFaq = recorte.search(/preguntas frecuentes/i);
  const util = corteFaq > 400 ? recorte.slice(0, corteFaq) : recorte;
  return util.slice(0, 8000);
}


/** Si la sección trae un número que no está en la hoja, no se publica. */
export function dejarSeccionSiEstaEnFuente(seccion: string, fuente: string, tope = 500): string {
  const texto = seccion
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^(preparaci[oó]n|diluci[oó]n|aplicaci[oó]n)\s*:\s*/i, "")
    .replace(/^(aplicaci[oó]n\s+)+/i, "")
    .replace(/^proporci[oó]n de la mezcla\s+/i, "");
  if (texto.length === 0 || texto.includes("[COMPLETAR]")) return "[COMPLETAR]";
  if (/secadoEntreManos|secadoFinal|con qué se mezcla|cuánto esperar/i.test(texto)) {
    return "[COMPLETAR]";
  }
  const fuentePlana = fuente.toLowerCase();
  const numeros = texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
  for (const numero of numeros) {
    const conComa = numero.replace(".", ",");
    const conPunto = numero.replace(",", ".");
    const entero = numero.replace(/[.,]\d+$/, "");
    const esta =
      fuentePlana.includes(numero.toLowerCase()) ||
      fuentePlana.includes(conComa.toLowerCase()) ||
      fuentePlana.includes(conPunto.toLowerCase()) ||
      (entero.length > 0 && fuentePlana.includes(entero));
    if (!esta) return "[COMPLETAR]";
  }
  return texto.slice(0, tope);
}
