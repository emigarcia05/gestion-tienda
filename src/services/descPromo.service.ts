import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  etiquetaAlcanceDescPromo,
  etiquetaFormaPagoCuotaDescPromo,
  type DescPromoEspecialFactura,
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
      producto: {
        select: {
          descripcionTienda: true,
          idMarca: true,
          idRubro: true,
          marcaRelation: { select: { nombre: true } },
          rubroRelation: { select: { nombre: true } },
        },
      },
    },
  },
  formasPago: {
    orderBy: { id: "asc" },
    select: {
      pagoId: true,
      cuotaId: true,
      pago: { select: { nombre: true } },
      cuota: { select: { cuotas: true } },
    },
  },
  marca: { select: { nombre: true } },
  rubro: { select: { nombre: true } },
});

type PromoRow = Prisma.DescPromoGetPayload<{ include: typeof promoInclude }>;

function mapPromo(row: PromoRow): DescPromoFila {
  return {
    id: row.id,
    alcance: row.alcance,
    alcanceEtiqueta: etiquetaAlcanceDescPromo(row.alcance),
    nombre: row.nombre,
    descuento: row.descuento,
    prioridad: row.prioridad,
    idMarca: row.idMarca,
    marcaNombre: row.marca
      ? row.marca.nombre.toLocaleUpperCase("es-AR")
      : null,
    idRubro: row.idRubro,
    rubroNombre: row.rubro
      ? row.rubro.nombre.toLocaleUpperCase("es-AR")
      : null,
    items: row.items.map((item) => ({
      codTienda: item.codTienda,
      descripcion: (item.producto.descripcionTienda ?? "").toLocaleUpperCase("es-AR"),
      idMarca: item.producto.idMarca,
      marcaNombre: item.producto.marcaRelation
        ? item.producto.marcaRelation.nombre.toLocaleUpperCase("es-AR")
        : null,
      idRubro: item.producto.idRubro,
      rubroNombre: item.producto.rubroRelation
        ? item.producto.rubroRelation.nombre.toLocaleUpperCase("es-AR")
        : null,
    })),
    formasPago: row.formasPago
      .map((fp) => ({
        pagoId: fp.pagoId,
        nombre: fp.pago.nombre.toLocaleUpperCase("es-AR"),
        cuotaId: fp.cuotaId,
        cuotaEtiqueta: fp.cuota
          ? fp.cuota.cuotas.toLocaleUpperCase("es-AR")
          : null,
      }))
      .sort((a, b) => {
        const na = a.cuotaEtiqueta
          ? `${a.nombre} · ${a.cuotaEtiqueta}`
          : a.nombre;
        const nb = b.cuotaEtiqueta
          ? `${b.nombre} · ${b.cuotaEtiqueta}`
          : b.nombre;
        return na.localeCompare(nb, "es");
      }),
  };
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function ejesSegunAlcance(input: CrearDescPromoInput): {
  idMarca: string | null;
  idRubro: string | null;
  codTiendas: string[];
} {
  if (input.alcance === "MARCA") {
    return { idMarca: input.idMarca ?? null, idRubro: null, codTiendas: [] };
  }
  if (input.alcance === "RUBRO") {
    return { idMarca: null, idRubro: input.idRubro ?? null, codTiendas: [] };
  }
  if (input.alcance === "MARCA_RUBRO") {
    return {
      idMarca: input.idMarca ?? null,
      idRubro: input.idRubro ?? null,
      codTiendas: [],
    };
  }
  if (input.alcance === "ITEMS") {
    return { idMarca: null, idRubro: null, codTiendas: input.codTiendas };
  }
  return { idMarca: null, idRubro: null, codTiendas: [] };
}

function mapDbError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "P2002") return "La prioridad ya está en uso. Reintentá.";
    if (code === "P2003") return "Hay un producto, forma de cobro, marca o rubro inválido.";
    if (code === "P2025") return "La promoción no existe.";
  }
  return error instanceof Error ? error.message : fallback;
}

