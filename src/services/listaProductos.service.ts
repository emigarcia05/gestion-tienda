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
  EditarMarcaInput,
  EditarRubroInput,
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
  "descripcion" | "idRubro" | "subRubro" | "idMarca" | "idPresentacion" | "idColor" | "bulto"
>;

/** Valida los catálogos elegidos y arma las columnas de `prod_propios` (texto rubro/marca + FKs). */
async function resolverCamposProductoTienda(tx: Prisma.TransactionClient, campos: CamposProductoTienda) {
  const etiqueta = campos.descripcion.trim().toLocaleUpperCase("es-AR");
  const [rubro, marca, presentacion, color] = await Promise.all([
    tx.prodRubroLista.findUnique({ where: { id: campos.idRubro }, select: { nombre: true } }),
    tx.marca.findUnique({ where: { id: campos.idMarca }, select: { id: true, nombre: true } }),
    campos.idPresentacion
      ? tx.estPorProdPresentacion.findUnique({ where: { id: campos.idPresentacion }, select: { id: true } })
      : null,
    campos.idColor
      ? tx.estPorProdColor.findUnique({ where: { id: campos.idColor }, select: { id: true } })
      : null,
  ]);
  if (!rubro) throw new ErrorNegocio(`${etiqueta}: el rubro elegido ya no existe.`);
  if (!marca) throw new ErrorNegocio(`${etiqueta}: la marca elegida ya no existe.`);
  if (campos.idPresentacion && !presentacion) {
    throw new ErrorNegocio(`${etiqueta}: la presentación elegida ya no existe.`);
  }
  if (campos.idColor && !color) throw new ErrorNegocio(`${etiqueta}: el color elegido ya no existe.`);
  return {
    etiqueta,
    data: {
      descripcionTienda: campos.descripcion.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR"),
      rubro: rubro.nombre,
      subRubro: campos.subRubro ? normalizarNombreCatalogo(campos.subRubro) : null,
      marca: marca.nombre,
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
  const rows = await prisma.estPorProdPresentacion.findMany({
    orderBy: { texto: "asc" },
    select: { id: true, texto: true },
  });
  return rows.map((r) => ({ id: r.id, nombre: r.texto }));
}

export async function listarColoresOpciones(): Promise<OpcionCatalogoItem[]> {
  return prisma.estPorProdColor.findMany({
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
 * Renombrar actualiza también el texto `marca` de `prod_propios` (vinculados) y de `prod_precios_provee`
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
            prisma.prodPropio.updateMany({ where: { idMarca: input.id }, data: { marca: nombre } }),
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
// Rubros (`prod_rubros_lista`; `prod_propios.rubro` guarda el nombre como texto)
// ---------------------------------------------------------------------------

export async function listarRubrosCatalogo(): Promise<RubroCatalogoItem[]> {
  await listarRubrosCatalogoReglasDesdeProdTienda();
  const [rubros, conteos] = await Promise.all([
    prisma.prodRubroLista.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.prodPropio.groupBy({ by: ["rubro"], where: { rubro: { not: null } }, _count: true }),
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

/** Renombrar actualiza el texto en `prod_propios.rubro` y `prod_precios_provee.rubro`. */
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
      prisma.prodPropio.updateMany({ where: { rubro: actual.nombre }, data: { rubro: nombre } }),
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
  const productos = await prisma.prodPropio.count({ where: { rubro: rubro.nombre } });
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
