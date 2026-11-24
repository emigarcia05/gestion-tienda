import "server-only";

import { Prisma } from "@prisma/client";
import type {
  ConsultaTecnicaPagina,
  ConsultaTecnicaRecomendacionItem,
} from "@/lib/consultaTecnica";
import { prisma } from "@/lib/prisma";
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
