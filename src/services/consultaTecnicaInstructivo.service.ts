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
  dilucion: z.string(),
  secadoEntreManos: z.string(),
  secadoFinal: z.string(),
});

export type ResumenHojaFabricante = {
  preparacion: string;
  dilucion: string;
  secadoEntreManos: string;
  secadoFinal: string;
  urlFicha: string;
};

const VACIO: ResumenHojaFabricante = {
  preparacion: "",
  dilucion: "",
  secadoEntreManos: "",
  secadoFinal: "",
  urlFicha: "",
};

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
        "Hablás con un consumidor final en Argentina, de vos, con palabras de todos los días.",
        "Leíste la hoja técnica que te paso. No uses otra fuente.",
        "Resumí cómo preparar la superficie, con qué se mezcla y cuánto, cuánto esperar entre manos y cuándo se puede usar.",
        "No inventes números, tiempos ni pasos. Si la hoja no lo dice, el valor es exactamente [COMPLETAR].",
        "No uses palabras de fábrica. Una o dos oraciones cortas por campo.",
        "Respondé solo un JSON con las claves preparacion, dilucion, secadoEntreManos y secadoFinal.",
      ].join(" "),
      user: `Producto: ${input.marca} ${input.descripcion}\n\nHoja técnica:\n${hoja}`,
    });
    if (!redactado.success) return { resumen: { ...VACIO, urlFicha }, guardar: false };

    const partes = leerPartes(redactado.data);
    if (!partes) return { resumen: { ...VACIO, urlFicha }, guardar: false };

    const campo = (valor: string) => dejarSeccionSiEstaEnFuente(valor, hoja);
    return {
      resumen: {
        preparacion: campo(partes.preparacion),
        dilucion: campo(partes.dilucion),
        secadoEntreManos: campo(partes.secadoEntreManos),
        secadoFinal: campo(partes.secadoFinal),
        urlFicha,
      },
      guardar: true,
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][instructivo]", error instanceof Error ? error.name : "error");
    return vacio;
  }
}
