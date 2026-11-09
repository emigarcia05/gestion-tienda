import { Prisma } from "@prisma/client";
import { esCobroNotaCreditoNombre } from "@/lib/factura";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types";

export type TextoFormaPagoPresupuesto = {
  id: string;
  descuento: number;
  orden: number;
  formas: {
    pagoId: string;
    nombre: string;
    cuotas: { cuotaId: string; nombre: string }[];
  }[];
};

export type VinculoFormaPagoPresupuestoInput = {
  pagoId: string;
  cuotaIds: string[];
};

const includeFormas = {
  formas: {
    orderBy: { orden: "asc" as const },
    include: {
      pago: { select: { id: true, nombre: true } },
      cuotas: {
        orderBy: { orden: "asc" as const },
        include: { cuota: { select: { id: true, cuotas: true } } },
      },
    },
  },
};

function mapFila(
  row: Prisma.PresupuestoFormaPagoTextoGetPayload<{ include: typeof includeFormas }>
): TextoFormaPagoPresupuesto {
  return {
    id: row.id,
    descuento: row.descuento,
    orden: row.orden,
    formas: row.formas.map((forma) => ({
      pagoId: forma.pago.id,
      nombre: forma.pago.nombre,
      cuotas: forma.cuotas.map((cuota) => ({
        cuotaId: cuota.cuota.id,
        nombre: cuota.cuota.cuotas,
      })),
    })),
  };
}

function esUnico(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function validarVinculos(
  vinculos: readonly VinculoFormaPagoPresupuestoInput[]
): Promise<ServiceResult<VinculoFormaPagoPresupuestoInput[]>> {
  const pagoIds = vinculos.map((vinculo) => vinculo.pagoId);
  if (new Set(pagoIds).size !== pagoIds.length) {
    return { success: false, error: "Hay una forma de pago repetida." };
  }
  const pagos = await prisma.finAnaCosFinaPagoCat.findMany({
    where: { id: { in: pagoIds } },
    select: { id: true, nombre: true },
  });
  if (pagos.length !== pagoIds.length) {
    return { success: false, error: "Hay una forma de pago que ya no existe." };
  }
  if (pagos.some((pago) => esCobroNotaCreditoNombre(pago.nombre))) {
    return { success: false, error: "NOTA DE CRÉDITO no se imprime en el presupuesto." };
  }
  const nombres = new Map(pagos.map((pago) => [pago.id, pago.nombre]));
  const catalogo = await prisma.cobrosCuotaVinculo.findMany({
    where: { pagoId: { in: pagoIds } },
    select: { pagoId: true, cuotaId: true },
  });
  const cuotasPorPago = new Map<string, Set<string>>();
  for (const fila of catalogo) {
    const actuales = cuotasPorPago.get(fila.pagoId) ?? new Set<string>();
    actuales.add(fila.cuotaId);
    cuotasPorPago.set(fila.pagoId, actuales);
  }

  const normalizados: VinculoFormaPagoPresupuestoInput[] = [];
  for (const vinculo of vinculos) {
    const nombre = nombres.get(vinculo.pagoId) ?? "la forma de pago";
    const permitidas = cuotasPorPago.get(vinculo.pagoId) ?? new Set<string>();
    const cuotaIds = [...new Set(vinculo.cuotaIds)];
    if (permitidas.size === 0) {
      normalizados.push({ pagoId: vinculo.pagoId, cuotaIds: [] });
      continue;
    }
    if (cuotaIds.length === 0) {
      return { success: false, error: `Elegí al menos una cuota de ${nombre}.` };
    }
    if (cuotaIds.some((cuotaId) => !permitidas.has(cuotaId))) {
      return { success: false, error: `Hay una cuota que no corresponde a ${nombre}.` };
    }
    normalizados.push({ pagoId: vinculo.pagoId, cuotaIds });
  }
  return { success: true, data: normalizados };
}

function dataFormas(vinculos: readonly VinculoFormaPagoPresupuestoInput[]) {
  return vinculos.map((vinculo, orden) => ({
    pagoId: vinculo.pagoId,
    orden,
    cuotas: {
      create: vinculo.cuotaIds.map((cuotaId, indice) => ({ cuotaId, orden: indice })),
    },
  }));
}

export async function listarTextosFormasPagoPresupuesto(): Promise<TextoFormaPagoPresupuesto[]> {
  const rows = await prisma.presupuestoFormaPagoTexto.findMany({
    orderBy: { orden: "asc" },
    include: includeFormas,
  });
  return rows.map(mapFila);
}

export async function crearTextoFormaPagoPresupuesto(input: {
  descuento: number;
  vinculos: VinculoFormaPagoPresupuestoInput[];
}): Promise<ServiceResult<void>> {
  const vinculos = await validarVinculos(input.vinculos);
  if (!vinculos.success) return vinculos;
  const max = await prisma.presupuestoFormaPagoTexto.aggregate({ _max: { orden: true } });
  try {
    await prisma.presupuestoFormaPagoTexto.create({
      data: {
        descuento: input.descuento,
        orden: (max._max.orden ?? 0) + 1,
        formas: { create: dataFormas(vinculos.data) },
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
  vinculos: VinculoFormaPagoPresupuestoInput[];
}): Promise<ServiceResult<void>> {
  const vinculos = await validarVinculos(input.vinculos);
  if (!vinculos.success) return vinculos;
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
      await tx.presupuestoFormaPagoTextoForma.deleteMany({ where: { textoId: input.id } });
      for (const forma of dataFormas(vinculos.data)) {
        await tx.presupuestoFormaPagoTextoForma.create({
          data: { ...forma, textoId: input.id },
        });
      }
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
