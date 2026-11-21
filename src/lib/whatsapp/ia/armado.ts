import {
  WHATSAPP_IA_MAX_CHARS_MENSAJE,
  WHATSAPP_IA_MAX_CHARS_RESPUESTA,
} from "@/lib/whatsapp/ia/limites";

export type TurnoWhatsappIa = {
  rol: "cliente" | "tienda";
  texto: string;
};

/** Un dato que el modelo puede usar. Las notas marcadas y las búsquedas empujan acá. */
export type HechoWhatsappIa = {
  origen: "nota" | "producto" | "sucursal";
  texto: string;
};

const STOP = new Set([
  "hola",
  "buenas",
  "buenos",
  "buen",
  "dias",
  "tardes",
  "noches",
  "gracias",
  "favor",
  "porfa",
  "porfis",
  "para",
  "como",
  "cuando",
  "tiene",
  "tienen",
  "tenes",
  "haber",
  "precio",
  "precios",
  "stock",
  "disponible",
  "consulta",
  "queria",
  "quiero",
  "necesito",
  "saber",
  "cuanto",
  "cuesta",
  "sale",
  "valor",
  "litro",
  "litros",
  "kilo",
  "kilos",
  "color",
  "colores",
  "pintura",
  "producto",
  "productos",
]);

const PEDIDO_LOCAL =
  /\b(horario|horarios|hora|horas|abren|abre|abierto|cerrado|direccion|donde|ubicacion|sucursal|sucursales|local|locales|mapa|maps|telefono|whatsapp|guaymallen|maipu)\b/;

function sinAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max - 1).trimEnd()}…`;
}

/** Cuántas palabras de la consulta aparecen en la descripción. */
export function puntajeDescripcion(descripcion: string, tokens: string[]): number {
  const plana = sinAcento(descripcion.toLocaleLowerCase("es-AR"));
  return tokens.reduce((suma, token) => suma + (plana.includes(token) ? 1 : 0), 0);
}

/** Palabras del cliente para buscar productos. Las más nuevas primero. Máximo 4. */
export function tokensConsultaCliente(textosNuevoAViejo: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const texto of textosNuevoAViejo) {
    const partes = sinAcento(texto.toLocaleLowerCase("es-AR")).split(/[^\p{L}\p{N}]+/u);
    for (const parte of partes) {
      if (parte.length < 4 || STOP.has(parte) || /^\d+$/.test(parte) || vistos.has(parte)) continue;
      vistos.add(parte);
      out.push(parte);
      if (out.length >= 4) return out;
    }
  }
  return out;
}

/** Horario, dirección o sucursal. El catálogo de locales no entra en otra consulta. */
export function consultaPideSucursal(textos: string[]): boolean {
  const plano = sinAcento(textos.join(" ").toLocaleLowerCase("es-AR"));
  return PEDIDO_LOCAL.test(plano);
}

const SISTEMA = [
  "Sos el vendedor de TiendaColor Pinturerías.",
  "Redactás un borrador de WhatsApp para que una persona lo revise y lo envíe. No se envía solo.",
  "Español de Argentina, breve, cordial y natural. Una o dos oraciones. Sin markdown, sin listas y sin emojis.",
  "Máximo 350 caracteres.",
  "Usá solo los hechos que te paso. Prohibido inventar precios, stock, medidas, rendimientos o datos técnicos.",
  "Si falta un dato concreto que el cliente pidió, escribí [COMPLETAR] en ese lugar.",
  "No digas que sos una IA y no menciones códigos internos.",
].join(" ");

export function armarPedidoSugerencia(input: {
  turnos: TurnoWhatsappIa[];
  hechos: HechoWhatsappIa[];
}): { system: string; user: string; hechosTexto: string } {
  const lineas = input.turnos.map((turno) => {
    const quien = turno.rol === "cliente" ? "Cliente" : "Tienda";
    return `${quien}: ${recortar(turno.texto, WHATSAPP_IA_MAX_CHARS_MENSAJE)}`;
  });
  const hechosTexto = input.hechos.map((hecho) => hecho.texto).join("\n");
  const hechos =
    input.hechos.length === 0 ? "Hechos: ninguno." : `Hechos:\n${hechosTexto}`;
  return {
    system: SISTEMA,
    user: `Conversación, de la más vieja a la más nueva:\n${lineas.join("\n")}\n\n${hechos}\n\nRedactá la próxima respuesta de la tienda.`,
    hechosTexto,
  };
}

function numerosPermitidos(hechos: string): Set<string> {
  const set = new Set(hechos.match(/\d+/g) ?? []);
  for (const monto of hechos.match(/\d{1,3}(?:\.\d{3})+/g) ?? []) {
    set.add(monto.replace(/\./g, ""));
  }
  return set;
}

/** Precio, stock u otro número que no esté en los hechos pasa a [COMPLETAR]. */
export function sanearNumerosAjenos(texto: string, hechos: string): string {
  const permitidos = numerosPermitidos(hechos);
  return texto.replace(/\$\s*\d{1,3}(?:\.\d{3})+(?:,\d+)?|\$\s*\d+(?:,\d+)?|\d{1,3}(?:\.\d{3})+|\d+/g, (match) => {
    const grupos = match.match(/\d+/g) ?? [];
    const junto = grupos.join("");
    if (permitidos.has(junto) || grupos.every((grupo) => permitidos.has(grupo))) return match;
    return "[COMPLETAR]";
  });
}

/** Deja el borrador listo para el cuadro de texto. */
export function cerrarBorradorSugerencia(raw: string, hechos: string): string {
  const sinCerca = raw.replace(/```[\s\S]*?```/g, " ").trim();
  const unaLinea = sanearNumerosAjenos(sinCerca, hechos)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (unaLinea.length <= WHATSAPP_IA_MAX_CHARS_RESPUESTA) return unaLinea;
  const corte = unaLinea.slice(0, WHATSAPP_IA_MAX_CHARS_RESPUESTA);
  const espacio = corte.lastIndexOf(" ");
  return (espacio > 200 ? corte.slice(0, espacio) : corte).trim();
}
