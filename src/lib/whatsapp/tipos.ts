import type { WhatsappPruebaEstado } from "@prisma/client";

export type WhatsappPruebaChatItem = {
  telefono: string;
  nombre: string | null;
  ultimoCuerpo: string;
  ultimoEnIso: string;
  ultimoDireccion: "ENTRANTE" | "SALIENTE";
};

export type WhatsappPruebaMensajeItem = {
  id: string;
  telefono: string;
  direccion: "ENTRANTE" | "SALIENTE";
  cuerpo: string;
  estado: WhatsappPruebaEstado;
  errorTexto: string | null;
  creadoEnIso: string;
};
