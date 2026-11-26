import "server-only";

import { Prisma } from "@prisma/client";
import {
  CONSULTA_TECNICA_AUTOR_SISTEMA,
  CONSULTA_TECNICA_AUTOR_USUARIO,
  CONSULTA_TECNICA_IMAGEN_MAX_BYTES,
  CONSULTA_TECNICA_IMAGEN_MIME,
  CONSULTA_TECNICA_TEXTO_FOTO,
  CONSULTA_TECNICA_TIPO,
  CONSULTA_TECNICA_TIPO_FICHA,
  armarInstructivoFichaItem,
  armarMensajeCoincidencias,
  etiquetaTipoConsultaTecnica,
  type CoincidenciaConsulta,
  type ConsultaTecnicaConversacionItem,
  type ConsultaTecnicaMensajeItem,
  type ConsultaTecnicaPagina,
  type ConsultaTecnicaRecomendacionItem,
} from "@/lib/consultaTecnica";
import { claveFichaDeFlia, claveFichaDeSku } from "@/lib/prodProducto";
import { prisma } from "@/lib/prisma";
import {
  resumirHojaFabricante,
  type FichaCargadaConsulta,
  type ResumenHojaFabricante,
} from "@/services/consultaTecnicaInstructivo.service";
import { completarConsultaTecnica } from "@/lib/whatsapp/ia/completar";
import type { ServiceResult } from "@/types/service.types";

export type GuardarConsultaTecnicaInput = {
  id?: string;
  idMarca: string;
  idRubro: string;
  uso: string;
  dilucion: string;
  aplicacion: string;
  rendimiento: string;
  activo: boolean;
};

