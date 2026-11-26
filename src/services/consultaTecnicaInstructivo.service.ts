import "server-only";

import { z } from "zod";
import {
  dejarSeccionSiEstaEnFuente,
  elegirFuenteOficial,
  htmlATexto,
} from "@/lib/consultaTecnicaFuentes";
import { getPdfJsServer } from "@/lib/pdfjsServerLoad";
import {
  buscarFuentesConsultaTecnica,
  completarConsultaTecnica,
} from "@/lib/whatsapp/ia/completar";

const partesSchema = z.object({
  preparacion: z.string(),
  aplicacion: z.string(),
});

export type ResumenHojaFabricante = {
  preparacion: string;
  aplicacion: string;
  urlFicha: string;
};

const VACIO: ResumenHojaFabricante = {
  preparacion: "",
  aplicacion: "",
  urlFicha: "",
};

const TOPE_APLICACION = 900;

export type FichaCargadaConsulta = {
  url: string;
  pdf: Uint8Array | null;
};

async function textoDePdfBytes(buffer: Uint8Array): Promise<string> {
  if (buffer.length < 5 || buffer[0] !== 0x25) return "";
  const pdfjs = await getPdfJsServer();
  const doc = await pdfjs.getDocument({
    data: buffer,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  const partes: string[] = [];
  const tope = Math.min(doc.numPages, 3);
  for (let numero = 1; numero <= tope; numero += 1) {
    const pagina = await doc.getPage(numero);
    const contenido = await pagina.getTextContent();
    const linea = contenido.items
      .map((item) => (typeof item === "object" && item && "str" in item ? String(item.str) : ""))
      .join(" ");
    partes.push(linea);
  }
  return partes.join(" ").replace(/\s+/g, " ").slice(0, 7000);
}

async function leerPdf(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/pdf" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return "";
  return textoDePdfBytes(new Uint8Array(await response.arrayBuffer()));
}

async function leerHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "TiendaColorGestion/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return "";
  const tipo = (response.headers.get("content-type") ?? "").toLowerCase();
  if (tipo.includes("pdf")) return "";
  return htmlATexto(await response.text());
}

function publicarCampo(valor: string, hoja: string, tope: number): string {
  const texto = dejarSeccionSiEstaEnFuente(valor, hoja, tope);
  return texto;
}

/** Una dilución sin porcentaje y sin decir que va pura no se publica. */
function publicarAplicacion(valor: string, hoja: string): string {
  const texto = publicarCampo(valor, hoja, TOPE_APLICACION);
  if (texto === "[COMPLETAR]") return texto;
  if (/dilu/i.test(texto) && !texto.includes("%") && !/pur[ao]|sin diluir/i.test(texto)) {
    return "[COMPLETAR]";
  }
  return texto;
}

function leerPartes(texto: string): z.infer<typeof partesSchema> | null {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  try {
    const parsed = partesSchema.safeParse(JSON.parse(texto.slice(inicio, fin + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function textoPlano(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

/** El prompt pide los dos pasos. Si el modelo igual manda JSON, también se lee. */
function leerInstructivo(texto: string): { preparacion: string; aplicacion: string } | null {
  const sinCerca = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const corte = sinCerca.match(/1\.\s*Preparaci[oó]n\.?\s*([\s\S]*?)\s*\n+\s*2\.\s*([\s\S]*)$/i);
  if (corte) {
    const preparacion = textoPlano(corte[1]);
    const aplicacion = textoPlano(corte[2]).replace(/\s*¿[^?]{0,240}\?\s*$/, "").trim();
    if (preparacion.length > 0 && aplicacion.length > 0) return { preparacion, aplicacion };
  }
  const json = leerPartes(sinCerca);
  if (!json) return null;
  const preparacion = textoPlano(json.preparacion);
  const aplicacion = textoPlano(json.aplicacion);
  if (preparacion.length === 0 || aplicacion.length === 0) return null;
  return { preparacion, aplicacion };
}

/**
 * La ficha cargada en la familia se lee primero. Si no hay, o no se puede leer,
 * se busca la hoja del fabricante en la web. `guardar` es true solo cuando el
 * resumen salió de esa hoja. No hay reglas por producto.
 */
export async function resumirHojaFabricante(input: {
  descripcion: string;
  marca: string;
  fichaCargada?: FichaCargadaConsulta;
}): Promise<{ resumen: ResumenHojaFabricante; guardar: boolean }> {
  const vacio = { resumen: VACIO, guardar: false };
  try {
    let hoja = "";
    let urlFicha = "";
    const cargada = input.fichaCargada;
    const urlCargada = cargada?.url.trim() ?? "";
    if (cargada?.pdf && cargada.pdf.byteLength > 0) {
      try {
        hoja = await textoDePdfBytes(cargada.pdf);
      } catch (error: unknown) {
        console.error("[consultaTecnica][pdf]", error instanceof Error ? error.name : "error");
      }
      if (/^https?:\/\//i.test(urlCargada)) urlFicha = urlCargada;
    }
    if (hoja.length < 200 && /^https?:\/\//i.test(urlCargada)) {
      urlFicha = urlCargada;
      try {
        hoja = urlCargada.toLowerCase().includes(".pdf")
          ? await leerPdf(urlCargada)
          : await leerHtml(urlCargada);
      } catch (error: unknown) {
        console.error("[consultaTecnica][ficha-cargada]", error instanceof Error ? error.name : "error");
        hoja = "";
      }
    }

    if (hoja.length < 200) {
      const fuentes = await buscarFuentesConsultaTecnica(
        `Hoja técnica oficial del fabricante de "${input.marca} ${input.descripcion}" en Argentina. Solo el sitio del fabricante, no tiendas.`
      );
      if (!fuentes.success || fuentes.data.length === 0) {
        return { resumen: { ...VACIO, urlFicha }, guardar: false };
      }
      const elegida = elegirFuenteOficial(fuentes.data, input.marca, input.descripcion);
      urlFicha = elegida.ficha ?? "";
      if (!elegida.leer && !urlFicha) return { resumen: { ...VACIO, urlFicha }, guardar: false };
      hoja = "";
      if (urlFicha.toLowerCase().includes(".pdf")) {
        try {
          hoja = await leerPdf(urlFicha);
        } catch (error: unknown) {
          console.error("[consultaTecnica][pdf]", error instanceof Error ? error.name : "error");
        }
      }
      if (hoja.length < 200 && elegida.leer && elegida.leer !== urlFicha) {
        hoja = await leerHtml(elegida.leer);
      }
    }

    if (hoja.length < 200) {
      return { resumen: { ...VACIO, urlFicha }, guardar: false };
    }

    const redactado = await completarConsultaTecnica({
      system: [
        "Hablás con quien va a aplicar el producto, en Argentina. El texto se lee en el mostrador: claro, corto y de todos los días. No sos un vendedor ni un buscador.",
        "Usá solo la hoja técnica que te paso. No uses otra fuente. Ignorá precio, moneda, tienda, estrellas, envío y cualquier oferta.",
        "Respondé exactamente así, sin JSON, sin títulos de más y sin una pregunta al final:",
        "1. Preparación. Una oración, en este tono: «La superficie debe estar limpia, libre de polvo, grasitud y seca.» Si la hoja pide un paso previo concreto (mampostería nueva, hongos, partes flojas), sumá una segunda oración corta con ese dato. No armes un informe.",
        "2. Un solo párrafo, seguido, sin viñetas. Cada frase entra solo si la hoja la respalda, en este orden: si hay que mezclar, empezá con «Antes de comenzar, no olvides batir bien el producto.» La primera mano: «La primera mano se debe diluir en un X% con el líquido de la hoja.» Si la hoja explica la proporción, agregala en esa misma frase. Si advierte que no se dé pura, decilo ahí. Si entre manos hay que tapar grietas o usar otro producto, una frase. «Antes de la siguiente mano se debe esperar al menos el tiempo de la hoja.» Las manos que siguen: si van puras o diluidas, y cuántas pide la hoja. Al final, una sola condición para trabajar o dejar secar (lluvia o temperatura).",
        "No repitas un dato que ya dijiste. No inventes números, solventes, tiempos ni manos. No digas pintar si la hoja no lo trata como pintura.",
        "No escribas nada después de ese párrafo. No copies estas instrucciones.",
      ].join(" "),
      user: `Producto: ${input.marca} ${input.descripcion}\n\nHoja técnica:\n${hoja}`,
    });
    if (!redactado.success) return { resumen: { ...VACIO, urlFicha }, guardar: false };

    const partes = leerInstructivo(redactado.data);
    if (!partes) return { resumen: { ...VACIO, urlFicha }, guardar: false };

    return {
      resumen: {
        preparacion: publicarCampo(partes.preparacion, hoja, 450),
        aplicacion: publicarAplicacion(partes.aplicacion, hoja),
        urlFicha,
      },
      guardar: true,
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][instructivo]", error instanceof Error ? error.name : "error");
    return vacio;
  }
}
