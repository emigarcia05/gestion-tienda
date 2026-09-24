import { prisma } from "@/lib/prisma";

/** Nombres de marca distintos en `prod_tienda.marca` (trim, sin vacíos, orden alfabético). */
export async function listarNombresMarcaDistinctProdTienda(): Promise<string[]> {
  const rows = await prisma.prodTienda.findMany({
    where: { marca: { not: null } },
    distinct: ["marca"],
    orderBy: { marca: "asc" },
    select: { marca: true },
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const nombre = (row.marca ?? "").trim();
    if (!nombre || seen.has(nombre)) continue;
    seen.add(nombre);
    out.push(nombre);
  }
  return out;
}

/** Nombres de rubro distintos en `prod_tienda.rubro` (trim, sin vacíos, orden alfabético). */
export async function listarNombresRubroDistinctProdTienda(): Promise<string[]> {
  const rows = await prisma.prodTienda.findMany({
    where: { rubro: { not: null } },
    distinct: ["rubro"],
    orderBy: { rubro: "asc" },
    select: { rubro: true },
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const nombre = (row.rubro ?? "").trim();
    if (!nombre || seen.has(nombre)) continue;
    seen.add(nombre);
    out.push(nombre);
  }
  return out;
}

/**
 * Opciones de rubro para UI de lista precios (edición masiva / filtros).
 * `id` y `nombre` = texto del rubro en tienda (se persiste en `prod_precios_provee.rubro`).
 */
export async function listarRubrosOpcionesDesdeProdTienda(): Promise<
  { id: string; nombre: string }[]
> {
  const nombres = await listarNombresRubroDistinctProdTienda();
  return nombres.map((nombre) => ({ id: nombre, nombre }));
}

/**
 * Catálogo de rubros para reglas de descuento: mismos nombres que `prod_tienda.rubro`,
 * con `id` de `prod_rubros_lista` (crea fila si falta — FK técnica del motor de reglas).
 */
export async function listarRubrosCatalogoReglasDesdeProdTienda(): Promise<
  { id: string; nombre: string }[]
> {
  const nombres = await listarNombresRubroDistinctProdTienda();
  if (nombres.length === 0) return [];

  const existentes = await prisma.prodRubroLista.findMany({
    where: { nombre: { in: nombres } },
    select: { id: true, nombre: true },
  });
  const idPorNombre = new Map(existentes.map((r) => [r.nombre, r.id]));

  const out: { id: string; nombre: string }[] = [];
  for (const nombre of nombres) {
    let id = idPorNombre.get(nombre);
    if (!id) {
      const created = await prisma.prodRubroLista.create({ data: { nombre } });
      id = created.id;
      idPorNombre.set(nombre, id);
    }
    out.push({ id, nombre });
  }
  return out;
}