function esUnico(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function aItem(fila: {
  id: string;
  idMarca: string;
  idRubro: string;
  uso: string;
  dilucion: string;
  aplicacion: string;
  rendimiento: string;
  activo: boolean;
  marca: { nombre: string };
  rubro: { nombre: string };
}): ConsultaTecnicaRecomendacionItem {
  return {
    id: fila.id,
    idMarca: fila.idMarca,
    marca: fila.marca.nombre,
    idRubro: fila.idRubro,
    rubro: fila.rubro.nombre,
    uso: fila.uso,
    dilucion: fila.dilucion,
    aplicacion: fila.aplicacion,
    rendimiento: fila.rendimiento,
    activo: fila.activo,
  };
}

const includeNombres = {
  marca: { select: { nombre: true } },
  rubro: { select: { nombre: true } },
} as const;

/** Listado de fichas y los catálogos para elegir marca y rubro. */
export async function obtenerPaginaConsultaTecnica(
  soloActivas: boolean
): Promise<ConsultaTecnicaPagina> {
  const [filas, marcas, rubros] = await Promise.all([
    prisma.consultaTecnicaRecomendacion.findMany({
      where: soloActivas ? { activo: true } : undefined,
      include: includeNombres,
      orderBy: [{ marca: { nombre: "asc" } }, { rubro: { nombre: "asc" } }],
    }),
    prisma.marca.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.prodRubro.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return {
    recomendaciones: filas.map(aItem),
    marcas,
    rubros,
  };
}

/** Alta o edición. La marca y el rubro no se cambian en una ficha ya guardada. */
export async function guardarConsultaTecnica(
  input: GuardarConsultaTecnicaInput
): Promise<ServiceResult<ConsultaTecnicaRecomendacionItem>> {
  const data = {
    uso: input.uso,
    dilucion: input.dilucion,
    aplicacion: input.aplicacion,
    rendimiento: input.rendimiento,
    activo: input.activo,
  };

  try {
    if (input.id) {
      const actual = await prisma.consultaTecnicaRecomendacion.findUnique({
        where: { id: input.id },
        select: { id: true, idMarca: true, idRubro: true },
      });
      if (!actual) return { success: false, error: "La recomendación no existe." };
      if (actual.idMarca !== input.idMarca || actual.idRubro !== input.idRubro) {
        return { success: false, error: "La marca y el rubro de una ficha no se cambian." };
      }
      const fila = await prisma.consultaTecnicaRecomendacion.update({
        where: { id: input.id },
        data,
        include: includeNombres,
      });
      return { success: true, data: aItem(fila) };
    }

    const [marca, rubro] = await Promise.all([
      prisma.marca.findUnique({ where: { id: input.idMarca }, select: { id: true } }),
      prisma.prodRubro.findUnique({ where: { id: input.idRubro }, select: { id: true } }),
    ]);
    if (!marca) return { success: false, error: "La marca no existe." };
    if (!rubro) return { success: false, error: "El rubro no existe." };

    const fila = await prisma.consultaTecnicaRecomendacion.create({
      data: {
        idMarca: input.idMarca,
        idRubro: input.idRubro,
        ...data,
      },
      include: includeNombres,
    });
    return { success: true, data: aItem(fila) };
  } catch (error: unknown) {
    if (esUnico(error)) {
      return { success: false, error: "Ya hay una recomendación para esa marca y ese rubro." };
    }
    console.error("[consultaTecnica][guardar]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo guardar la recomendación." };
  }
}

export async function eliminarConsultaTecnica(id: string): Promise<ServiceResult> {
  try {
    const actual = await prisma.consultaTecnicaRecomendacion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!actual) return { success: false, error: "La recomendación no existe." };
    await prisma.consultaTecnicaRecomendacion.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    console.error("[consultaTecnica][eliminar]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo eliminar la recomendación." };
  }
}

function aConversacion(fila: {
  id: string;
  tipo: string;
  createdAt: Date;
  updatedAt: Date;
  personal: { nombrePersonal: string };
}): ConsultaTecnicaConversacionItem {
  return {
    id: fila.id,
    tipo: fila.tipo,
    tipoEtiqueta: etiquetaTipoConsultaTecnica(fila.tipo),
    usuario: fila.personal.nombrePersonal,
    creadoEnIso: fila.createdAt.toISOString(),
    actualizadoEnIso: fila.updatedAt.toISOString(),
  };
}

const MENSAJE_SELECT = {
  id: true,
  autor: true,
  texto: true,
  imagenMime: true,
  createdAt: true,
} as const;

function aMensaje(fila: {
  id: string;
  autor: string;
  texto: string;
  imagenMime: string | null;
  createdAt: Date;
}): ConsultaTecnicaMensajeItem {
  return {
    id: fila.id,
    autor: fila.autor,
    texto: fila.texto,
    tieneImagen: fila.imagenMime != null,
    creadoEnIso: fila.createdAt.toISOString(),
  };
}

function textoSinCompletar(valor: string): string | null {
  const texto = valor
    .split("\n")
    .filter((linea) => !linea.includes("[COMPLETAR]"))
    .join("\n")
    .trim()
    .slice(0, 2000);
  return texto.length > 0 ? texto : null;
}

function imagenValida(mime: string, bytes: Uint8Array): boolean {
  if (!(CONSULTA_TECNICA_IMAGEN_MIME as readonly string[]).includes(mime)) return false;
  if (bytes.byteLength === 0 || bytes.byteLength > CONSULTA_TECNICA_IMAGEN_MAX_BYTES) return false;
  if (mime === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return (
    bytes.byteLength > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

const DIAS_VIDA_CONSULTA = 7;

/** Borra los hilos abiertos hace más de 7 días. Los mensajes se van en cascada. */
async function purgarConsultasVencidas(): Promise<void> {
  const limite = new Date(Date.now() - DIAS_VIDA_CONSULTA * 24 * 60 * 60 * 1000);
  await prisma.consultaTecnicaConversacion.deleteMany({
    where: { createdAt: { lt: limite } },
  });
}

/** Hilos, el más reciente primero. Al listar, primero saca los de más de 7 días. */
export async function listarConversacionesConsultaTecnica(): Promise<
  ConsultaTecnicaConversacionItem[]
> {
  await purgarConsultasVencidas();
  const filas = await prisma.consultaTecnicaConversacion.findMany({
    include: { personal: { select: { nombrePersonal: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return filas.map(aConversacion);
}

/** Borra el hilo y sus mensajes. No toca la ficha técnica guardada. */
export async function eliminarConversacionConsultaTecnica(
  conversacionId: string
): Promise<ServiceResult> {
  try {
    const actual = await prisma.consultaTecnicaConversacion.findUnique({
      where: { id: conversacionId },
      select: { id: true },
    });
    if (!actual) return { success: false, error: "La consulta no existe." };
    await prisma.consultaTecnicaConversacion.delete({ where: { id: conversacionId } });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    console.error("[consultaTecnica][eliminar hilo]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo borrar la consulta." };
  }
}

/** Últimos 200 mensajes del hilo, del más viejo al más nuevo. */
export async function listarMensajesConsultaTecnica(
  conversacionId: string
): Promise<ServiceResult<ConsultaTecnicaMensajeItem[]>> {
  const existe = await prisma.consultaTecnicaConversacion.findUnique({
    where: { id: conversacionId },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "La consulta no existe." };

  const filas = await prisma.consultaTecnicaMensaje.findMany({
    where: { conversacionId },
    select: MENSAJE_SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return { success: true, data: filas.reverse().map(aMensaje) };
}

/**
 * Agrega el texto del usuario. Sin hilo, abre uno de tipo TECNICA.
 * No llama a OpenAI.
 */
export async function enviarMensajeConsultaTecnica(input: {
  personalId: number;
  conversacionId?: string;
  texto: string;
}): Promise<
  ServiceResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
  }>
> {
  try {
    const personal = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.personalId },
      select: { idPersonal: true },
    });
    if (!personal) return { success: false, error: "El usuario de la sesión no existe." };

    const resultado = await prisma.$transaction(async (tx) => {
      let conversacionId = input.conversacionId;
      if (conversacionId) {
        const actual = await tx.consultaTecnicaConversacion.findUnique({
          where: { id: conversacionId },
          select: { id: true },
        });
        if (!actual) return null;
      } else {
        const creada = await tx.consultaTecnicaConversacion.create({
          data: { tipo: CONSULTA_TECNICA_TIPO, personalId: input.personalId },
          select: { id: true },
        });
        conversacionId = creada.id;
      }

      const mensaje = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId,
          autor: CONSULTA_TECNICA_AUTOR_USUARIO,
          texto: input.texto,
        },
        select: MENSAJE_SELECT,
      });
      const conversacion = await tx.consultaTecnicaConversacion.update({
        where: { id: conversacionId },
        data: { updatedAt: new Date() },
        include: { personal: { select: { nombrePersonal: true } } },
      });
      return { conversacion, mensaje };
    });

    if (!resultado) return { success: false, error: "La consulta no existe." };
    return {
      success: true,
      data: {
        conversacion: aConversacion(resultado.conversacion),
        mensaje: aMensaje(resultado.mensaje),
      },
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][enviar]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo guardar la consulta." };
  }
}

function descripcionDelInstructivo(mensajes: ConsultaTecnicaMensajeItem[]): string | null {
  const intro = mensajes.find(
    (mensaje) => mensaje.autor === CONSULTA_TECNICA_AUTOR_SISTEMA && mensaje.texto.startsWith("Así se usa ")
  );
  if (!intro) return null;
  const linea = intro.texto.split("\n")[0] ?? "";
  const nombre = linea.replace(/^Así se usa\s+/, "").replace(/\.\s*$/, "").trim();
  return nombre.length > 0 ? nombre : null;
}

function hiloSinDatosDeHoja(mensajes: ConsultaTecnicaMensajeItem[]): boolean {
  return !mensajes.some(
    (mensaje) =>
      mensaje.autor === CONSULTA_TECNICA_AUTOR_SISTEMA &&
      (mensaje.texto.includes("\nPreparación") ||
        mensaje.texto.includes("\nDilución") ||
        mensaje.texto.includes("\nTiempo de secado") ||
        mensaje.texto.includes("https://") ||
        (mensaje.texto.startsWith("Así se usa ") && mensaje.texto.includes("\n\n")))
  );
}

async function responderConHoja(descripcion: string): Promise<string | null> {
  const item = await prisma.prodPropio.findFirst({
    where: { descripcionTienda: descripcion, habilitado: true },
    select: { codTienda: true },
  });
  if (item) {
    const armado = await instructivoDeItem(item.codTienda);
    if (!armado.success) return null;
    return instructivoConDatos(armado.data.texto);
  }
  const leida = await resumirHojaFabricante({ descripcion, marca: "" });
  const texto = armarInstructivoFichaItem({
    descripcion,
    preparacion: leida.resumen.preparacion,
    aplicacion: leida.resumen.aplicacion,
    urlFicha: leida.resumen.urlFicha,
  });
  return instructivoConDatos(texto);
}

function instructivoConDatos(texto: string): string | null {
  if (!texto.includes("\n") && !texto.includes("https://")) return null;
  return texto.slice(0, 2000);
}

async function guardarRespuesta(
  conversacionId: string,
  texto: string
): Promise<ConsultaTecnicaMensajeItem | null> {
  const limpio = textoSinCompletar(texto);
  if (!limpio) return null;
  const mensaje = await prisma.$transaction(async (tx) => {
    const creado = await tx.consultaTecnicaMensaje.create({
      data: {
        conversacionId,
        autor: CONSULTA_TECNICA_AUTOR_SISTEMA,
        texto: limpio,
      },
      select: MENSAJE_SELECT,
    });
    await tx.consultaTecnicaConversacion.update({
      where: { id: conversacionId },
      data: { updatedAt: new Date() },
    });
    return creado;
  });
  return aMensaje(mensaje);
}

const PALABRAS_VACIAS = new Set([
  "que",
  "como",
  "para",
  "con",
  "por",
  "los",
  "las",
  "del",
  "una",
  "uno",
  "este",
  "esta",
  "esto",
  "sirve",
  "tiene",
  "sobre",
  "desde",
  "donde",
  "cuando",
  "porque",
  "necesito",
  "quiero",
  "puedo",
  "puede",
  "hacer",
  "usar",
  "uso",
  "producto",
  "item",
  "consulta",
  "ficha",
  "tecnica",
  "tecnico",
  "contestaste",
  "contesta",
  "decime",
  "dime",
]);

function tokensConsulta(texto: string): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const crudo of texto.toLowerCase().split(/[^a-z0-9áéíóúüñ]+/i)) {
    const token = crudo.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (token.length < 4 || PALABRAS_VACIAS.has(token) || vistos.has(token)) continue;
    vistos.add(token);
    salida.push(token);
    if (salida.length === 4) break;
  }
  return salida;
}

async function descripcionesTienda(tokens: string[]): Promise<string[]> {
  const filas = await prisma.prodPropio.findMany({
    where: {
      habilitado: true,
      AND: tokens.map((token) => ({
        descripcionTienda: { contains: token, mode: "insensitive" as const },
      })),
    },
    select: { descripcionTienda: true },
    orderBy: { descripcionTienda: "asc" },
    take: 5,
  });
  return filas
    .map((fila) => (fila.descripcionTienda ?? "").trim())
    .filter((descripcion) => descripcion.length > 0);
}

async function descripcionesProveedor(tokens: string[]): Promise<string[]> {
  const filas = await prisma.listaPrecioProveedor.findMany({
    where: {
      habilitado: true,
      AND: tokens.map((token) => ({
        descripcionProveedor: { contains: token, mode: "insensitive" as const },
      })),
    },
    select: { descripcionProveedor: true, marca: true },
    orderBy: { descripcionProveedor: "asc" },
    take: 5,
  });
  return filas
    .map((fila) => {
      const descripcion = fila.descripcionProveedor.trim();
      const marca = (fila.marca ?? "").trim();
      if (descripcion.length === 0) return "";
      return marca.length > 0 ? `${marca}: ${descripcion}` : descripcion;
    })
    .filter((linea) => linea.length > 0);
}

async function listasParaRecomendar(tokens: string[]): Promise<string> {
  if (tokens.length === 0) {
    return "No hay palabras de producto para buscar en las listas. No cambies de ítem.";
  }
  let tienda = await descripcionesTienda(tokens);
  let proveedor = await descripcionesProveedor(tokens);
  if (tienda.length === 0 && proveedor.length === 0 && tokens.length > 1) {
    const principal = [...tokens].sort((a, b) => b.length - a.length).slice(0, 1);
    tienda = await descripcionesTienda(principal);
    proveedor = await descripcionesProveedor(principal);
  }
  const bloqueTienda =
    tienda.length > 0 ? tienda.map((linea) => `- ${linea}`).join("\n") : "- Ninguno.";
  const bloqueProveedor =
    proveedor.length > 0 ? proveedor.map((linea) => `- ${linea}`).join("\n") : "- Ninguno.";
  return [
    "Prioridad para recomendar un ítem:",
    "1. Tienda (prod_lista):",
    bloqueTienda,
    "2. Proveedor (proveedores_prod_lista), solo si ninguno de tienda resuelve el uso:",
    bloqueProveedor,
    "3. Si ninguna lista tiene un ítem que sirva, decilo y recién ahí usá conocimiento general. No inventes un código ni un precio.",
  ].join("\n");
}

const SISTEMA_CONVERSACION = [
  "Sos el especialista técnico-comercial de TiendaColor, en Argentina: pinturería arquitectónica, impermeabilización, materiales de construcción y repintado automotor.",
  "Hablás de vos, en español rioplatense, como un colega de mostrador. Sos directo, empático y corto.",
  "El chat muestra texto plano: usá renglones y guiones. No uses markdown ni tablas.",
  "Si el hilo trae cómo usar el producto, seguí ese tono: explicación cotidiana, de vos, en el orden de uso. No vuelvas a armar el paso a paso numerado: respondé la pregunta.",
  "Si preguntan si un producto sirve, empezá por Sí, No o Depende, y explicá en una frase por qué, desde el material.",
  "Cuando pidan cómo prepararlo, da el paso a paso. Si el bloque Hoja trae un número, usá ese. Si no hay hoja, podés usar criterio de mostrador y tenés que decir que no sale de la ficha del fabricante.",
  "No inventes precios ni stock. No cambies el ítem de la consulta salvo que pidan otra opción.",
  "Para recomendar, respetá el orden de las listas que te paso: primero tienda, después proveedor, y solo al final un producto que no esté en esas listas.",
  "Si piden un texto para el cliente, cerrá con un bloque corto listo para reenviar, separado de la explicación.",
  "Si la pregunta llega cortada, pedí que la completen. No escribas [COMPLETAR].",
].join(" ");

function planoConsulta(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function raizToken(token: string): string {
  if (token.length <= 4) return token;
  return token.slice(0, token.length - 1);
}

function tokenCoincide(token: string, nombre: string): boolean {
  const texto = planoConsulta(nombre);
  if (texto.includes(token)) return true;
  const palabras = texto.split(/[^a-z0-9]+/).filter((palabra) => palabra.length >= 4);
  return palabras.some((palabra) => palabra.startsWith(token) || token.startsWith(palabra));
}

function pareceSeguimiento(texto: string, hayProducto: boolean): boolean {
  if (!hayProducto) return false;
  return /[?]|\b(como|cuanto|cuando|porque|sirve|puedo|podes|dilu\w*|esper\w*|manos?|sec\w*|aplic\w*|horas?|dias?|quedo|manch\w*|segund\w*|primer\w*|despues|listo)\b/i.test(
    planoConsulta(texto)
  );
}

async function familiasQueCoinciden(tokens: string[]): Promise<CoincidenciaConsulta[]> {
  const filas = await prisma.prodFamilia.findMany({
    where: {
      prodTiendas: { some: { habilitado: true } },
      AND: tokens.map((token) => ({
        familiaNombre: { contains: raizToken(token), mode: "insensitive" as const },
      })),
    },
    select: { id: true, familiaNombre: true },
    orderBy: { familiaNombre: "asc" },
    take: 20,
  });
  return filas
    .filter((fila) => tokens.every((token) => tokenCoincide(token, fila.familiaNombre)))
    .slice(0, 8)
    .map((fila) => ({ tipo: "familia" as const, id: fila.id, etiqueta: fila.familiaNombre }));
}

async function itemsQueCoinciden(tokens: string[]): Promise<CoincidenciaConsulta[]> {
  const filas = await prisma.prodPropio.findMany({
    where: {
      habilitado: true,
      AND: tokens.map((token) => ({
        descripcionTienda: { contains: raizToken(token), mode: "insensitive" as const },
      })),
    },
    select: {
      codTienda: true,
      descripcionTienda: true,
      familiaId: true,
      familia: { select: { familiaNombre: true } },
    },
    orderBy: { descripcionTienda: "asc" },
    take: 40,
  });
  const vistos = new Set<string>();
  const salida: CoincidenciaConsulta[] = [];
  for (const fila of filas) {
    const descripcion = (fila.descripcionTienda ?? "").trim();
    if (descripcion.length === 0 || !tokens.every((token) => tokenCoincide(token, descripcion))) continue;
    if (fila.familiaId && fila.familia) {
      if (vistos.has(fila.familiaId)) continue;
      vistos.add(fila.familiaId);
      salida.push({ tipo: "familia", id: fila.familiaId, etiqueta: fila.familia.familiaNombre });
    } else {
      salida.push({ tipo: "item", codTienda: fila.codTienda, etiqueta: descripcion });
    }
    if (salida.length === 8) break;
  }
  return salida;
}

/** Primero el nombre de la familia. Si no hay, la descripción del ítem. */
async function buscarCoincidenciasProducto(texto: string): Promise<CoincidenciaConsulta[]> {
  const tokens = tokensConsulta(texto);
  if (tokens.length === 0) return [];
  const familias = await familiasQueCoinciden(tokens);
  if (familias.length > 0) return familias;
  return itemsQueCoinciden(tokens);
}

async function codDeCoincidencia(opcion: CoincidenciaConsulta): Promise<string | null> {
  if (opcion.tipo === "item") return opcion.codTienda;
  const fila = await prisma.prodPropio.findFirst({
    where: { familiaId: opcion.id, habilitado: true, descripcionTienda: { not: "" } },
    select: { codTienda: true },
    orderBy: { descripcionTienda: "asc" },
  });
  return fila?.codTienda ?? null;
}

/**
 * Guarda el texto del usuario en el hilo abierto y responde en ese mismo hilo.
 */
export async function conversarConsultaTecnica(input: {
  personalId: number;
  conversacionId: string;
  texto: string;
}): Promise<
  ServiceResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem | null;
  }>
> {
  const guardado = await enviarMensajeConsultaTecnica(input);
  if (!guardado.success) return guardado;

  const hilo = await listarMensajesConsultaTecnica(input.conversacionId);
  const mensajes = hilo.success ? hilo.data : [guardado.data.mensaje];
  const descripcion = descripcionDelInstructivo(mensajes);
  if (!pareceSeguimiento(input.texto, descripcion != null)) {
    try {
      const coincidencias = await buscarCoincidenciasProducto(input.texto);
      if (coincidencias.length >= 2) {
        const respuesta = await guardarRespuesta(
          input.conversacionId,
          armarMensajeCoincidencias(coincidencias)
        );
        return { success: true, data: { ...guardado.data, respuesta } };
      }
      if (coincidencias.length === 1) {
        const codTienda = await codDeCoincidencia(coincidencias[0]);
        if (codTienda) {
          const armado = await instructivoDeItem(codTienda);
          const texto = armado.success ? instructivoConDatos(armado.data.texto) : null;
          if (texto) {
            const respuesta = await guardarRespuesta(input.conversacionId, texto);
            return { success: true, data: { ...guardado.data, respuesta } };
          }
        }
      }
    } catch (error: unknown) {
      console.error("[consultaTecnica][coincidencias]", error instanceof Error ? error.name : "error");
    }
  }
  let hoja = "";
  if (descripcion && hiloSinDatosDeHoja(mensajes)) {
    try {
      hoja = (await responderConHoja(descripcion)) ?? "";
    } catch (error: unknown) {
      console.error("[consultaTecnica][conversar] hoja", error instanceof Error ? error.name : "error");
    }
  } else if (descripcion) {
    const previo = mensajes.find(
      (mensaje) =>
        mensaje.autor === CONSULTA_TECNICA_AUTOR_SISTEMA && mensaje.texto.startsWith("Así se usa ")
    );
    hoja = previo?.texto ?? "";
  }

  const ultimo = mensajes.filter((mensaje) => mensaje.autor === CONSULTA_TECNICA_AUTOR_USUARIO).at(-1);
  const tokens = tokensConsulta(`${descripcion ?? ""} ${ultimo?.texto ?? input.texto}`);
  let listas = "No se pudieron leer las listas.";
  try {
    listas = await listasParaRecomendar(tokens);
  } catch (error: unknown) {
    console.error("[consultaTecnica][conversar] listas", error instanceof Error ? error.name : "error");
  }

  const contexto = mensajes
    .slice(-8)
    .map((mensaje) => `${mensaje.autor}: ${mensaje.texto}`)
    .join("\n");
  const pedido = [
    "Hilo:",
    contexto,
    "",
    hoja.length > 0
      ? `Hoja del ítem de esta consulta:\n${hoja}`
      : "No hay ficha de fabricante para el ítem de esta consulta. Respondé igual, con criterio de mostrador, y no lo presentes como ficha oficial.",
    "",
    listas,
    "",
    "Respondé el último mensaje del usuario.",
  ].join("\n");
  const completado = await completarConsultaTecnica({
    system: SISTEMA_CONVERSACION,
    user: pedido,
  });
  const respuestaTexto = completado.success ? textoSinCompletar(completado.data) : null;
  if (!completado.success) {
    console.error("[consultaTecnica][conversar] modelo", completado.error);
  }
  if (!respuestaTexto) {
    const aviso = completado.success ? null : completado.error;
    if (!aviso) return { success: true, data: { ...guardado.data, respuesta: null } };
    try {
      const respuesta = await guardarRespuesta(input.conversacionId, aviso);
      return { success: true, data: { ...guardado.data, respuesta } };
    } catch (error: unknown) {
      console.error("[consultaTecnica][conversar]", error instanceof Error ? error.name : "error");
      return { success: true, data: { ...guardado.data, respuesta: null } };
    }
  }

  try {
    const respuesta = await guardarRespuesta(input.conversacionId, respuestaTexto);
    return { success: true, data: { ...guardado.data, respuesta } };
  } catch (error: unknown) {
    console.error("[consultaTecnica][conversar]", error instanceof Error ? error.name : "error");
    return { success: true, data: { ...guardado.data, respuesta: null } };
  }
}

/** Foto en el hilo abierto. El modelo no la ve. */
export async function adjuntarFotoConsultaTecnica(input: {
  conversacionId: string;
  mime: string;
  bytes: Uint8Array;
}): Promise<
  ServiceResult<{
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem;
  }>
> {
  if (!imagenValida(input.mime, input.bytes)) {
    return { success: false, error: "La foto tiene que ser JPG, PNG o WEBP de hasta 4 MB." };
  }
  const existe = await prisma.consultaTecnicaConversacion.findUnique({
    where: { id: input.conversacionId },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "La consulta no existe." };

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const mensaje = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId: input.conversacionId,
          autor: CONSULTA_TECNICA_AUTOR_USUARIO,
          texto: CONSULTA_TECNICA_TEXTO_FOTO,
          imagenMime: input.mime,
          imagen: Buffer.from(input.bytes),
        },
        select: MENSAJE_SELECT,
      });
      const respuesta = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId: input.conversacionId,
          autor: CONSULTA_TECNICA_AUTOR_SISTEMA,
          texto: "Recibí la foto. Escribí qué querés saber de ella.",
        },
        select: MENSAJE_SELECT,
      });
      await tx.consultaTecnicaConversacion.update({
        where: { id: input.conversacionId },
        data: { updatedAt: new Date() },
      });
      return { mensaje, respuesta };
    });
    return {
      success: true,
      data: { mensaje: aMensaje(resultado.mensaje), respuesta: aMensaje(resultado.respuesta) },
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][foto]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo adjuntar la foto." };
  }
}