async function validarVinculos(
  input: CrearDescPromoInput
): Promise<ServiceResult<void>> {
  const pagoIds = [...new Set(input.vinculosCobro.map((v) => v.pagoId))];
  if (pagoIds.length === 0) {
    return { success: false, error: "Elegí al menos una forma de cobro." };
  }
  const nPagos = await prisma.finAnaCosFinaPagoCat.count({
    where: { id: { in: pagoIds } },
  });
  if (nPagos !== pagoIds.length) {
    return { success: false, error: "Hay formas de pago que ya no existen." };
  }

  const cuotaIds = [
    ...new Set(
      input.vinculosCobro
        .map((v) => v.cuotaId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  if (cuotaIds.length > 0) {
    const nCuotas = await prisma.cobrosCuota.count({
      where: { id: { in: cuotaIds } },
    });
    if (nCuotas !== cuotaIds.length) {
      return { success: false, error: "Hay cantidades de cuotas que ya no existen." };
    }
  }

  const pagosConCuotas = await prisma.cobrosCuotaVinculo.findMany({
    where: { pagoId: { in: pagoIds } },
    select: { pagoId: true, cuotaId: true },
  });
  const cuotasPorPago = new Map<string, Set<string>>();
  for (const row of pagosConCuotas) {
    const set = cuotasPorPago.get(row.pagoId) ?? new Set<string>();
    set.add(row.cuotaId);
    cuotasPorPago.set(row.pagoId, set);
  }

  for (const pagoId of pagoIds) {
    const catalogo = cuotasPorPago.get(pagoId);
    const filas = input.vinculosCobro.filter((v) => v.pagoId === pagoId);
    if (catalogo && catalogo.size > 0) {
      for (const fila of filas) {
        const cuotaId = fila.cuotaId ?? null;
        if (cuotaId == null) {
          return {
            success: false,
            error: "Elegí al menos una CANT. CUOTAS para cada forma que las tiene.",
          };
        }
        if (!catalogo.has(cuotaId)) {
          return {
            success: false,
            error: "Hay una CANT. CUOTAS que no corresponde a esa forma de pago.",
          };
        }
      }
    } else if (filas.some((f) => f.cuotaId)) {
      return {
        success: false,
        error: "Esa forma de pago no tiene CANT. CUOTAS.",
      };
    }
  }

  const ejes = ejesSegunAlcance(input);
  if (ejes.codTiendas.length > 0) {
    const n = await prisma.prodPropio.count({
      where: { codTienda: { in: ejes.codTiendas } },
    });
    if (n !== ejes.codTiendas.length) {
      return { success: false, error: "Hay productos que ya no existen." };
    }
  }
  if (ejes.idMarca) {
    const marca = await prisma.marca.findUnique({
      where: { id: ejes.idMarca },
      select: { id: true },
    });
    if (!marca) return { success: false, error: "La marca ya no existe." };
  }
  if (ejes.idRubro) {
    const rubro = await prisma.prodRubro.findUnique({
      where: { id: ejes.idRubro },
      select: { id: true },
    });
    if (!rubro) return { success: false, error: "El rubro ya no existe." };
  }
  return { success: true, data: undefined };
}

function dataVinculos(input: CrearDescPromoInput) {
  const ejes = ejesSegunAlcance(input);
  return {
    alcance: input.alcance,
    descuento: input.descuento,
    idMarca: ejes.idMarca,
    idRubro: ejes.idRubro,
    items: { create: ejes.codTiendas.map((codTienda) => ({ codTienda })) },
    formasPago: {
      create: input.vinculosCobro.map((v) => ({
        pagoId: v.pagoId,
        cuotaId: v.cuotaId ?? null,
      })),
    },
  };
}

async function siguientePrioridad(): Promise<number> {
  const agg = await prisma.descPromo.aggregate({ _max: { prioridad: true } });
  return (agg._max.prioridad ?? 0) + 1;
}

async function compactarPrioridad(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE desc_promo SET prioridad = prioridad + 100000
  `;
  await prisma.$executeRaw`
    UPDATE desc_promo AS d
    SET prioridad = s.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY prioridad ASC, id ASC) AS rn
      FROM desc_promo
    ) AS s
    WHERE d.id = s.id
  `;
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
      orderBy: [{ prioridad: "desc" }, { id: "asc" }],
    });
    return rows.map(mapPromo);
  } catch (e: unknown) {
    console.error("[descPromo.service] listarDescPromos:", e);
    return [];
  }
}

/**
 * Promos de alcance ITEMS (DESC. ESPECIAL) indexadas por `cod_tienda`
 * pedido. Un código puede tener varias; orden: prioridad desc.
 */
export async function listarDescPromosEspecialesPorCodigos(
  codigos: readonly string[]
): Promise<Map<string, DescPromoEspecialFactura[]>> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  const out = new Map<string, DescPromoEspecialFactura[]>();
  if (unicos.length === 0) return out;
  const pedido = new Set(unicos);
  try {
    const rows = await prisma.descPromo.findMany({
      where: {
        alcance: "ITEMS",
        items: { some: { codTienda: { in: unicos } } },
      },
      include: promoInclude,
      orderBy: [{ prioridad: "desc" }, { id: "asc" }],
    });
    for (const row of rows) {
      const mapped = mapPromo(row);
      const especial: DescPromoEspecialFactura = {
        id: mapped.id,
        nombre: mapped.nombre,
        descuento: mapped.descuento,
        prioridad: mapped.prioridad,
        formasPago: mapped.formasPago
          .map(etiquetaFormaPagoCuotaDescPromo)
          .join(" · "),
      };
      for (const item of mapped.items) {
        if (!pedido.has(item.codTienda)) continue;
        const lista = out.get(item.codTienda) ?? [];
        lista.push(especial);
        out.set(item.codTienda, lista);
      }
    }
    return out;
  } catch (e: unknown) {
    console.error(
      "[descPromo.service] listarDescPromosEspecialesPorCodigos:",
      e
    );
    return out;
  }
}

/** Reglas con al menos una forma de pago, para Factura · Crear. */
export async function listarDescPromosPorFormaPago(): Promise<DescPromoFila[]> {
  try {
    const rows = await prisma.descPromo.findMany({
      where: { formasPago: { some: {} } },
      include: promoInclude,
      orderBy: [{ prioridad: "desc" }, { id: "asc" }],
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
    const prioridad = await siguientePrioridad();
    const created = await prisma.descPromo.create({
      data: {
        nombre,
        prioridad,
        ...dataVinculos(input),
      },
      include: promoInclude,
    });
    return { success: true, data: mapPromo(created) };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      try {
        await compactarPrioridad();
        const prioridad = await siguientePrioridad();
        const created = await prisma.descPromo.create({
          data: {
            nombre,
            prioridad,
            ...dataVinculos(input),
          },
          include: promoInclude,
        });
        return { success: true, data: mapPromo(created) };
      } catch (retryError) {
        return {
          success: false,
          error: mapDbError(retryError, "No se pudo crear la promoción."),
        };
      }
    }
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
        nombre,
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
    await compactarPrioridad();
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo eliminar la promoción."),
    };
  }
}

export async function moverPrioridadDescPromo(
  id: string,
  direccion: "up" | "down"
): Promise<ServiceResult<DescPromoFila>> {
  try {
    const rows = await prisma.descPromo.findMany({
      select: { id: true, prioridad: true },
      orderBy: { prioridad: "asc" },
    });
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return { success: false, error: "La promoción no existe." };
    const j = direccion === "up" ? i + 1 : i - 1;
    if (j < 0 || j >= rows.length) {
      const actual = await prisma.descPromo.findUnique({
        where: { id },
        include: promoInclude,
      });
      if (!actual) return { success: false, error: "La promoción no existe." };
      return { success: true, data: mapPromo(actual) };
    }
    const a = rows[i];
    const b = rows[j];
    const offset = 100000;
    await prisma.descPromo.update({
      where: { id: a.id },
      data: { prioridad: a.prioridad + offset },
    });
    await prisma.descPromo.update({
      where: { id: b.id },
      data: { prioridad: a.prioridad },
    });
    await prisma.descPromo.update({
      where: { id: a.id },
      data: { prioridad: b.prioridad },
    });
    await compactarPrioridad();
    const updated = await prisma.descPromo.findUnique({
      where: { id },
      include: promoInclude,
    });
    if (!updated) return { success: false, error: "La promoción no existe." };
    return { success: true, data: mapPromo(updated) };
  } catch (error) {
    return {
      success: false,
      error: mapDbError(error, "No se pudo cambiar la prioridad."),
    };
  }
}
