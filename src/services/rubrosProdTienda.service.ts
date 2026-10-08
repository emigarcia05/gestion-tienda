import { prisma } from "@/lib/prisma";
import {
  listarNombresMarcasProdPropios,
  listarNombresRubrosProdPropios,
} from "@/services/prodPropiosCatalogos.service";

/** Nombres de marca (`prod_marcas`) usados por al menos un ítem de `prod_propios` (orden alfabético). */
export async function listarNombresMarcaDistinctProdTienda(): Promise<string[]> {
  return listarNombresMarcasProdPropios();
}

/** Nombres de rubro (`prod_rubros`) usados por al menos un ítem de `prod_propios` (orden alfabético). */
export async function listarNombresRubroDistinctProdTienda(): Promise<string[]> {
  return listarNombresRubrosProdPropios();
}

/** Pares rubro + sub-rubro (`prod_sub_rubros`) usados por al menos un ítem de `prod_propios`. */
export async function listarSubRubrosPorRubroProdTienda(): Promise<
  { rubro: string; subRubro: string }[]
> {
  const rows = await prisma.prodSubRubro.findMany({
    where: { prodPropios: { some: {} } },
    select: { nombre: true, rubro: { select: { nombre: true } } },
    orderBy: [{ rubro: { nombre: "asc" } }, { nombre: "asc" }],
  });
  return rows.map((r) => ({ rubro: r.rubro.nombre, subRubro: r.nombre }));
}

/**
 * Opciones de rubro para UI de lista precios (edición masiva / filtros).
 * `id` y `nombre` = nombre del rubro (se persiste como texto en `prod_precios_provee.rubro`).
 */
export async function listarRubrosOpcionesDesdeProdTienda(): Promise<
  { id: string; nombre: string }[]
> {
  const nombres = await listarNombresRubroDistinctProdTienda();
  return nombres.map((nombre) => ({ id: nombre, nombre }));
}

/** Catálogo de rubros para reglas de descuento: rubros de `prod_rubros` usados por ítems de `prod_propios`. */
export async function listarRubrosCatalogoReglasDesdeProdTienda(): Promise<
  { id: string; nombre: string }[]
> {
  return prisma.prodRubro.findMany({
    where: { prodPropios: { some: {} } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}