export async function leerImagenConsultaTecnica(
  mensajeId: string
): Promise<ServiceResult<{ mime: string; bytes: Uint8Array }>> {
  const fila = await prisma.consultaTecnicaMensaje.findUnique({
    where: { id: mensajeId },
    select: { imagenMime: true, imagen: true },
  });
  if (!fila?.imagen || !fila.imagenMime) return { success: false, error: "La foto no existe." };
  if (!(CONSULTA_TECNICA_IMAGEN_MIME as readonly string[]).includes(fila.imagenMime)) {
    return { success: false, error: "La foto no existe." };
  }
  return {
    success: true,
    data: { mime: fila.imagenMime, bytes: new Uint8Array(fila.imagen) },
  };
}

export type ItemConsultaTecnica = {
  codTienda: string;
  descripcion: string;
};

/** Ítems habilitados cuya descripción contiene todas las palabras. Máximo 15. */
export async function buscarItemsConsultaTecnica(
  q: string
): Promise<ServiceResult<ItemConsultaTecnica[]>> {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return { success: true, data: [] };

  try {
    const filas = await prisma.prodPropio.findMany({
      where: {
        habilitado: true,
        AND: tokens.map((token) => ({
          descripcionTienda: { contains: token, mode: "insensitive" as const },
        })),
      },
      select: { codTienda: true, descripcionTienda: true },
      orderBy: { descripcionTienda: "asc" },
      take: 15,
    });
    return {
      success: true,
      data: filas
        .map((fila) => ({
          codTienda: fila.codTienda,
          descripcion: (fila.descripcionTienda ?? "").trim(),
        }))
        .filter((fila) => fila.descripcion.length > 0),
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][buscar]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo buscar el ítem." };
  }
}

