import type { WhatsappPruebaEstado } from "@prisma/client";

export type WhatsappPruebaMensajeItem = {
  id: string;
  direccion: "ENTRANTE" | "SALIENTE";
  cuerpo: string;
  estado: WhatsappPruebaEstado;
  errorTexto: string | null;
  creadoEnIso: string;
};
