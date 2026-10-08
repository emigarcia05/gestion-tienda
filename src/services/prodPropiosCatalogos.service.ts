import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Rubro, sub-rubro y marca de `prod_propios` viven solo como FK (`id_rubro`, `id_sub_rubro`, `id_marca`).
 * Los filtros de las pantallas siguen trabajando por **nombre**; estos helpers traducen a relaciones.
 */
export type FiltroCatalogoProdPropio = {
  rubro?: string | null;
  subRubro?: string | null;
  marca?: string | null;
};

/** Partes `AND` para filtrar ítems por nombre de rubro / sub-rubro / marca (vacío = sin filtro). */
export function whereCatalogoProdPropio(f: FiltroCatalogoProdPropio): Prisma.ProdPropioWhereInput[] {
  const parts: Prisma.ProdPropioWhereInput[] = [];
  if (f.rubro) parts.push({ rubroRelation: { nombre: f.rubro } });
  if (f.subRubro) parts.push({ subRubroRelation: { nombre: f.subRubro } });
  if (f.marca) parts.push({ marcaRelation: { nombre: f.marca } });
  return parts;
}

/** Relaciones a incluir (en `select` o `include`) para leer los nombres del catálogo. */
export const SELECT_NOMBRES_CATALOGO_PROD_PROPIO = {
  rubroRelation: { select: { nombre: true } },
  subRubroRelation: { select: { nombre: true } },
  marcaRelation: { select: { nombre: true } },
} satisfies Prisma.ProdPropioSelect;

type NombreRel = { nombre: string } | null | undefined;

export type NombresCatalogoProdPropio = {
  rubro: string | null;
  subRubro: string | null;
  marca: string | null;
};

export function nombresCatalogoProdPropio(r: {
  rubroRelation?: NombreRel;
  subRubroRelation?: NombreRel;
  marcaRelation?: NombreRel;
}): NombresCatalogoProdPropio {
  return {
    rubro: r.rubroRelation?.nombre ?? null,
    subRubro: r.subRubroRelation?.nombre ?? null,
    marca: r.marcaRelation?.nombre ?? null,
  };
}

/** Nombres de rubros usados por ítems que cumplen `where` (orden alfabético). */
export async function listarNombresRubrosProdPropios(where: Prisma.ProdPropioWhereInput = {}): Promise<string[]> {
  const rows = await prisma.prodRubro.findMany({
    where: { prodPropios: { some: where } },
    select: { nombre: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((r) => r.nombre);
}

/** Nombres de sub-rubros usados por ítems que cumplen `where` (sin duplicados entre rubros). */
export async function listarNombresSubRubrosProdPropios(where: Prisma.ProdPropioWhereInput = {}): Promise<string[]> {
  const rows = await prisma.prodSubRubro.findMany({
    where: { prodPropios: { some: where } },
    select: { nombre: true },
    orderBy: { nombre: "asc" },
  });
  return [...new Set(rows.map((s) => s.nombre))];
}

/** Nombres de marcas usadas por ítems que cumplen `where` (orden alfabético). */
export async function listarNombresMarcasProdPropios(where: Prisma.ProdPropioWhereInput = {}): Promise<string[]> {
  const rows = await prisma.marca.findMany({
    where: { prodTiendas: { some: where } },
    select: { nombre: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((m) => m.nombre);
}

/** Rubros / sub-rubros / marcas usados por ítems que cumplen `where`. */
export async function listarNombresCatalogoProdPropios(
  where: Prisma.ProdPropioWhereInput = {}
): Promise<{ rubros: string[]; subRubros: string[]; marcas: string[] }> {
  const [rubros, subRubros, marcas] = await Promise.all([
    listarNombresRubrosProdPropios(where),
    listarNombresSubRubrosProdPropios(where),
    listarNombresMarcasProdPropios(where),
  ]);
  return { rubros, subRubros, marcas };
}