const DIAS_MEMORIA_FICHA = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

function resumenUtil(resumen: ResumenHojaFabricante): boolean {
  return (
    resumen.preparacion.trim().length > 0 ||
    resumen.aplicacion.trim().length > 0 ||
    resumen.urlFicha.trim().length > 0
  );
}

async function fichaCargadaDeFamilia(familia: {
  id: string;
  fichaUrl: string | null;
  fichaPdfNombre: string | null;
}): Promise<FichaCargadaConsulta | undefined> {
  const url = (familia.fichaUrl ?? "").trim();
  const urlOk = /^https?:\/\//i.test(url) ? url : "";
  let pdf: Uint8Array | null = null;
  if (familia.fichaPdfNombre) {
    const archivo = await prisma.prodFamilia.findUnique({
      where: { id: familia.id },
      select: { fichaPdf: true },
    });
    if (archivo?.fichaPdf && archivo.fichaPdf.byteLength > 0) {
      pdf = new Uint8Array(archivo.fichaPdf);
    }
  }
  if (!pdf && urlOk.length === 0) return undefined;
  return { url: urlOk, pdf };
}

function memoriaVigente(fecha: Date): boolean {
  return Date.now() - fecha.getTime() < DIAS_MEMORIA_FICHA * MS_DIA;
}

