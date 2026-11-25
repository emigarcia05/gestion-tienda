import { Prisma } from "@prisma/client";
import { filtroTexto } from "@/lib/busqueda";
import { ENVIOS_PDF_MAX_BYTES } from "@/lib/envios";
import type { FamiliaCatalogoItem, ItemSelectorFamilia, OpcionCatalogoItem } from "@/lib/listaProductos";
import { prisma } from "@/lib/prisma";
import type {
  CrearFamiliaInput,
  EditarFamiliaInput,
} from "@/lib/validations/listaProductos";
import type { ServiceResult } from "@/types";

function nombreFamiliaOcupado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function nombrePdfFamilia(nombre: string): string {
  const base = nombre.replace(/\\/g, "/").split("/").pop() ?? nombre;
  const limpio = base.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/gi, "_").trim();
  return (limpio || "ficha.pdf").slice(0, 200);
}

function decodePdfFamilia(
  nombre: string,
  base64: string
): ServiceResult<{ nombre: string; bytes: Uint8Array<ArrayBuffer> }> {
  const raw = base64.includes(",") ? (base64.split(",").pop() ?? "") : base64;
  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch {
    return { success: false, error: "El PDF no se pudo leer." };
  }
  if (decoded.length === 0) return { success: false, error: "El PDF está vacío." };
  if (decoded.length > ENVIOS_PDF_MAX_BYTES) {
    return { success: false, error: "El PDF supera el tamaño máximo (5 MB)." };
  }
  if (decoded[0] !== 0x25 || decoded[1] !== 0x50 || decoded[2] !== 0x44 || decoded[3] !== 0x46) {
    return { success: false, error: "El archivo no es un PDF válido." };
  }
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  return { success: true, data: { nombre: nombrePdfFamilia(nombre), bytes } };
}

/** Opciones del Select FAMILIA en Nuevo Item / Editar (solo id y nombre). */
export async function listarFamiliasOpciones(): Promise<OpcionCatalogoItem[]> {
  const filas = await prisma.prodFamilia.findMany({
    orderBy: { familiaNombre: "asc" },
    select: { id: true, familiaNombre: true },
  });
  return filas.map((fila) => ({ id: fila.id, nombre: fila.familiaNombre }));
}

/** Catálogo para Gestionar Familias. Las descripciones alimentan el buscador. */
export async function listarFamiliasCatalogo(): Promise<FamiliaCatalogoItem[]> {
  const filas = await prisma.prodFamilia.findMany({
    orderBy: { familiaNombre: "asc" },
    select: {
      id: true,
      familiaNombre: true,
      fichaPdfNombre: true,
      fichaUrl: true,
      prodTiendas: {
        select: { descripcionTienda: true },
        orderBy: { descripcionTienda: "asc" },
      },
    },
  });
  return filas.map((fila) => {
    const url = fila.fichaUrl?.trim() ?? "";
    return {
      id: fila.id,
      nombre: fila.familiaNombre,
      descripciones: fila.prodTiendas
        .map((item) => (item.descripcionTienda ?? "").trim())
        .filter((descripcion) => descripcion.length > 0),
      pdfNombre: fila.fichaPdfNombre,
      url,
      tieneFicha: Boolean(fila.fichaPdfNombre) || url.length > 0,
    };
  });
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
  const data: Prisma.ProdFamiliaUpdateInput = {
    familiaNombre: input.nombre,
    fichaUrl: input.url.length === 0 ? null : input.url,
  };
  if (input.quitarPdf) {
    data.fichaPdfNombre = null;
    data.fichaPdf = null;
  } else if (input.pdf) {
    const decoded = decodePdfFamilia(input.pdf.nombre, input.pdf.base64);
    if (!decoded.success) return decoded;
    data.fichaPdfNombre = decoded.data.nombre;
    data.fichaPdf = decoded.data.bytes;
  }
  try {
    await prisma.prodFamilia.update({
      where: { id: input.id },
      data,
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

/** PDF guardado de la ficha. No incluye familias que solo tienen URL. */
export async function obtenerPdfFamilia(
  id: string
): Promise<ServiceResult<{ nombre: string; bytes: Uint8Array<ArrayBuffer> }>> {
  try {
    const fila = await prisma.prodFamilia.findUnique({
      where: { id },
      select: { fichaPdfNombre: true, fichaPdf: true },
    });
    if (!fila?.fichaPdf || fila.fichaPdf.length === 0) {
      return { success: false, error: "Esta familia no tiene PDF." };
    }
    const bytes = new Uint8Array(fila.fichaPdf.byteLength);
    bytes.set(fila.fichaPdf);
    return {
      success: true,
      data: { nombre: fila.fichaPdfNombre?.trim() || "ficha.pdf", bytes },
    };
  } catch (error: unknown) {
    console.error("[prodProducto] pdf flia:", error instanceof Error ? error.name : "error");
    return { success: false, error: "No se pudo leer el PDF de la familia." };
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
