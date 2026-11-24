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

/** Instructivo corto. Lo que no está cargado queda en [COMPLETAR]. No inventa datos. */
export function armarInstructivoFichaItem(input: {
  descripcion: string;
  dilucion: string;
  urlFicha: string;
}): string {
  const dilucion = input.dilucion.trim().slice(0, 240);
  const url = input.urlFicha.trim().slice(0, 500);
  const descripcion = input.descripcion.trim().slice(0, 400);
  const enlace = URL_HTTP.test(url) ? url : "[COMPLETAR]";
  return [
    `Así se usa ${descripcion}.`,
    "",
    "Preparación de la superficie",
    "[COMPLETAR]",
    "",
    "Dilución",
    dilucion.length > 0 ? dilucion : "[COMPLETAR]",
    "",
    "Tiempo de secado",
    "Entre manos: [COMPLETAR]",
    "Final: [COMPLETAR]",
    "",
    "Ficha técnica del fabricante",
    enlace,
  ].join("\n");
}

export type ConsultaTecnicaConversacionItem = {
  id: string;
  tipo: string;
  tipoEtiqueta: string;
  usuario: string;
  actualizadoEnIso: string;
};

export type ConsultaTecnicaMensajeItem = {
  id: string;
  autor: string;
  texto: string;
  creadoEnIso: string;
};