const ESTILO_USO = "v3|";
const TOPE_COLUMNA_DILUCION = 500;
const TOPE_COLUMNA_SECADO = 300;

function resumenGuardado(fila: {
  preparacion: string;
  dilucion: string;
  secadoEntreManos: string;
  secadoFinal: string;
  urlFicha: string;
}): ResumenHojaFabricante {
  const v3 = fila.preparacion.startsWith(ESTILO_USO);
  const aplicacion = v3
    ? `${fila.dilucion}${fila.secadoEntreManos}${fila.secadoFinal}`
    : [fila.dilucion, fila.secadoEntreManos, fila.secadoFinal]
        .map((parte) => parte.trim())
        .filter((parte) => parte.length > 0)
        .join(" ");
  return {
    preparacion: fila.preparacion.replace(/^v\d+\|/, ""),
    aplicacion: aplicacion.replace(/\s+/g, " ").trim(),
    urlFicha: fila.urlFicha,
  };
}

function campoGuardado(valor: string, tope: number): string {
  const texto = valor.replace(/\s+/g, " ").trim();
  if (texto.length === 0 || texto.includes("[COMPLETAR]")) return "";
  return texto.slice(0, tope);
}

/** El párrafo de aplicación se parte en las columnas que ya existen. No hay migración. */
function partirAplicacion(texto: string): {
  dilucion: string;
  secadoEntreManos: string;
  secadoFinal: string;
} {
  const desdeSecado = TOPE_COLUMNA_DILUCION;
  const desdeFinal = TOPE_COLUMNA_DILUCION + TOPE_COLUMNA_SECADO;
  return {
    dilucion: texto.slice(0, desdeSecado),
    secadoEntreManos: texto.slice(desdeSecado, desdeFinal),
    secadoFinal: texto.slice(desdeFinal, desdeFinal + TOPE_COLUMNA_SECADO),
  };
}

