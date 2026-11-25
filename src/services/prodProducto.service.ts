import { Prisma } from "@prisma/client";
import type { FamiliaCatalogoItem } from "@/lib/listaProductos";
import { normalizarCodFliaItem, textoCodFliaItem } from "@/lib/prodProducto";
import { prisma } from "@/lib/prisma";
import type { CrearFamiliaInput, EditarFamiliaInput } from "@/lib/validations/listaProductos";
import type { ServiceResult } from "@/types";

/** Siguiente familia: el mayor `familia_cod` numérico + 1, con tres dígitos. */
export async function siguienteCodFliaItem(): Promise<ServiceResult<{ codigo: string }>> {
  try {
    const filas = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT COALESCE(MAX(CAST(familia_cod AS INTEGER)), 0) AS max
      FROM prod_familias
      WHERE familia_cod ~ '^[0-9]+$'
    `;
    const max = Number(filas[0]?.max ?? 0);
    const siguiente = Number.isFinite(max) && max >= 0 ? max + 1 : 1;
    return { success: true, data: { codigo: textoCodFliaItem(siguiente) } };
  } catch (error: unknown) {
    console.error("[prodProducto] siguiente flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo calcular el código de familia." };
  }
}

/**
 * Crea la familia si el código no existe y devuelve su id.
 * `null` si el ítem queda sin familia. El nombre se guarda en el catálogo, compartido por los SKU.
 */
export async function resolverFamiliaId(
  tx: Prisma.TransactionClient,
  codigo: string | null,
  nombre: string
): Promise<string | null> {
  if (codigo == null) return null;
  const existente = await tx.prodFamilia.findUnique({
    where: { familiaCod: codigo },
    select: { id: true, familiaNombre: true },
  });
  if (existente) {
    if (nombre !== existente.familiaNombre) {
      await tx.prodFamilia.update({
        where: { id: existente.id },
        data: { familiaNombre: nombre },
      });
    }
    return existente.id;
  }
  const creada = await tx.prodFamilia.create({
    data: { familiaCod: codigo, familiaNombre: nombre },
    select: { id: true },
  });
  return creada.id;
}

/** Descripciones de los ítems de esa familia, y el nombre del catálogo. */
export async function listarDescripcionesFliaItem(
  codigo: string
): Promise<ServiceResult<{ descripciones: string[]; nombre: string }>> {
  const vacio = { descripciones: [], nombre: "" };
  const normal = normalizarCodFliaItem(codigo);
  if (!normal.ok || normal.codigo == null) return { success: true, data: vacio };
  try {
    const familia = await prisma.prodFamilia.findUnique({
      where: { familiaCod: normal.codigo },
      select: {
        familiaNombre: true,
        prodTiendas: {
          select: { descripcionTienda: true },
          orderBy: { descripcionTienda: "asc" },
          take: 50,
        },
      },
    });
    if (!familia) return { success: true, data: vacio };
    return {
      success: true,
      data: {
        nombre: familia.familiaNombre,
        descripciones: familia.prodTiendas
          .map((fila) => (fila.descripcionTienda ?? "").trim())
          .filter((descripcion) => descripcion.length > 0),
      },
    };
  } catch (error: unknown) {
    console.error("[prodProducto] flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudieron leer los ítems de la familia." };
  }
}

function codigoFamiliaOcupado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Catálogo para Gestionar Familias. Las descripciones alimentan el buscador. */
export async function listarFamiliasCatalogo(): Promise<FamiliaCatalogoItem[]> {
  const filas = await prisma.prodFamilia.findMany({
    orderBy: { familiaCod: "asc" },
    select: {
      id: true,
      familiaCod: true,
      familiaNombre: true,
      prodTiendas: {
        select: { descripcionTienda: true },
        orderBy: { descripcionTienda: "asc" },
      },
    },
  });
  return filas.map((fila) => ({
    id: fila.id,
    codigo: fila.familiaCod,
    nombre: fila.familiaNombre,
    descripciones: fila.prodTiendas
      .map((item) => (item.descripcionTienda ?? "").trim())
      .filter((descripcion) => descripcion.length > 0),
  }));
}

export async function crearFamilia(input: CrearFamiliaInput): Promise<ServiceResult<{ id: string }>> {
  try {
    const creada = await prisma.prodFamilia.create({
      data: { familiaCod: input.codigo, familiaNombre: input.nombre },
      select: { id: true },
    });
    return { success: true, data: { id: creada.id } };
  } catch (error: unknown) {
    if (codigoFamiliaOcupado(error)) {
      return { success: false, error: "Ya existe una familia con ese código." };
    }
    console.error("[prodProducto] crear flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo crear la familia." };
  }
}

export async function editarFamilia(input: EditarFamiliaInput): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.prodFamilia.update({
      where: { id: input.id },
      data: { familiaCod: input.codigo, familiaNombre: input.nombre },
    });
    return { success: true, data: { id: input.id } };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "La familia ya no existe." };
    }
    if (codigoFamiliaOcupado(error)) {
      return { success: false, error: "Ya existe una familia con ese código." };
    }
    console.error("[prodProducto] editar flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo guardar la familia." };
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
