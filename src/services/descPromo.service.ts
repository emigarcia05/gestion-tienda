import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  etiquetaTipoDescPromo,
  type DescPromoFila,
} from "@/lib/descPromo";
import type {
  CrearDescPromoInput,
  EditarDescPromoInput,
} from "@/lib/validations/descPromo";
import type { ServiceResult } from "@/types";

const promoInclude = {
  items: {
    orderBy: { producto: { descripcionTienda: "asc" as const } },
    select: {
      codTienda: true,
      producto: { select: { descripcionTienda: true } },
    },
  },
  formasPago: {
    orderBy: { pago: { nombre: "asc" as const } },
    select: {
      pagoId: true,
      pago: { select: { nombre: true } },
    },
  },
} as const;

type PromoRow = Prisma.DescPromoGetPayload<{ include: typeof promoInclude }>;

function mapPromo(row: PromoRow): DescPromoFila {
  return {
    id: row.id,
    tipo: row.tipo,
    tipoEtiqueta: etiquetaTipoDescPromo(row.tipo),
    nombre: row.nombre,
    descuento: row.descuento,
    items: row.items.map((item) => ({
      codTienda: item.codTienda,
      descripcion: (item.producto.descripcionTienda ?? "").toLocaleUpperCase("es-AR"),
    })),
    formasPago: row.formasPago.map((fp) => ({
      pagoId: fp.pagoId,
      nombre: fp.pago.nombre.toLocaleUpperCase("es-AR"),
    })),
  };
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2003") return "Hay un producto o forma de pago inválido.";
    if (code === "P2025") return "La promoción no existe.";
  }
  return error instanceof Error ? error.message : fallback;
}

async function validarVinculos(
  input: Pick<CrearDescPromoInput, "tipo" | "codTiendas" | "pagoIds">
): Promise<ServiceResult<void>> {
  if (input.tipo === "POR_ITEM") {
    const n = await prisma.prodPropio.count({
      where: { codTienda: { in: input.codTiendas } },
    });
    if (n !== input.codTiendas.length) {
      return { success: false, error: "Hay productos que ya no existen." };
    }
    return { success: true, data: undefined };
  }
  const n = await prisma.finAnaCosFinaPagoCat.count({
    where: { id: { in: input.pagoIds } },
  });
  if (n !== input.pagoIds.length) {
    return { success: false, error: "Hay formas de pago que ya no existen." };
  }
  return { success: true, data: undefined };
}

function dataVinculos(input: Pick<CrearDescPromoInput, "codTiendas" | "pagoIds">) {
  return {
    items: { create: input.codTiendas.map((codTienda) => ({ codTienda })) },
    formasPago: { create: input.pagoIds.map((pagoId) => ({ pagoId })) },
  };
}

export type DescPromoOpcionProducto = {
  codTienda: string;
  descripcion: string;
};

export async function listarOpcionesProductoDescPromo(): Promise<
  DescPromoOpcionProducto[]
> {
  try {
    const rows = await prisma.prodPropio.findMany({
      select: { codTienda: true, descripcionTienda: true },
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
    });
    return rows.map((row) => ({
      codTienda: row.codTienda,
      descripcion: (row.descripcionTienda ?? "").toLocaleUpperCase("es-AR"),
    }));
  } catch (e: unknown) {
    console.error("[descPromo.service] listarOpcionesProductoDescPromo:", e);
    return [];
  }
}

export async function listarDescPromos(): Promise<DescPromoFila[]> {
  try {
    const rows = await prisma.descPromo.findMany({
      include: promoInclude,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    });
    return rows.map(mapPromo);
  } catch (e: unknown) {
    console.error("[descPromo.service] listarDescPromos:", e);
    return [];
  }
}

export async function crearDescPromo(
  input: CrearDescPromoInput
): Promise<ServiceResult<DescPromoFila>> {
  const nombre = normalizarNombre(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  const vinculos = await validarVinculos(input);
  if (!vinculos.success) return vinculos;
  try {
    const created = await prisma.descPromo.create({
      data: {
        tipo: input.tipo,
        nombre,
        descuento: input.descuento,
        ...dataVinculos(input),
      },
      include: promoInclude,
    });
    return { success: true, data: mapPromo(created) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo crear la promoción."),
    };
  }
}

export async function editarDescPromo(
  input: EditarDescPromoInput
): Promise<ServiceResult<DescPromoFila>> {
  const nombre = normalizarNombre(input.nombre);
  if (!nombre) {
    return { success: false, error: "El nombre no puede quedar vacío." };
  }
  const vinculos = await validarVinculos(input);
  if (!vinculos.success) return vinculos;
  try {
    const existe = await prisma.descPromo.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existe) return { success: false, error: "La promoción no existe." };
    await prisma.descPromoItem.deleteMany({ where: { promoId: input.id } });
    await prisma.descPromoFormaPago.deleteMany({ where: { promoId: input.id } });
    const updated = await prisma.descPromo.update({
      where: { id: input.id },
      data: {
        tipo: input.tipo,
        nombre,
        descuento: input.descuento,
        ...dataVinculos(input),
      },
      include: promoInclude,
    });
    return { success: true, data: mapPromo(updated) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo actualizar la promoción."),
    };
  }
}

export async function eliminarDescPromo(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.descPromo.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la promoción."),
    };
  }
}