function paraGuardar(resumen: ResumenHojaFabricante) {
  const partes = partirAplicacion(campoGuardado(resumen.aplicacion, 900));
  return {
    urlFicha: campoGuardado(resumen.urlFicha, 500),
    preparacion: `${ESTILO_USO}${campoGuardado(resumen.preparacion, 497)}`.slice(0, 500),
    dilucion: partes.dilucion,
    secadoEntreManos: partes.secadoEntreManos,
    secadoFinal: partes.secadoFinal,
  };
}

function aplicacionCacheOk(texto: string): boolean {
  const limpio = texto.trim();
  if (limpio.length === 0 || !/dilu/i.test(limpio)) return true;
  return limpio.includes("%") || /pur[ao]|sin diluir/i.test(limpio);
}

async function instructivoDeItem(
  codTienda: string
): Promise<ServiceResult<{ texto: string; descripcion: string }>> {
  const item = await prisma.prodPropio.findUnique({
    where: { codTienda },
    select: {
      habilitado: true,
      descripcionTienda: true,
      idMarca: true,
      familia: { select: { id: true, fichaUrl: true, fichaPdfNombre: true } },
      marcaRelation: { select: { nombre: true } },
    },
  });
  const descripcion = (item?.descripcionTienda ?? "").trim();
  if (!item || !item.habilitado || descripcion.length === 0) {
    return { success: false, error: "El ítem no está habilitado." };
  }

  const clave = item.familia ? claveFichaDeFlia(item.familia.id) : claveFichaDeSku(codTienda);
  const guardada = await prisma.consultaTecnicaFicha.findUnique({ where: { clave } });
  const cache = guardada ? resumenGuardado(guardada) : null;
  let resumen: ResumenHojaFabricante;
  const estiloNuevo = (guardada?.preparacion ?? "").startsWith(ESTILO_USO);
  if (
    guardada &&
    cache &&
    memoriaVigente(guardada.updatedAt) &&
    resumenUtil(cache) &&
    aplicacionCacheOk(cache.aplicacion) &&
    estiloNuevo
  ) {
    resumen = cache;
  } else {
    const fichaCargada = item.familia ? await fichaCargadaDeFamilia(item.familia) : undefined;
    const leida = await resumirHojaFabricante({
      descripcion,
      marca: item.marcaRelation?.nombre ?? "",
      fichaCargada,
    });
    if (leida.guardar && resumenUtil(leida.resumen)) {
      const datos = paraGuardar(leida.resumen);
      await prisma.consultaTecnicaFicha.upsert({
        where: { clave },
        create: { clave, idMarca: item.idMarca, ...datos },
        update: datos,
      });
      resumen = leida.resumen;
    } else if (guardada) {
      resumen = resumenGuardado(guardada);
    } else {
      resumen = leida.resumen;
    }
  }

  const texto = armarInstructivoFichaItem({
    descripcion,
    preparacion: resumen.preparacion,
    aplicacion: resumen.aplicacion,
    urlFicha: resumen.urlFicha,
  });
  if (texto.length > 2000) return { success: false, error: "El instructivo es demasiado largo." };
  return { success: true, data: { texto, descripcion } };
}

