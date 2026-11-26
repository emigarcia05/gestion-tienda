/** Fila de Consulta Técnica. El texto lo carga el editor; no sale de OpenAI. */
export type ConsultaTecnicaRecomendacionItem = {
  id: string;
  idMarca: string;
  marca: string;
  idRubro: string;
  rubro: string;
  uso: string;
  dilucion: string;
  aplicacion: string;
  rendimiento: string;
  activo: boolean;
};

export type ConsultaTecnicaOpcion = {
  id: string;
  nombre: string;
};

export type ConsultaTecnicaPagina = {
  recomendaciones: ConsultaTecnicaRecomendacionItem[];
  marcas: ConsultaTecnicaOpcion[];
  rubros: ConsultaTecnicaOpcion[];
};

export const CONSULTA_TECNICA_TIPO = "TECNICA" as const;
export const CONSULTA_TECNICA_TIPO_FICHA = "FICHA_ITEM" as const;
export const CONSULTA_TECNICA_TIPO_RECOMENDAR = "RECOMENDAR" as const;
export const CONSULTA_TECNICA_TIPO_MANUAL = "MANUAL" as const;

export const CONSULTA_TECNICA_AUTOR_USUARIO = "USUARIO" as const;
export const CONSULTA_TECNICA_AUTOR_SISTEMA = "SISTEMA" as const;

export function etiquetaTipoConsultaTecnica(tipo: string): string {
  if (tipo === CONSULTA_TECNICA_TIPO) return "Técnica";
  if (tipo === CONSULTA_TECNICA_TIPO_FICHA) return "Cómo usar un producto";
  if (tipo === CONSULTA_TECNICA_TIPO_RECOMENDAR) return "No sé qué producto recomendar";
  if (tipo === CONSULTA_TECNICA_TIPO_MANUAL) return "Manual de uso";
  return tipo;
}

const URL_HTTP = /^https?:\/\/\S+$/i;

/** Títulos del instructivo de ficha. En el hilo se ven en negrita. */
export const CONSULTA_TECNICA_CATEGORIAS_FICHA = [
  "Preparación de la superficie",
  "Dilución",
  "Tiempo de secado",
  "Ficha técnica del fabricante",
] as const;

/** Etiquetas internas de Tiempo de secado. También van en negrita. */
export const CONSULTA_TECNICA_ETIQUETAS_FICHA = ["Entre manos", "Final"] as const;

export const CONSULTA_TECNICA_PREGUNTA_COINCIDENCIAS =
  "Varios ítems pueden coincidir con esa descripción, ¿a cuál te referís?";

const MARCA_OPCIONES = "\n---opciones---\n";

export type CoincidenciaConsulta =
  | { tipo: "familia"; id: string; etiqueta: string }
  | { tipo: "item"; codTienda: string; etiqueta: string };

function esCoincidencia(valor: unknown): valor is CoincidenciaConsulta {
  if (typeof valor !== "object" || valor == null) return false;
  const fila = valor as { tipo?: unknown; id?: unknown; codTienda?: unknown; etiqueta?: unknown };
  if (typeof fila.etiqueta !== "string" || fila.etiqueta.trim().length === 0) return false;
  if (fila.tipo === "familia") return typeof fila.id === "string" && fila.id.length > 0;
  if (fila.tipo === "item") return typeof fila.codTienda === "string" && fila.codTienda.length > 0;
  return false;
}

/** Pregunta + opciones. El hilo muestra cada opción como botón. */
export function armarMensajeCoincidencias(opciones: CoincidenciaConsulta[]): string {
  let corte = opciones.slice(0, 8);
  let texto = `${CONSULTA_TECNICA_PREGUNTA_COINCIDENCIAS}${MARCA_OPCIONES}${JSON.stringify(corte)}`;
  while (texto.length > 2000 && corte.length > 1) {
    corte = corte.slice(0, -1);
    texto = `${CONSULTA_TECNICA_PREGUNTA_COINCIDENCIAS}${MARCA_OPCIONES}${JSON.stringify(corte)}`;
  }
  return texto.slice(0, 2000);
}

/** Separa la pregunta de las opciones guardadas en el mensaje. */
export function leerMensajeCoincidencias(
  texto: string
): { intro: string; opciones: CoincidenciaConsulta[] } | null {
  const corte = texto.indexOf(MARCA_OPCIONES);
  if (corte < 0) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto.slice(corte + MARCA_OPCIONES.length));
  } catch {
    return null;
  }
  if (!Array.isArray(crudo)) return null;
  const opciones = crudo.filter(esCoincidencia);
  if (opciones.length === 0) return null;
  return { intro: texto.slice(0, corte).trim(), opciones };
}

function textoDeHoja(valor: string, tope: number): string | null {
  const texto = valor.replace(/\s+/g, " ").trim();
  if (texto.length === 0 || texto.includes("[COMPLETAR]")) return null;
  if (texto.length <= tope) return texto;
  const corte = texto.slice(0, tope);
  const punto = Math.max(corte.lastIndexOf("."), corte.lastIndexOf(";"));
  if (punto >= 40) return corte.slice(0, punto + 1).trim();
  const coma = corte.lastIndexOf(",");
  if (coma >= 40) return `${corte.slice(0, coma).trim()}.`;
  return corte.trim();
}

function sinMarcaDeEstilo(valor: string): string {
  return valor.replace(/^v\d+\|/, "");
}

/**
 * Cómo usar el producto, en dos pasos.
 * 1 es la superficie. El siguiente es una explicación en orden de uso.
 * Un dato que la hoja no trae no se escribe. La ficha del fabricante queda en la URL.
 */
export function armarInstructivoFichaItem(input: {
  descripcion: string;
  preparacion: string;
  aplicacion: string;
  urlFicha: string;
}): string {
  const descripcion = input.descripcion.trim().slice(0, 240);
  const preparacion = textoDeHoja(sinMarcaDeEstilo(input.preparacion), 450);
  const aplicacion = textoDeHoja(input.aplicacion, 900);
  const bloques = [`Así se usa ${descripcion}.`];
  let paso = 1;
  if (preparacion) {
    bloques.push("", `${paso}. Preparación.`, preparacion);
    paso += 1;
  }
  if (aplicacion) bloques.push("", `${paso}. ${aplicacion}`);
  const url = input.urlFicha.trim().slice(0, 400);
  if (URL_HTTP.test(url)) bloques.push("", "Ficha técnica del fabricante", url);
  return bloques.join("\n");
}

export type ConsultaTecnicaConversacionItem = {
  id: string;
  tipo: string;
  tipoEtiqueta: string;
  usuario: string;
  creadoEnIso: string;
  actualizadoEnIso: string;
};

export const CONSULTA_TECNICA_IMAGEN_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const CONSULTA_TECNICA_IMAGEN_MAX_BYTES = 4 * 1024 * 1024;
export const CONSULTA_TECNICA_TEXTO_FOTO = "Foto adjunta.";

export type ConsultaTecnicaMensajeItem = {
  id: string;
  autor: string;
  texto: string;
  tieneImagen: boolean;
  creadoEnIso: string;
};
