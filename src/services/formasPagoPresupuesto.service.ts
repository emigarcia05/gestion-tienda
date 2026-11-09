import { Prisma } from "@prisma/client";
import { esCobroNotaCreditoNombre } from "@/lib/factura";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export type TextoFormaPagoPresupuesto = {
  id: string;
  descTexto: string;
  orden: number;
  formas: { pagoId: string; nombre: string }[];
};

const includeFormas = {
  formas: {
    orderBy: { orden: "asc" as const },
    include: { pago: { select: { id: true, nombre: true } } },
  },
};

function mapFila(
  row: Prisma.PresupuestoFormaPagoTextoGetPayload<{ include: typeof includeFormas }>
): TextoFormaPagoPresupuesto {
  return {
    id: row.id,
    descTexto: row.descTexto,
    orden: row.orden,
    formas: row.formas.map((forma) => ({
      pagoId: forma.pago.id,
      nombre: forma.pago.nombre,
    })),
  };
}

function esUnico(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function validarPagos(
  pagoIds: readonly string[]
): Promise<ServiceResult<string[]>> {
  const pagos = await prisma.finAnaCosFinaPagoCat.findMany({
    where: { id: { in: [...pagoIds] } },
    select: { id: true, nombre: true },
  });
  if (pagos.length !== pagoIds.length) {
    return { success: false, error: "Hay una forma de pago que ya no existe." };
  }
  if (pagos.some((pago) => esCobroNotaCreditoNombre(pago.nombre))) {
    return { success: false, error: "NOTA DE CRÉDITO no se imprime en el presupuesto." };
  }
  return { success: true, data: [...pagoIds] };
}

export async function listarTextosFormasPagoPresupuesto(): Promise<TextoFormaPagoPresupuesto[]> {
  const rows = await prisma.presupuestoFormaPagoTexto.findMany({
    orderBy: { orden: "asc" },
    include: includeFormas,
  });
  return rows.map(mapFila);
}

export async function crearTextoFormaPagoPresupuesto(input: {
  descTexto: string;
  pagoIds: string[];
}): Promise<ServiceResult<void>> {
  const pagos = await validarPagos(input.pagoIds);
  if (!pagos.success) return pagos;
  const max = await prisma.presupuestoFormaPagoTexto.aggregate({ _max: { orden: true } });
  try {
    await prisma.presupuestoFormaPagoTexto.create({
      data: {
        descTexto: input.descTexto,
        orden: (max._max.orden ?? 0) + 1,
        formas: {
          create: pagos.data.map((pagoId, orden) => ({ pagoId, orden })),
        },
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
  descTexto: string;
  pagoIds: string[];
}): Promise<ServiceResult<void>> {
  const pagos = await validarPagos(input.pagoIds);
  if (!pagos.success) return pagos;
  const existe = await prisma.presupuestoFormaPagoTexto.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!existe) return { success: false, error: "El ítem no existe." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.presupuestoFormaPagoTexto.update({
        where: { id: input.id },
        data: { descTexto: input.descTexto },
      });
      await tx.presupuestoFormaPagoTextoForma.deleteMany({ where: { textoId: input.id } });
      await tx.presupuestoFormaPagoTextoForma.createMany({
        data: pagos.data.map((pagoId, orden) => ({
          textoId: input.id,
          pagoId,
          orden,
        })),
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
