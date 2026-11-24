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
