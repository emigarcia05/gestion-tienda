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

const promoInclude = Prisma.validator<Prisma.DescPromoInclude>()({
  items: {
    orderBy: { producto: { descripcionTienda: "asc" } },
    select: {
      codTienda: true,
      producto: { select: { descripcionTienda: true } },
    },
  },
  formasPago: {
    orderBy: { pago: { nombre: "asc" } },
    select: {
      pagoId: true,
      pago: { select: { nombre: true } },
    },
  },
  reglas: {
    orderBy: [{ rubro: { nombre: "asc" } }, { subRubro: { nombre: "asc" } }],
    select: {
      id: true,
      idRubro: true,
      idSubRubro: true,
      descuento: true,
      rubro: { select: { nombre: true } },
      subRubro: { select: { nombre: true } },
    },
  },
});

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
    reglas: row.reglas.map((regla) => ({
      id: regla.id,
      idRubro: regla.idRubro,
      rubroNombre: regla.rubro.nombre.toLocaleUpperCase("es-AR"),
      idSubRubro: regla.idSubRubro,
      subRubroNombre: regla.subRubro
        ? regla.subRubro.nombre.toLocaleUpperCase("es-AR")
        : null,
      descuento: regla.descuento,
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
    if (code === "P2002") return "Hay reglas duplicadas de rubro y sub-rubro.";
    if (code === "P2003") return "Hay un producto, forma de pago o rubro inválido.";
    if (code === "P2025") return "La promoción no existe.";
  }
  return error instanceof Error ? error.message : fallback;
}

type InputVinculos = Pick<
  CrearDescPromoInput,
  "tipo" | "codTiendas" | "pagoIds" | "reglas"
>;

async function validarVinculos(input: InputVinculos): Promise<ServiceResult<void>> {
  if (input.tipo === "POR_ITEM") {
    const n = await prisma.prodPropio.count({
      where: { codTienda: { in: input.codTiendas } },
    });
    if (n !== input.codTiendas.length) {
      return { success: false, error: "Hay productos que ya no existen." };
    }
    return { success: true, data: undefined };
  }

  const nPagos = await prisma.finAnaCosFinaPagoCat.count({
    where: { id: { in: input.pagoIds } },
  });
  if (nPagos !== input.pagoIds.length) {
    return { success: false, error: "Hay formas de pago que ya no existen." };
  }

  const rubroIds = [...new Set(input.reglas.map((r) => r.idRubro))];
  const nRubros = await prisma.prodRubro.count({
    where: { id: { in: rubroIds } },
  });
  if (nRubros !== rubroIds.length) {
    return { success: false, error: "Hay rubros que ya no existen." };
  }

  for (const regla of input.reglas) {
    const idSubRubro = regla.idSubRubro ?? null;
    if (!idSubRubro) continue;
    const sub = await prisma.prodSubRubro.findUnique({
      where: { id_idRubro: { id: idSubRubro, idRubro: regla.idRubro } },
      select: { id: true },
    });
    if (!sub) {
      return {
        success: false,
        error: "Hay un sub-rubro que no corresponde al rubro elegido.",
      };
    }
  }

  return { success: true, data: undefined };
}

function dataVinculos(input: InputVinculos) {
  return {
    items: { create: input.codTiendas.map((codTienda) => ({ codTienda })) },
    formasPago: { create: input.pagoIds.map((pagoId) => ({ pagoId })) },
    reglas: {
      create: input.reglas.map((regla) => ({
        idRubro: regla.idRubro,
        idSubRubro: regla.idSubRubro ?? null,
        descuento: regla.descuento,
      })),
    },
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

/** Catálogo POR FORMA DE PAGO para Factura · Crear (sin gate de Administrador). */
export async function listarDescPromosPorFormaPago(): Promise<DescPromoFila[]> {
  try {
    const rows = await prisma.descPromo.findMany({
      where: { tipo: "POR_FORMA_PAGO" },
      include: promoInclude,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    });
    return rows.map(mapPromo);
  } catch (e: unknown) {
    console.error("[descPromo.service] listarDescPromosPorFormaPago:", e);
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
        descuento: input.tipo === "POR_ITEM" ? input.descuento : null,
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
    await prisma.descPromoRegla.deleteMany({ where: { promoId: input.id } });
    const updated = await prisma.descPromo.update({
      where: { id: input.id },
      data: {
        tipo: input.tipo,
        nombre,
        descuento: input.tipo === "POR_ITEM" ? input.descuento : null,
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
