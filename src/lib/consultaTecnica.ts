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
  if (tipo === CONSULTA_TECNICA_TIPO_FICHA) return "Ficha técnica de un ítem";
  if (tipo === CONSULTA_TECNICA_TIPO_RECOMENDAR) return "No sé qué producto recomendar";
  if (tipo === CONSULTA_TECNICA_TIPO_MANUAL) return "Manual de uso";
  return tipo;
}

const URL_HTTP = /^https?:\/\/\S+$/i;

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

/** Instructivo corto. Un párrafo que la hoja no trae no se escribe. */
export function armarInstructivoFichaItem(input: {
  descripcion: string;
  preparacion: string;
  dilucion: string;
  secadoEntreManos: string;
  secadoFinal: string;
  urlFicha: string;
}): string {
  const descripcion = input.descripcion.trim().slice(0, 240);
  const bloques = [`Así se usa ${descripcion}.`];
  const preparacion = textoDeHoja(input.preparacion, 320);
  if (preparacion) bloques.push("", "Preparación de la superficie", preparacion);
  const dilucion = textoDeHoja(input.dilucion, 320);
  if (dilucion) bloques.push("", "Dilución", dilucion);
  const entreManos = textoDeHoja(input.secadoEntreManos, 240);
  const secadoFinal = textoDeHoja(input.secadoFinal, 280);
  if (entreManos || secadoFinal) {
    bloques.push("", "Tiempo de secado");
    if (entreManos) bloques.push(`Entre manos: ${entreManos}`);
    if (secadoFinal) bloques.push(`Final: ${secadoFinal}`);
  }
  const url = input.urlFicha.trim().slice(0, 400);
  if (URL_HTTP.test(url)) bloques.push("", "Ficha técnica del fabricante", url);
  return bloques.join("\n");
}

export type ConsultaTecnicaConversacionItem = {
  id: string;
  tipo: string;
  tipoEtiqueta: string;
  usuario: string;
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
