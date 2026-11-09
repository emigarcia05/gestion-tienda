import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export type TextoFormaPagoPresupuesto = {
  id: string;
  descuento: number;
  orden: number;
  formas: string[];
};

const includeLineas = {
  lineas: { orderBy: { orden: "asc" as const } },
};

function mapFila(
  row: Prisma.PresupuestoFormaPagoTextoGetPayload<{ include: typeof includeLineas }>
): TextoFormaPagoPresupuesto {
  return {
    id: row.id,
    descuento: row.descuento,
    orden: row.orden,
    formas: row.lineas.map((linea) => linea.texto),
  };
}

function esUnico(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function dataLineas(formas: readonly string[]) {
  return formas.map((texto, orden) => ({ orden, texto }));
}

export async function listarTextosFormasPagoPresupuesto(): Promise<TextoFormaPagoPresupuesto[]> {
  const rows = await prisma.presupuestoFormaPagoTexto.findMany({
    orderBy: { orden: "asc" },
    include: includeLineas,
  });
  return rows.map(mapFila);
}

export async function crearTextoFormaPagoPresupuesto(input: {
  descuento: number;
  formas: string[];
}): Promise<ServiceResult<void>> {
  const max = await prisma.presupuestoFormaPagoTexto.aggregate({ _max: { orden: true } });
  try {
    await prisma.presupuestoFormaPagoTexto.create({
      data: {
        descuento: input.descuento,
        orden: (max._max.orden ?? 0) + 1,
        lineas: { create: dataLineas(input.formas) },
      },
    });
    return { success: true, data: undefined };
  } catch (error) {
    if (esUnico(error)) {
      return { success: false, error: "Ya existe un ítem con ese DESC." };
    }
    console.error("[formasPagoPresupuesto.service] crear:", error);
    return { success: false, error: "No se pudo crear el ítem." };
  }
}

export async function editarTextoFormaPagoPresupuesto(input: {
  id: string;
  descuento: number;
  formas: string[];
}): Promise<ServiceResult<void>> {
  const existe = await prisma.presupuestoFormaPagoTexto.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "El ítem no existe." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.presupuestoFormaPagoTexto.update({
        where: { id: input.id },
        data: { descuento: input.descuento },
      });
      await tx.presupuestoFormaPagoTextoLinea.deleteMany({ where: { textoId: input.id } });
      await tx.presupuestoFormaPagoTextoLinea.createMany({
        data: dataLineas(input.formas).map((linea) => ({ ...linea, textoId: input.id })),
      });
    });
    return { success: true, data: undefined };
  } catch (error) {
    if (esUnico(error)) {
      return { success: false, error: "Ya existe un ítem con ese DESC." };
    }
    console.error("[formasPagoPresupuesto.service] editar:", error);
    return { success: false, error: "No se pudo guardar el ítem." };
  }
}

export async function eliminarTextoFormaPagoPresupuesto(id: string): Promise<ServiceResult<void>> {
  const existe = await prisma.presupuestoFormaPagoTexto.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "El ítem no existe." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.presupuestoFormaPagoTexto.delete({ where: { id } });
      const rows = await tx.presupuestoFormaPagoTexto.findMany({
        orderBy: { orden: "asc" },
        select: { id: true },
      });
      for (const [indice, row] of rows.entries()) {
        await tx.presupuestoFormaPagoTexto.update({
          where: { id: row.id },
          data: { orden: 1_000_000 + indice },
        });
      }
      for (const [indice, row] of rows.entries()) {
        await tx.presupuestoFormaPagoTexto.update({
          where: { id: row.id },
          data: { orden: indice + 1 },
        });
      }
    });
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[formasPagoPresupuesto.service] eliminar:", error);
    return { success: false, error: "No se pudo eliminar el ítem." };
  }
}

export async function moverTextoFormaPagoPresupuesto(
  id: string,
  direccion: "subir" | "bajar"
): Promise<ServiceResult<void>> {
  const actual = await prisma.presupuestoFormaPagoTexto.findUnique({
    where: { id },
    select: { id: true, orden: true },
  });
  if (!actual) return { success: false, error: "El ítem no existe." };
  const vecino = await prisma.presupuestoFormaPagoTexto.findFirst({
    where: { orden: direccion === "subir" ? { lt: actual.orden } : { gt: actual.orden } },
    orderBy: { orden: direccion === "subir" ? "desc" : "asc" },
    select: { id: true, orden: true },
  });
  if (!vecino) return { success: true, data: undefined };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.presupuestoFormaPagoTexto.update({
        where: { id: actual.id },
        data: { orden: 1_000_000 + actual.orden },
      });
      await tx.presupuestoFormaPagoTexto.update({
        where: { id: vecino.id },
        data: { orden: actual.orden },
      });
      await tx.presupuestoFormaPagoTexto.update({
        where: { id: actual.id },
        data: { orden: vecino.orden },
      });
    });
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[formasPagoPresupuesto.service] mover:", error);
    return { success: false, error: "No se pudo reordenar el ítem." };
  }
}