/**
 * Abre un hilo de cómo usar un producto. El instructivo sale de la hoja del fabricante.
 * Los SKU del mismo producto (otro tamaño, color o terminación) reusan la misma hoja.
 * Si un párrafo no está en la hoja, no se escribe.
 */
export async function crearFichaItemConsultaTecnica(input: {
  personalId: number;
  codTienda: string;
}): Promise<
  ServiceResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
  }>
> {
  try {
    const personal = await prisma.globalPersonal.findUnique({
      where: { idPersonal: input.personalId },
      select: { idPersonal: true },
    });
    if (!personal) return { success: false, error: "El usuario de la sesión no existe." };

    const armado = await instructivoDeItem(input.codTienda);
    if (!armado.success) return armado;

    const resultado = await prisma.$transaction(async (tx) => {
      const creada = await tx.consultaTecnicaConversacion.create({
        data: { tipo: CONSULTA_TECNICA_TIPO_FICHA, personalId: input.personalId },
        select: { id: true },
      });
      const mensaje = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId: creada.id,
          autor: CONSULTA_TECNICA_AUTOR_SISTEMA,
          texto: armado.data.texto,
        },
        select: MENSAJE_SELECT,
      });
      const conversacion = await tx.consultaTecnicaConversacion.update({
        where: { id: creada.id },
        data: { updatedAt: new Date() },
        include: { personal: { select: { nombrePersonal: true } } },
      });
      return { conversacion, mensaje };
    });

    return {
      success: true,
      data: {
        conversacion: aConversacion(resultado.conversacion),
        mensaje: aMensaje(resultado.mensaje),
      },
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][ficha]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo armar el instructivo." };
  }
}

