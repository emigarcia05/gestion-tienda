import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  MarcaCatalogoItem,
  OpcionCatalogoItem,
  RubroCatalogoItem,
} from "@/lib/listaProductos";
import type {
  CrearMarcaInput,
  CrearProductoTiendaItemInput,
  CrearProductosTiendaLoteInput,
  EditarProductoTiendaInput,
  CrearRubroInput,
  CrearSubRubroInput,
  EditarMarcaInput,
  EditarRubroInput,
  EditarSubRubroInput,
} from "@/lib/validations/listaProductos";
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
// Alta de producto (Lista Productos · Agregar Item)
// ---------------------------------------------------------------------------

/** Próximo `cod_tienda` numérico (máximo numérico actual + 1). Ignora códigos no numéricos. */
async function siguienteCodTienda(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ max: bigint | null }[]>`
    SELECT MAX(cod_tienda::bigint) AS max FROM prod_propios WHERE cod_tienda ~ '^[0-9]+$'
  `;
  const max = rows[0]?.max ?? BigInt(0);
  return (max + BigInt(1)).toString();
}

type CamposProductoTienda = Pick<
  CrearProductoTiendaItemInput,
  "descripcion" | "idRubro" | "idSubRubro" | "idMarca" | "idPresentacion" | "idColor" | "bulto"
>;

/** Valida los catálogos elegidos (sub-rubro del rubro elegido) y arma las FKs de `prod_propios`. */
async function resolverCamposProductoTienda(tx: Prisma.TransactionClient, campos: CamposProductoTienda) {
  const etiqueta = campos.descripcion.trim().toLocaleUpperCase("es-AR");
  const [rubro, subRubro, marca, presentacion, color] = await Promise.all([
    tx.prodRubro.findUnique({ where: { id: campos.idRubro }, select: { id: true } }),
    campos.idSubRubro
      ? tx.prodSubRubro.findUnique({ where: { id: campos.idSubRubro }, select: { id: true, idRubro: true } })
      : null,
    tx.marca.findUnique({ where: { id: campos.idMarca }, select: { id: true } }),
    campos.idPresentacion
      ? tx.prodPresentacion.findUnique({ where: { id: campos.idPresentacion }, select: { id: true } })
      : null,
    campos.idColor
      ? tx.prodColor.findUnique({ where: { id: campos.idColor }, select: { id: true } })
      : null,
  ]);
  if (!rubro) throw new ErrorNegocio(`${etiqueta}: el rubro elegido ya no existe.`);
  if (campos.idSubRubro && !subRubro) throw new ErrorNegocio(`${etiqueta}: el sub-rubro elegido ya no existe.`);
  if (subRubro && subRubro.idRubro !== rubro.id) {
    throw new ErrorNegocio(`${etiqueta}: el sub-rubro no pertenece al rubro elegido.`);
  }
  if (!marca) throw new ErrorNegocio(`${etiqueta}: la marca elegida ya no existe.`);
  if (campos.idPresentacion && !presentacion) {
    throw new ErrorNegocio(`${etiqueta}: la presentación elegida ya no existe.`);
  }
  if (campos.idColor && !color) throw new ErrorNegocio(`${etiqueta}: el color elegido ya no existe.`);
  return {
    etiqueta,
    data: {
      descripcionTienda: campos.descripcion.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR"),
      idRubro: rubro.id,
      idSubRubro: subRubro?.id ?? null,
      idMarca: marca.id,
      idPresentacion: presentacion?.id ?? null,
      idColor: color?.id ?? null,
      bulto: campos.bulto,
    },
  };
}

async function crearUnProductoTienda(
  tx: Prisma.TransactionClient,
  item: CrearProductoTiendaItemInput,
  cod: string
): Promise<void> {
  const [{ etiqueta, data }, lineaProveedor] = await Promise.all([
    resolverCamposProductoTienda(tx, item),
    item.codExtVinculo
      ? tx.listaPrecioProveedor.findUnique({
          where: { codExt: item.codExtVinculo },
          select: { codExt: true, codTiendaVinculo: true },
        })
      : null,
  ]);
  if (item.codExtVinculo) {
    if (!lineaProveedor) throw new ErrorNegocio(`${etiqueta}: la línea de proveedor ya no existe.`);
    if (lineaProveedor.codTiendaVinculo) {
      throw new ErrorNegocio(
        `${etiqueta}: la línea de proveedor ya está vinculada al ítem ${lineaProveedor.codTiendaVinculo}.`
      );
    }
  }

  await tx.prodPropio.create({
    data: {
      ...data,
      codTienda: cod,
      esProductoPropio: item.esProductoPropio,
      costoCompraCodExt: lineaProveedor?.codExt ?? null,
      costoCompra: 0,
    },
  });
  if (lineaProveedor) {
    await tx.listaPrecioProveedor.update({
      where: { codExt: lineaProveedor.codExt },
      data: { codTiendaVinculo: cod },
    });
  }
}

