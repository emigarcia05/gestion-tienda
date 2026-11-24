import "server-only";

import { Prisma } from "@prisma/client";
import {
  CONSULTA_TECNICA_AUTOR_SISTEMA,
  CONSULTA_TECNICA_AUTOR_USUARIO,
  CONSULTA_TECNICA_TIPO,
  CONSULTA_TECNICA_TIPO_FICHA,
  armarInstructivoFichaItem,
  etiquetaTipoConsultaTecnica,
  type ConsultaTecnicaConversacionItem,
  type ConsultaTecnicaMensajeItem,
  type ConsultaTecnicaPagina,
  type ConsultaTecnicaRecomendacionItem,
} from "@/lib/consultaTecnica";
import { claveFichaDeFlia, claveFichaDeProducto } from "@/lib/prodProducto";
import { prisma } from "@/lib/prisma";
import { asignarProductoDeSku } from "@/services/prodProducto.service";
import {
  resumirHojaFabricante,
  type ResumenHojaFabricante,
} from "@/services/consultaTecnicaInstructivo.service";
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
  updatedAt: Date;
  personal: { nombrePersonal: string };
}): ConsultaTecnicaConversacionItem {
  return {
    id: fila.id,
    tipo: fila.tipo,
    tipoEtiqueta: etiquetaTipoConsultaTecnica(fila.tipo),
    usuario: fila.personal.nombrePersonal,
    actualizadoEnIso: fila.updatedAt.toISOString(),
  };
}

function aMensaje(fila: {
  id: string;
  autor: string;
  texto: string;
  createdAt: Date;
}): ConsultaTecnicaMensajeItem {
  return {
    id: fila.id,
    autor: fila.autor,
    texto: fila.texto,
    creadoEnIso: fila.createdAt.toISOString(),
  };
}

/** Hilos, el más reciente primero. */
export async function listarConversacionesConsultaTecnica(): Promise<
  ConsultaTecnicaConversacionItem[]
> {
  const filas = await prisma.consultaTecnicaConversacion.findMany({
    include: { personal: { select: { nombrePersonal: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return filas.map(aConversacion);
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

function memoriaVigente(fecha: Date): boolean {
  return Date.now() - fecha.getTime() < DIAS_MEMORIA_FICHA * MS_DIA;
}

function resumenGuardado(fila: {
  preparacion: string;
  dilucion: string;
  secadoEntreManos: string;
  secadoFinal: string;
  urlFicha: string;
}): ResumenHojaFabricante {
  return {
    preparacion: fila.preparacion,
    dilucion: fila.dilucion,
    secadoEntreManos: fila.secadoEntreManos,
    secadoFinal: fila.secadoFinal,
    urlFicha: fila.urlFicha,
  };
}

function campoGuardado(valor: string, tope: number): string {
  const texto = valor.replace(/\s+/g, " ").trim();
  if (texto.length === 0 || texto.includes("[COMPLETAR]")) return "";
  return texto.slice(0, tope);
}

function paraGuardar(resumen: ResumenHojaFabricante) {
  return {
    urlFicha: campoGuardado(resumen.urlFicha, 500),
    preparacion: campoGuardado(resumen.preparacion, 500),
    dilucion: campoGuardado(resumen.dilucion, 500),
    secadoEntreManos: campoGuardado(resumen.secadoEntreManos, 300),
    secadoFinal: campoGuardado(resumen.secadoFinal, 300),
  };
}

/**
 * Abre un hilo de ficha técnica. El instructivo sale de la hoja del fabricante.
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

    const item = await prisma.prodPropio.findUnique({
      where: { codTienda: input.codTienda },
      select: {
        habilitado: true,
        descripcionTienda: true,
        idMarca: true,
        idProducto: true,
        codFliaItem: true,
        marcaRelation: { select: { nombre: true } },
      },
    });
    const descripcion = (item?.descripcionTienda ?? "").trim();
    if (!item || !item.habilitado || descripcion.length === 0) {
      return { success: false, error: "El ítem no está habilitado." };
    }

    let idProducto = item.idProducto;
    if (!idProducto) {
      const asignado = await prisma.$transaction((tx) =>
        asignarProductoDeSku(tx, input.codTienda, { codMismoProducto: null, soltar: false })
      );
      if (!asignado.ok) {
        if (!item.codFliaItem) return { success: false, error: asignado.error };
      } else {
        const ligado = await prisma.prodPropio.findUnique({
          where: { codTienda: input.codTienda },
          select: { idProducto: true },
        });
        idProducto = ligado?.idProducto ?? null;
      }
    }
    if (!idProducto && !item.codFliaItem) {
      return { success: false, error: "El ítem no tiene producto." };
    }
    const clave = item.codFliaItem
      ? claveFichaDeFlia(item.codFliaItem)
      : claveFichaDeProducto(idProducto ?? "");
    const guardada = await prisma.consultaTecnicaFicha.findUnique({
      where: { clave },
    });
    let resumen: ResumenHojaFabricante;
    if (guardada && memoriaVigente(guardada.updatedAt)) {
      resumen = resumenGuardado(guardada);
    } else {
      const leida = await resumirHojaFabricante({
        descripcion,
        marca: item.marcaRelation?.nombre ?? "",
      });
      if (leida.guardar) {
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
      dilucion: resumen.dilucion,
      secadoEntreManos: resumen.secadoEntreManos,
      secadoFinal: resumen.secadoFinal,
      urlFicha: resumen.urlFicha,
    });
    if (texto.length > 2000) {
      return { success: false, error: "El instructivo es demasiado largo." };
    }
    const resultado = await prisma.$transaction(async (tx) => {
      const creada = await tx.consultaTecnicaConversacion.create({
        data: { tipo: CONSULTA_TECNICA_TIPO_FICHA, personalId: input.personalId },
        select: { id: true },
      });
      const mensaje = await tx.consultaTecnicaMensaje.create({
        data: {
          conversacionId: creada.id,
          autor: CONSULTA_TECNICA_AUTOR_SISTEMA,
          texto,
        },
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