/** El botón de una coincidencia abre la ficha de esa familia o de ese ítem. */
export async function elegirCoincidenciaConsultaTecnica(
  input:
    | { conversacionId: string; tipo: "familia"; id: string }
    | { conversacionId: string; tipo: "item"; codTienda: string }
): Promise<
  ServiceResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem;
  }>
> {
  const codTienda =
    input.tipo === "item" ? input.codTienda : await codDeCoincidencia({ tipo: "familia", id: input.id, etiqueta: "" });
  if (!codTienda) return { success: false, error: "Esa familia no tiene un ítem habilitado." };
  return agregarItemConsultaTecnica({ conversacionId: input.conversacionId, codTienda });
}

/** Suma la ficha de otro ítem al hilo que ya está abierto. */
export async function agregarItemConsultaTecnica(input: {
  conversacionId: string;
  codTienda: string;
}): Promise<
  ServiceResult<{
    conversacion: ConsultaTecnicaConversacionItem;
    mensaje: ConsultaTecnicaMensajeItem;
    respuesta: ConsultaTecnicaMensajeItem;
  }>
> {
  const existe = await prisma.consultaTecnicaConversacion.findUnique({
    where: { id: input.conversacionId },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "La consulta no existe." };

  const armado = await instructivoDeItem(input.codTienda);
  if (!armado.success) return armado;
  const consulta = `Consulto sobre ${armado.data.descripcion}.`.slice(0, 2000);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const mensaje = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId: input.conversacionId,
          autor: CONSULTA_TECNICA_AUTOR_USUARIO,
          texto: consulta,
        },
        select: MENSAJE_SELECT,
      });
      const respuesta = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId: input.conversacionId,
          autor: CONSULTA_TECNICA_AUTOR_SISTEMA,
          texto: armado.data.texto,
        },
        select: MENSAJE_SELECT,
      });
      const conversacion = await tx.consultaTecnicaConversacion.update({
        where: { id: input.conversacionId },
        data: { updatedAt: new Date() },
        include: { personal: { select: { nombrePersonal: true } } },
      });
      return { conversacion, mensaje, respuesta };
    });
    return {
      success: true,
      data: {
        conversacion: aConversacion(resultado.conversacion),
        mensaje: aMensaje(resultado.mensaje),
        respuesta: aMensaje(resultado.respuesta),
      },
    };
  } catch (error: unknown) {
    console.error("[consultaTecnica][item]", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo sumar el ítem a la consulta." };
  }
}
