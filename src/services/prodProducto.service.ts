import { Prisma } from "@prisma/client";
import { filtroTexto } from "@/lib/busqueda";
import type { FamiliaCatalogoItem, ItemSelectorFamilia } from "@/lib/listaProductos";
import { prisma } from "@/lib/prisma";
import type {
  CrearFamiliaInput,
  EditarFamiliaInput,
} from "@/lib/validations/listaProductos";
import type { ServiceResult } from "@/types";

function nombreFamiliaOcupado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Vincula el ítem a la familia de ese nombre. Si no existe, la crea.
 * Nombre vacío: el ítem queda sin familia y el catálogo no se borra.
 */
export async function resolverFamiliaId(
  tx: Prisma.TransactionClient,
  nombre: string
): Promise<string | null> {
  if (nombre.length === 0) return null;
  const existente = await tx.prodFamilia.findUnique({
    where: { familiaNombre: nombre },
    select: { id: true },
  });
  if (existente) return existente.id;
  try {
    const creada = await tx.prodFamilia.create({
      data: { familiaNombre: nombre },
      select: { id: true },
    });
    return creada.id;
  } catch (error: unknown) {
    if (!nombreFamiliaOcupado(error)) throw error;
    const otra = await tx.prodFamilia.findUnique({
      where: { familiaNombre: nombre },
      select: { id: true },
    });
    if (otra) return otra.id;
    throw error;
  }
}

/** Descripciones de los ítems de la familia con ese nombre. */
export async function listarDescripcionesFliaItem(
  nombre: string
): Promise<ServiceResult<{ descripciones: string[] }>> {
  const limpio = nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
  if (limpio.length === 0) return { success: true, data: { descripciones: [] } };
  try {
    const familia = await prisma.prodFamilia.findUnique({
      where: { familiaNombre: limpio },
      select: {
        prodTiendas: {
          select: { descripcionTienda: true },
          orderBy: { descripcionTienda: "asc" },
          take: 50,
        },
      },
    });
    return {
      success: true,
      data: {
        descripciones:
          familia?.prodTiendas
            .map((fila) => (fila.descripcionTienda ?? "").trim())
            .filter((descripcion) => descripcion.length > 0) ?? [],
      },
    };
  } catch (error: unknown) {
    console.error("[prodProducto] flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudieron leer los ítems de la familia." };
  }
}

/** Catálogo para Gestionar Familias. Las descripciones alimentan el buscador. */
export async function listarFamiliasCatalogo(): Promise<FamiliaCatalogoItem[]> {
  const filas = await prisma.prodFamilia.findMany({
    orderBy: { familiaNombre: "asc" },
    select: {
      id: true,
      familiaNombre: true,
      prodTiendas: {
        select: { descripcionTienda: true },
        orderBy: { descripcionTienda: "asc" },
      },
    },
  });
  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.familiaNombre,
    descripciones: fila.prodTiendas
      .map((item) => (item.descripcionTienda ?? "").trim())
      .filter((descripcion) => descripcion.length > 0),
  }));
}

export async function crearFamilia(input: CrearFamiliaInput): Promise<ServiceResult<{ id: string }>> {
  try {
    const creada = await prisma.prodFamilia.create({
      data: { familiaNombre: input.nombre },
      select: { id: true },
    });
    return { success: true, data: { id: creada.id } };
  } catch (error: unknown) {
    if (nombreFamiliaOcupado(error)) {
      return { success: false, error: "Ya existe una familia con ese nombre." };
    }
    console.error("[prodProducto] crear flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo crear la familia." };
  }
}

export async function editarFamilia(input: EditarFamiliaInput): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.prodFamilia.update({
      where: { id: input.id },
      data: { familiaNombre: input.nombre },
    });
    return { success: true, data: { id: input.id } };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "La familia ya no existe." };
    }
    if (nombreFamiliaOcupado(error)) {
      return { success: false, error: "Ya existe una familia con ese nombre." };
    }
    console.error("[prodProducto] editar flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo guardar la familia." };
  }
}

const SELECTOR_FAMILIA_LIMITE = 300;

/** Ítems habilitados para el selector. Con búsqueda vacía, los de la familia van primero. */
export async function listarItemsSelectorFamilia(input: {
  id: string;
  q: string;
}): Promise<ItemSelectorFamilia[]> {
  const parts: Prisma.ProdPropioWhereInput[] = [{ habilitado: true }];
  const textFilter = filtroTexto(input.q, ["descripcionTienda", "codTienda"]);
  if (textFilter.AND?.length) parts.push(textFilter);
  const buscados = await prisma.prodPropio.findMany({
    where: { AND: parts },
    orderBy: { descripcionTienda: "asc" },
    take: SELECTOR_FAMILIA_LIMITE,
    select: { codTienda: true, descripcionTienda: true, familiaId: true },
  });
  const qVacia = input.q.trim().length === 0;
  const miembros = qVacia
    ? await prisma.prodPropio.findMany({
        where: { familiaId: input.id },
        orderBy: { descripcionTienda: "asc" },
        select: { codTienda: true, descripcionTienda: true, familiaId: true },
      })
    : [];
  const porCodigo = new Map<string, (typeof buscados)[number]>();
  for (const miembro of miembros) porCodigo.set(miembro.codTienda, miembro);
  for (const fila of buscados) {
    if (!porCodigo.has(fila.codTienda)) porCodigo.set(fila.codTienda, fila);
  }
  return [...porCodigo.values()].map((fila) => ({
    codTienda: fila.codTienda,
    descripcion: (fila.descripcionTienda ?? "").trim(),
    enFamilia: fila.familiaId === input.id,
  }));
}

/**
 * Los códigos elegidos quedan en la familia. Los que ya estaban y no vienen en la lista, salen.
 * Un ítem que estaba en otra familia pasa a esta.
 */
export async function guardarItemsFamilia(input: {
  id: string;
  codTiendas: string[];
}): Promise<ServiceResult<{ id: string }>> {
  try {
    const familia = await prisma.prodFamilia.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!familia) return { success: false, error: "La familia ya no existe." };
    const codigos = [...new Set(input.codTiendas)];
    await prisma.$transaction(async (tx) => {
      await tx.prodPropio.updateMany({
        where: {
          familiaId: input.id,
          ...(codigos.length > 0 ? { codTienda: { notIn: codigos } } : {}),
        },
        data: { familiaId: null },
      });
      if (codigos.length > 0) {
        await tx.prodPropio.updateMany({
          where: { codTienda: { in: codigos } },
          data: { familiaId: input.id },
        });
      }
    });
    return { success: true, data: { id: input.id } };
  } catch (error: unknown) {
    console.error("[prodProducto] items flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudieron guardar los ítems de la familia." };
  }
}

/** Borra la familia. Los ítems quedan sin vínculo (`ON DELETE SET NULL`). */
export async function eliminarFamilia(id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.prodFamilia.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "La familia ya no existe." };
    }
    console.error("[prodProducto] borrar flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo borrar la familia." };
  }
}
