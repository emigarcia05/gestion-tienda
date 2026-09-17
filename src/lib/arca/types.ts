import "server-only";

export type WsfeAuth = {
  token: string;
  sign: string;
  cuit: string;
};

export type WsfeErr = { code: number; msg: string };

export type WsfeDummyResult = {
  appServer: string;
  dbServer: string;
  authServer: string;
};

export type WsfeAlicIva = {
  id: number;
  baseImp: number;
  importe: number;
};

export type WsfeCbteAsoc = {
  tipo: number;
  ptoVta: number;
  nro: number;
  cuit?: string;
  cbteFch?: string;
};

export type WsfeCaeDetRequest = {
  concepto: number;
  docTipo: number;
  docNro: number;
  cbteDesde: number;
  cbteHasta: number;
  cbteFch: string;
  impTotal: number;
  impTotConc: number;
  impNeto: number;
  impOpEx: number;
  impTrib: number;
  impIVA: number;
  fchServDesde?: string;
  fchServHasta?: string;
  fchVtoPago?: string;
  monId: string;
  monCotiz: number;
  condicionIvaReceptorId: number;
  iva?: WsfeAlicIva[];
  cbtesAsoc?: WsfeCbteAsoc[];
};

export type WsfeCaeRequest = {
  ptoVta: number;
  cbteTipo: number;
  det: WsfeCaeDetRequest;
};

export type WsfeCaeResult = {
  resultado: "A" | "R" | "P";
  cae: string | null;
  caeFchVto: string | null;
  cbteDesde: number;
  cbteHasta: number;
  observaciones: WsfeErr[];
  errors: WsfeErr[];
  events: WsfeErr[];
};

export type WsfeCompConsultarResult = {
  resultado: "A" | "R" | "P" | null;
  cae: string | null;
  caeFchVto: string | null;
  cbteNro: number;
  cbteFch: string | null;
  impTotal: number | null;
  observaciones: WsfeErr[];
  errors: WsfeErr[];
};

export type WsfePtoVentaParam = {
  nro: number;
  emisionTipo: string;
  bloqueado: string;
};

export type WsfeCatalogoItem = {
  id: number;
  desc: string;
};

export type ArcaConstanciaImpuesto = {
  idImpuesto: number;
  estadoImpuesto: string | null;
  descripcionImpuesto: string | null;
};

export type ArcaConstanciaRaw = {
  cuit: string;
  razonSocial: string | null;
  nombre: string | null;
  apellido: string | null;
  tipoPersona: string | null;
  estadoClave: string | null;
  tieneDatosMonotributo: boolean;
  categoriaMonotributo: {
    idCategoria: number | null;
    descripcionCategoria: string | null;
  } | null;
  impuestosRegimenGeneral: ArcaConstanciaImpuesto[];
};