/**
 * Alta en lote (Agregar Item): todo o nada. Cada ítem toma el siguiente `cod_tienda` correlativo y,
 * si no es propio, queda vinculado a su línea de proveedor, que además pasa a ser su CX COMPRA.
 */
export async function crearProductosTiendaLote(
  input: CrearProductosTiendaLoteInput
): Promise<ServiceResult<{ codTiendas: string[] }>> {
  try {
    const codTiendas = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_COD_TIENDA})`;
        const primero = BigInt(await siguienteCodTienda(tx));
        const codigos: string[] = [];
        for (const [i, item] of input.items.entries()) {
          const cod = (primero + BigInt(i)).toString();
          await crearUnProductoTienda(tx, item, cod);
          codigos.push(cod);
        }
        return codigos;
      },
      { timeout: 60_000 }
    );
    return { success: true, data: { codTiendas } };
  } catch (error) {
    if (error instanceof ErrorNegocio) return { success: false, error: error.message };
    console.error("[listaProductos.service] crearProductosTiendaLote:", error);
    return { success: false, error: "No se pudieron crear los productos." };
  }
}

// ---------------------------------------------------------------------------
// Edición y baja (Lista Productos · ACCIONES de la fila)
// ---------------------------------------------------------------------------

export async function editarProductoTienda(
  input: EditarProductoTiendaInput
): Promise<ServiceResult<{ codTienda: string }>> {
  try {
    await prisma.$transaction(async (tx) => {
      const existe = await tx.prodPropio.findUnique({
        where: { codTienda: input.codTienda },
        select: { codTienda: true },
      });
      if (!existe) throw new ErrorNegocio("El producto ya no existe.");
      const { data } = await resolverCamposProductoTienda(tx, input);
      await tx.prodPropio.update({ where: { codTienda: input.codTienda }, data });
    });
    return { success: true, data: { codTienda: input.codTienda } };
  } catch (error) {
    if (error instanceof ErrorNegocio) return { success: false, error: error.message };
    console.error("[listaProductos.service] editarProductoTienda:", error);
    return { success: false, error: "No se pudo guardar el producto." };
  }
}

/**
 * Baja bloqueada si el producto tiene historia (stock, transferencias, compras, ventas o estadísticas).
 * Sin historia: borra sus reglas de reposición; los vínculos con proveedores quedan libres (FK SET NULL)
 * y precios de lista / competencia se borran en cascada.
 */
export async function eliminarProductoTienda(
  codTienda: string
): Promise<ServiceResult<{ codTienda: string }>> {
  try {
    await prisma.$transaction(async (tx) => {
      const existe = await tx.prodPropio.findUnique({ where: { codTienda }, select: { codTienda: true } });
      if (!existe) throw new ErrorNegocio("El producto ya no existe.");
      const [movStock, transferencias, compras, ventas, estadisticas] = await Promise.all([
        tx.stockMovimiento.count({ where: { codItem: codTienda } }),
        tx.stockTransferenciaItem.count({ where: { codItem: codTienda } }),
        tx.pedidoHistoriaItem.count({ where: { codTienda } }),
        tx.comprobanteVtaItem.count({ where: { codTienda } }),
        tx.estPorProd.count({ where: { codTienda } }),
      ]);
      const usos = [
        movStock > 0 && "movimientos de stock",
        transferencias > 0 && "transferencias",
        compras > 0 && "pedidos / compras",
        ventas > 0 && "comprobantes de venta",
        estadisticas > 0 && "estadísticas de ventas",
      ].filter((u): u is string => Boolean(u));
      if (usos.length > 0) {
        throw new ErrorNegocio(`No se puede borrar: el producto tiene ${usos.join(", ")}.`);
      }
      await tx.prodPedMerc2.deleteMany({ where: { reposicionCodTienda: codTienda } });
      await tx.prodPropio.delete({ where: { codTienda } });
    });
    return { success: true, data: { codTienda } };
  } catch (error) {
    if (error instanceof ErrorNegocio) return { success: false, error: error.message };
    console.error("[listaProductos.service] eliminarProductoTienda:", error);
    return { success: false, error: "No se pudo borrar el producto." };
  }
}

// ---------------------------------------------------------------------------
// Presentaciones y colores (Selects de Agregar Item)
// ---------------------------------------------------------------------------

export async function listarPresentacionesOpciones(): Promise<OpcionCatalogoItem[]> {
  const rows = await prisma.prodPresentacion.findMany({
    orderBy: { texto: "asc" },
    select: { id: true, texto: true },
  });
  return rows.map((r) => ({ id: r.id, nombre: r.texto }));
}

export async function listarColoresOpciones(): Promise<OpcionCatalogoItem[]> {
  return prisma.prodColor.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
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
 * Renombrar actualiza también el texto `marca` de `prod_precios_provee`
 * (las reglas de descuento comparan por nombre contra ese texto). `prod_propios` solo guarda `id_marca`.
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
// Rubros (`prod_rubros`) y sub-rubros (`prod_sub_rubros`); `prod_propios` los referencia por FK
// ---------------------------------------------------------------------------

export async function listarRubrosCatalogo(): Promise<RubroCatalogoItem[]> {
  const rubros = await prisma.prodRubro.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      _count: { select: { prodPropios: true } },
      subRubros: {
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, _count: { select: { prodPropios: true } } },
      },
    },
  });
  return rubros.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    productos: r._count.prodPropios,
    subRubros: r.subRubros.map((s) => ({ id: s.id, nombre: s.nombre, productos: s._count.prodPropios })),
  }));
}

export async function crearRubro(input: CrearRubroInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  try {
    const created = await prisma.prodRubro.create({ data: { nombre }, select: { id: true } });
    return { success: true, data: created };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "Ya existe un rubro con ese nombre." };
    }
    console.error("[listaProductos.service] crearRubro:", error);
    return { success: false, error: "No se pudo crear el rubro." };
  }
}

/** Renombrar actualiza también el texto `prod_precios_provee.rubro` (listas de proveedor). */
export async function editarRubro(input: EditarRubroInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  const actual = await prisma.prodRubro.findUnique({
    where: { id: input.id },
    select: { nombre: true },
  });
  if (!actual) return { success: false, error: "Rubro no encontrado." };
  if (actual.nombre === nombre) return { success: true, data: { id: input.id } };
  try {
    await prisma.$transaction([
      prisma.prodRubro.update({ where: { id: input.id }, data: { nombre } }),
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

/**
 * Solo si ningún producto lo usa y no tiene reglas de descuento (la FK de reglas borra en cascada).
 * Sus sub-rubros (sin productos, porque el rubro no tiene) se borran en cascada.
 */
export async function eliminarRubro(id: string): Promise<ServiceResult<{ id: string }>> {
  const rubro = await prisma.prodRubro.findUnique({
    where: { id },
    select: {
      _count: { select: { prodPropios: true, reglasDescuentos: true, reglasDescEspecial: true } },
    },
  });
  if (!rubro) return { success: false, error: "Rubro no encontrado." };
  const productos = rubro._count.prodPropios;
  if (productos > 0) {
    return { success: false, error: `El rubro tiene ${productos} producto(s).` };
  }
  if (rubro._count.reglasDescuentos + rubro._count.reglasDescEspecial > 0) {
    return { success: false, error: "El rubro se usa en reglas de descuento de lista de precios." };
  }
  try {
    await prisma.prodRubro.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[listaProductos.service] eliminarRubro:", error);
    return { success: false, error: "No se pudo eliminar el rubro." };
  }
}

export async function crearSubRubro(input: CrearSubRubroInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  const rubro = await prisma.prodRubro.findUnique({ where: { id: input.idRubro }, select: { id: true } });
  if (!rubro) return { success: false, error: "Rubro no encontrado." };
  try {
    const created = await prisma.prodSubRubro.create({
      data: { idRubro: rubro.id, nombre },
      select: { id: true },
    });
    return { success: true, data: created };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "El rubro ya tiene un sub-rubro con ese nombre." };
    }
    console.error("[listaProductos.service] crearSubRubro:", error);
    return { success: false, error: "No se pudo crear el sub-rubro." };
  }
}

export async function editarSubRubro(input: EditarSubRubroInput): Promise<ServiceResult<{ id: string }>> {
  const nombre = normalizarNombreCatalogo(input.nombre);
  try {
    await prisma.prodSubRubro.update({ where: { id: input.id }, data: { nombre } });
    return { success: true, data: { id: input.id } };
  } catch (error) {
    if (esErrorPrisma(error, "P2025")) return { success: false, error: "Sub-rubro no encontrado." };
    if (esErrorPrisma(error, "P2002")) {
      return { success: false, error: "El rubro ya tiene un sub-rubro con ese nombre." };
    }
    console.error("[listaProductos.service] editarSubRubro:", error);
    return { success: false, error: "No se pudo actualizar el sub-rubro." };
  }
}

/** Bloqueado si algún producto lo usa (FK Restrict). */
export async function eliminarSubRubro(id: string): Promise<ServiceResult<{ id: string }>> {
  const sub = await prisma.prodSubRubro.findUnique({
    where: { id },
    select: { _count: { select: { prodPropios: true } } },
  });
  if (!sub) return { success: false, error: "Sub-rubro no encontrado." };
  if (sub._count.prodPropios > 0) {
    return { success: false, error: `El sub-rubro tiene ${sub._count.prodPropios} producto(s).` };
  }
  try {
    await prisma.prodSubRubro.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[listaProductos.service] eliminarSubRubro:", error);
    return { success: false, error: "No se pudo eliminar el sub-rubro." };
  }
}
