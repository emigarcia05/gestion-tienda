import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroTexto } from "@/lib/busqueda";
import { PAGE_SIZE } from "@/lib/pagination";
import type {
  ListaProductoFila,
  MarcaCatalogoItem,
  RubroCatalogoItem,
} from "@/lib/listaProductos";
import type {
  CrearMarcaInput,
  CrearProductoTiendaInput,
  CrearRubroInput,
  EditarMarcaInput,
  EditarRubroInput,
  ListarListaProductosInput,
} from "@/lib/validations/listaProductos";
import { listarRubrosCatalogoReglasDesdeProdTienda } from "@/services/rubrosProdTienda.service";
import type { ServiceResult } from "@/types";

/** Clave de `pg_advisory_xact_lock` que serializa la asignación de `cod_tienda` correlativo. */
const LOCK_COD_TIENDA = 72_431_001;

class ErrorNegocio extends Error {}

function normalizarNombreCatalogo(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");
}

function normalizarFormato(formato: string | null): string | null {
  const f = formato?.trim().toUpperCase() ?? "";
  return f || null;
}

function esErrorPrisma(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// ---------------------------------------------------------------------------
// Lista Productos
// ---------------------------------------------------------------------------

export async function listarListaProductos(input: ListarListaProductosInput): Promise<{
  items: ListaProductoFila[];
  total: number;
  totalPaginas: number;
  rubros: string[];
  marcas: { id: string; nombre: string }[];
}> {
  const andParts: Prisma.ProdTiendaWhereInput[] = [];
  const textFilter = filtroTexto(input.q, ["descripcionTienda", "codTienda", "marca"]);
  if (textFilter.AND?.length) andParts.push(textFilter);
  if (input.rubro) andParts.push({ rubro: input.rubro });
  if (input.marca) andParts.push({ idMarca: input.marca });
  const where: Prisma.ProdTiendaWhereInput = andParts.length ? { AND: andParts } : {};

  const [rows, total, rubrosRows, marcas] = await Promise.all([
    prisma.prodTienda.findMany({
      where,
      orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
      skip: (input.pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        codTienda: true,
        descripcionTienda: true,
        rubro: true,
        subRubro: true,
        marca: true,
        bulto: true,
        esProductoPropio: true,
        marcaRelation: { select: { nombre: true } },
      },
    }),
    prisma.prodTienda.count({ where }),
    prisma.prodRubroLista.findMany({ orderBy: { nombre: "asc" }, select: { nombre: true } }),
    prisma.marca.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return {
    items: rows.map((r) => ({
      codTienda: r.codTienda.trim(),
      descripcion: (r.descripcionTienda ?? "").trim(),
      rubro: (r.rubro ?? "").trim(),
      subRubro: (r.subRubro ?? "").trim(),
      marca: (r.marcaRelation?.nombre ?? r.marca ?? "").trim(),
      bulto: r.bulto,
      esProductoPropio: r.esProductoPropio,
    })),
    total,
    totalPaginas: total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE),
    rubros: rubrosRows.map((r) => r.nombre),
    marcas,
  };
}

/** Próximo `cod_tienda` numérico (máximo numérico actual + 1). Ignora códigos no numéricos. */
async function siguienteCodTienda(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ max: bigint | null }[]>`
    SELECT MAX(cod_tienda::bigint) AS max FROM prod_tienda WHERE cod_tienda ~ '^[0-9]+$'
  `;
  const max = rows[0]?.max ?? BigInt(0);
  return (max + BigInt(1)).toString();
}

export async function crearProductoTienda(
  input: CrearProductoTiendaInput
): Promise<ServiceResult<{ codTienda: string }>> {
  try {
    const codTienda = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_COD_TIENDA})`;

      const [rubro, marca] = await Promise.all([
        input.idRubro
          ? tx.prodRubroLista.findUnique({ where: { id: input.idRubro }, select: { nombre: true } })
          : null,
        input.idMarca
          ? tx.marca.findUnique({ where: { id: input.idMarca }, select: { id: true, nombre: true } })
          : null,
      ]);
      if (input.idRubro && !rubro) throw new ErrorNegocio("El rubro elegido ya no existe.");
      if (input.idMarca && !marca) throw new ErrorNegocio("La marca elegida ya no existe.");

      const cod = await siguienteCodTienda(tx);
      await tx.prodTienda.create({
        data: {
          codTienda: cod,
          descripcionTienda: input.descripcion.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR"),
          rubro: rubro?.nombre ?? null,
          subRubro: input.subRubro ? normalizarNombreCatalogo(input.subRubro) : null,
          marca: marca?.nombre ?? null,
          idMarca: marca?.id ?? null,
          bulto: input.bulto,
          esProductoPropio: input.esProductoPropio,
          costoCompra: 0,
        },
      });
      return cod;
    });
    return { success: true, data: { codTienda } };
  } catch (error) {
    if (error instanceof ErrorNegocio) return { success: false, error: error.message };
    console.error("[listaProductos.service] crearProductoTienda:", error);
    return { success: false, error: "No se pudo crear el producto." };
  }
}

// ---------------------------------------------------------------------------
// Marcas (`prod_marcas`)
// ---------------------------------------------------------------------------

export async function listarMarcasCatalogo(): Promise<MarcaCatalogoItem[]> {
  const rows = await prisma.marca.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      formatoCodTintometrico: true,
      _count: { select: { prodTiendas: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    formatoCodTintometrico: r.formatoCodTintometrico,
    productos: r._count.prodTiendas,
  }));
}

export async function crearMarca(input: CrearMarcaInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  try {
    const created = await prisma.marca.create({
      data: { nombre, formatoCodTintometrico: normalizarFormato(input.formatoCodTintometrico) },
      select: { id: true },
    });
    return { success: true, data: created };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "Ya existe una marca con ese nombre." };
    }
    console.error("[listaProductos.service] crearMarca:", error);
    return { success: false, error: "No se pudo crear la marca." };
  }
}

/**
 * Renombrar actualiza también el texto `marca` de `prod_tienda` (vinculados) y de `prod_precios_provee`
 * (las reglas de descuento comparan por nombre contra ese texto).
 */
export async function editarMarca(input: EditarMarcaInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  const actual = await prisma.marca.findUnique({ where: { id: input.id }, select: { nombre: true } });
  if (!actual) return { success: false, error: "Marca no encontrada." };
  const renombra = actual.nombre !== nombre;
  try {
    await prisma.$transaction([
      prisma.marca.update({
        where: { id: input.id },
        data: { nombre, formatoCodTintometrico: normalizarFormato(input.formatoCodTintometrico) },
      }),
      ...(renombra
        ? [
            prisma.prodTienda.updateMany({ where: { idMarca: input.id }, data: { marca: nombre } }),
            prisma.listaPrecioProveedor.updateMany({
              where: { marca: { equals: actual.nombre, mode: "insensitive" } },
              data: { marca: nombre },
            }),
          ]
        : []),
    ]);
    return { success: true, data: { id: input.id } };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "Ya existe una marca con ese nombre." };
    }
    console.error("[listaProductos.service] editarMarca:", error);
    return { success: false, error: "No se pudo actualizar la marca." };
  }
}

/** Solo si no tiene productos ni reglas de descuento (la FK de reglas borra en cascada). */
export async function eliminarMarca(id: string): Promise<ServiceResult<{ id: string }>> {
  const marca = await prisma.marca.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          prodTiendas: true,
          reglasDescuentosListaPrecio: true,
          reglasDescEspecialListaPrecio: true,
        },
      },
    },
  });
  if (!marca) return { success: false, error: "Marca no encontrada." };
  const c = marca._count;
  if (c.prodTiendas > 0) {
    return { success: false, error: `La marca tiene ${c.prodTiendas} producto(s) vinculado(s).` };
  }
  if (c.reglasDescuentosListaPrecio + c.reglasDescEspecialListaPrecio > 0) {
    return { success: false, error: "La marca se usa en reglas de descuento de lista de precios." };
  }
  try {
    await prisma.marca.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[listaProductos.service] eliminarMarca:", error);
    return { success: false, error: "No se pudo eliminar la marca." };
  }
}

// ---------------------------------------------------------------------------
// Rubros (`prod_rubros_lista`; `prod_tienda.rubro` guarda el nombre como texto)
// ---------------------------------------------------------------------------

export async function listarRubrosCatalogo(): Promise<RubroCatalogoItem[]> {
  await listarRubrosCatalogoReglasDesdeProdTienda();
  const [rubros, conteos] = await Promise.all([
    prisma.prodRubroLista.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.prodTienda.groupBy({ by: ["rubro"], where: { rubro: { not: null } }, _count: true }),
  ]);
  const porNombre = new Map(conteos.map((c) => [c.rubro ?? "", c._count]));
  return rubros.map((r) => ({ ...r, productos: porNombre.get(r.nombre) ?? 0 }));
}

export async function crearRubro(input: CrearRubroInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  try {
    const created = await prisma.prodRubroLista.create({ data: { nombre }, select: { id: true } });
    return { success: true, data: created };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "Ya existe un rubro con ese nombre." };
    }
    console.error("[listaProductos.service] crearRubro:", error);
    return { success: false, error: "No se pudo crear el rubro." };
  }
}

/** Renombrar actualiza el texto en `prod_tienda.rubro` y `prod_precios_provee.rubro`. */
export async function editarRubro(input: EditarRubroInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  const actual = await prisma.prodRubroLista.findUnique({
    where: { id: input.id },
    select: { nombre: true },
  });
  if (!actual) return { success: false, error: "Rubro no encontrado." };
  if (actual.nombre === nombre) return { success: true, data: { id: input.id } };
  try {
    await prisma.$transaction([
      prisma.prodRubroLista.update({ where: { id: input.id }, data: { nombre } }),
      prisma.prodTienda.updateMany({ where: { rubro: actual.nombre }, data: { rubro: nombre } }),
      prisma.listaPrecioProveedor.updateMany({
        where: { rubro: { equals: actual.nombre, mode: "insensitive" } },
        data: { rubro: nombre },
      }),
    ]);
    return { success: true, data: { id: input.id } };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "Ya existe un rubro con ese nombre." };
    }
    console.error("[listaProductos.service] editarRubro:", error);
    return { success: false, error: "No se pudo actualizar el rubro." };
  }
}

/** Solo si ningún producto lo usa y no tiene reglas de descuento (la FK de reglas borra en cascada). */
export async function eliminarRubro(id: string): Promise<ServiceResult<{ id: string }>> {
  const rubro = await prisma.prodRubroLista.findUnique({
    where: { id },
    select: {
      nombre: true,
      _count: { select: { reglasDescuentos: true, reglasDescEspecial: true } },
    },
  });
  if (!rubro) return { success: false, error: "Rubro no encontrado." };
  const productos = await prisma.prodTienda.count({ where: { rubro: rubro.nombre } });
  if (productos > 0) {
    return { success: false, error: `El rubro tiene ${productos} producto(s).` };
  }
  if (rubro._count.reglasDescuentos + rubro._count.reglasDescEspecial > 0) {
    return { success: false, error: "El rubro se usa en reglas de descuento de lista de precios." };
  }
  try {
    await prisma.prodRubroLista.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[listaProductos.service] eliminarRubro:", error);
    return { success: false, error: "No se pudo eliminar el rubro." };
  }
}
