import { clampPercent } from "@/lib/calculos";
import { prisma } from "@/lib/prisma";
import type {
  ActualizarReglaDescEspecialInput,
  CrearReglaDescEspecialInput,
} from "@/lib/validations/descEspecialReglas";
import { normalizarTextoCondicionRegla } from "@/services/descuentosListaPrecioReglas.service";
import type { ServiceResult } from "@/types/service.types";

export interface ReglaDescEspecialListaPrecio {
  id: string;
  nombre: string;
  valor: number;
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
  proveedorPrefijo: string | null;
  marcaNombre: string | null;
  rubroNombre: string | null;
  cantidadProductos: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReglaDescEspecialDetalle extends ReglaDescEspecialListaPrecio {
  codigosExt: string[];
}

const CHUNK_MATERIALIZACION = 500;

const includeFiltrosRegla = {
  proveedor: { select: { prefijo: true } },
  marca: { select: { nombre: true } },
  rubro: { select: { nombre: true } },
} as const;

interface FiltrosReglaDescEspecial {
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
}

async function validarProductosCoincidenFiltros(
  codigosExt: string[],
  filtros: FiltrosReglaDescEspecial
): Promise<ServiceResult<undefined>> {
  if (codigosExt.length === 0) return { success: true, data: undefined };

  const [productos, marcaRow, rubroRow] = await Promise.all([
    prisma.listaPrecioProveedor.findMany({
      where: { codExt: { in: codigosExt } },
      select: { codExt: true, idProveedor: true, marca: true, rubro: true },
    }),
    filtros.idMarca
      ? prisma.marca.findUnique({
          where: { id: filtros.idMarca },
          select: { nombre: true },
        })
      : Promise.resolve(null),
    filtros.idRubro
      ? prisma.prodRubro.findUnique({
          where: { id: filtros.idRubro },
          select: { nombre: true },
        })
      : Promise.resolve(null),
  ]);

  const nombreMarcaFiltro = marcaRow?.nombre ?? null;
  const nombreRubroFiltro = rubroRow?.nombre ?? null;

  for (const codExt of codigosExt) {
    const producto = productos.find((p) => p.codExt === codExt);
    if (!producto) {
      return { success: false, error: `Producto no encontrado: ${codExt}.` };
    }
    if (filtros.idProveedor && producto.idProveedor !== filtros.idProveedor) {
      return {
        success: false,
        error: `El producto ${codExt} no pertenece al proveedor seleccionado.`,
      };
    }
    if (nombreMarcaFiltro) {
      const marcaItem = normalizarTextoCondicionRegla(producto.marca);
      if (marcaItem !== normalizarTextoCondicionRegla(nombreMarcaFiltro)) {
        return {
          success: false,
          error: `El producto ${codExt} no coincide con la marca del filtro.`,
        };
      }
    }
    if (nombreRubroFiltro) {
      const rubroItem = normalizarTextoCondicionRegla(producto.rubro);
      if (rubroItem !== normalizarTextoCondicionRegla(nombreRubroFiltro)) {
        return {
          success: false,
          error: `El producto ${codExt} no coincide con el rubro del filtro.`,
        };
      }
    }
  }

  return { success: true, data: undefined };
}

async function validarCodigosNoAsignadosAOtraRegla(
  codigosExt: string[],
  reglaIdExcluir?: string
): Promise<ServiceResult<undefined>> {
  if (codigosExt.length === 0) return { success: true, data: undefined };

  const conflictos = await prisma.prodPrecioDescEspecialReglaProducto.findMany({
    where: {
      listaPrecioProveedorCodExt: { in: codigosExt },
      ...(reglaIdExcluir ? { reglaId: { not: reglaIdExcluir } } : {}),
    },
    select: {
      listaPrecioProveedorCodExt: true,
      regla: { select: { nombre: true } },
    },
  });

  if (conflictos.length > 0) {
    const primero = conflictos[0]!;
    return {
      success: false,
      error: `El producto ${primero.listaPrecioProveedorCodExt} ya está en la regla «${primero.regla.nombre}».`,
    };
  }

  const existentes = await prisma.listaPrecioProveedor.findMany({
    where: { codExt: { in: codigosExt } },
    select: { codExt: true },
  });
  const existentesSet = new Set(existentes.map((r) => r.codExt));
  const faltante = codigosExt.find((c) => !existentesSet.has(c));
  if (faltante) {
    return { success: false, error: `Producto no encontrado: ${faltante}.` };
  }

  return { success: true, data: undefined };
}

async function materializarDescEspecialEnCodigos(
  codigosExt: string[],
  valor: number
): Promise<number> {
  if (codigosExt.length === 0) return 0;

  const valorCapped = clampPercent(valor);
  let total = 0;

  for (let i = 0; i < codigosExt.length; i += CHUNK_MATERIALIZACION) {
    const chunk = codigosExt.slice(i, i + CHUNK_MATERIALIZACION);
    const n = await prisma.$executeRawUnsafe(
      `
      UPDATE prod_precios_provee
      SET desc_especial = $2::numeric, updated_at = CURRENT_TIMESTAMP
      WHERE cod_ext = ANY($1::text[])
      `,
      chunk,
      valorCapped
    );
    total += Number(n);
  }

  return total;
}

async function limpiarDescEspecialEnCodigos(codigosExt: string[]): Promise<number> {
  if (codigosExt.length === 0) return 0;
  return materializarDescEspecialEnCodigos(codigosExt, 0);
}

function mapReglaLista(row: {
  id: string;
  nombre: string;
  valor: { toString(): string } | number;
  idProveedor: string | null;
  idMarca: string | null;
  idRubro: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { productos: number };
  proveedor?: { prefijo: string | null } | null;
  marca?: { nombre: string } | null;
  rubro?: { nombre: string } | null;
}): ReglaDescEspecialListaPrecio {
  return {
    id: row.id,
    nombre: row.nombre,
    valor: Number(row.valor),
    idProveedor: row.idProveedor,
    idMarca: row.idMarca,
    idRubro: row.idRubro,
    proveedorPrefijo: row.proveedor?.prefijo ?? null,
    marcaNombre: row.marca?.nombre ?? null,
    rubroNombre: row.rubro?.nombre ?? null,
    cantidadProductos: row._count.productos,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listarReglasDescEspecial(): Promise<ReglaDescEspecialListaPrecio[]> {
  const rows = await prisma.prodPrecioDescEspecialRegla.findMany({
    include: {
      _count: { select: { productos: true } },
      ...includeFiltrosRegla,
    },
    orderBy: [{ nombre: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapReglaLista);
}

export async function obtenerReglaDescEspecialDetalle(
  id: string
): Promise<ReglaDescEspecialDetalle | null> {
  const row = await prisma.prodPrecioDescEspecialRegla.findUnique({
    where: { id },
    include: {
      _count: { select: { productos: true } },
      ...includeFiltrosRegla,
      productos: {
        select: { listaPrecioProveedorCodExt: true },
        orderBy: { listaPrecioProveedorCodExt: "asc" },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapReglaLista(row),
    codigosExt: row.productos.map((p) => p.listaPrecioProveedorCodExt),
  };
}

export async function crearReglaDescEspecial(
  input: CrearReglaDescEspecialInput
): Promise<ServiceResult<ReglaDescEspecialDetalle>> {
  const codigosUnicos = [...new Set(input.codigosExt)];
  const filtros: FiltrosReglaDescEspecial = {
    idProveedor: input.idProveedor ?? null,
    idMarca: input.idMarca ?? null,
    idRubro: input.idRubro ?? null,
  };
  const validacionFiltros = await validarProductosCoincidenFiltros(codigosUnicos, filtros);
  if (!validacionFiltros.success) return validacionFiltros;

  const validacion = await validarCodigosNoAsignadosAOtraRegla(codigosUnicos);
  if (!validacion.success) return validacion;

  const valor = clampPercent(input.valor);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const regla = await tx.prodPrecioDescEspecialRegla.create({
        data: {
          nombre: input.nombre.trim(),
          valor,
          idProveedor: filtros.idProveedor,
          idMarca: filtros.idMarca,
          idRubro: filtros.idRubro,
          productos: {
            create: codigosUnicos.map((codExt) => ({
              listaPrecioProveedorCodExt: codExt,
            })),
          },
        },
        include: {
          _count: { select: { productos: true } },
          ...includeFiltrosRegla,
          productos: { select: { listaPrecioProveedorCodExt: true } },
        },
      });
      return regla;
    });

    await materializarDescEspecialEnCodigos(codigosUnicos, valor);

    return {
      success: true,
      data: {
        ...mapReglaLista(row),
        codigosExt: row.productos.map((p) => p.listaPrecioProveedorCodExt),
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear la regla.";
    return { success: false, error: message };
  }
}

export async function actualizarReglaDescEspecial(
  input: ActualizarReglaDescEspecialInput
): Promise<ServiceResult<ReglaDescEspecialDetalle>> {
  const existente = await prisma.prodPrecioDescEspecialRegla.findUnique({
    where: { id: input.id },
    include: { productos: { select: { listaPrecioProveedorCodExt: true } } },
  });
  if (!existente) {
    return { success: false, error: "Regla no encontrada." };
  }

  const codigosNuevos = [...new Set(input.codigosExt)];
  const filtros: FiltrosReglaDescEspecial = {
    idProveedor: input.idProveedor ?? null,
    idMarca: input.idMarca ?? null,
    idRubro: input.idRubro ?? null,
  };
  const validacionFiltros = await validarProductosCoincidenFiltros(codigosNuevos, filtros);
  if (!validacionFiltros.success) return validacionFiltros;

  const validacion = await validarCodigosNoAsignadosAOtraRegla(codigosNuevos, input.id);
  if (!validacion.success) return validacion;

  const valor = clampPercent(input.valor);
  const codigosAnteriores = existente.productos.map((p) => p.listaPrecioProveedorCodExt);
  const codigosNuevosSet = new Set(codigosNuevos);
  const aLimpiar = codigosAnteriores.filter((c) => !codigosNuevosSet.has(c));

  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.prodPrecioDescEspecialReglaProducto.deleteMany({
        where: { reglaId: input.id },
      });

      const regla = await tx.prodPrecioDescEspecialRegla.update({
        where: { id: input.id },
        data: {
          nombre: input.nombre.trim(),
          valor,
          idProveedor: filtros.idProveedor,
          idMarca: filtros.idMarca,
          idRubro: filtros.idRubro,
          productos: {
            create: codigosNuevos.map((codExt) => ({
              listaPrecioProveedorCodExt: codExt,
            })),
          },
        },
        include: {
          _count: { select: { productos: true } },
          ...includeFiltrosRegla,
          productos: {
            select: { listaPrecioProveedorCodExt: true },
            orderBy: { listaPrecioProveedorCodExt: "asc" },
          },
        },
      });
      return regla;
    });

    await limpiarDescEspecialEnCodigos(aLimpiar);
    await materializarDescEspecialEnCodigos(codigosNuevos, valor);

    return {
      success: true,
      data: {
        ...mapReglaLista(row),
        codigosExt: row.productos.map((p) => p.listaPrecioProveedorCodExt),
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar la regla.";
    return { success: false, error: message };
  }
}

export async function eliminarReglaDescEspecial(
  id: string
): Promise<ServiceResult<{ actualizados: number }>> {
  const existente = await prisma.prodPrecioDescEspecialRegla.findUnique({
    where: { id },
    include: { productos: { select: { listaPrecioProveedorCodExt: true } } },
  });
  if (!existente) {
    return { success: false, error: "Regla no encontrada." };
  }

  const codigos = existente.productos.map((p) => p.listaPrecioProveedorCodExt);

  try {
    await prisma.prodPrecioDescEspecialRegla.delete({ where: { id } });
    const actualizados = await limpiarDescEspecialEnCodigos(codigos);
    return { success: true, data: { actualizados } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al eliminar la regla.";
    return { success: false, error: message };
  }
}

/** Recalcula desc_especial en todas las filas desde reglas (mantenimiento). */
export async function recalcularTodasLasFilasDescEspecial(): Promise<number> {
  await prisma.$executeRawUnsafe(
    `UPDATE prod_precios_provee SET desc_especial = 0, updated_at = CURRENT_TIMESTAMP`
  );

  const reglas = await prisma.prodPrecioDescEspecialRegla.findMany({
    include: { productos: { select: { listaPrecioProveedorCodExt: true } } },
  });

  let total = 0;
  for (const regla of reglas) {
    const codigos = regla.productos.map((p) => p.listaPrecioProveedorCodExt);
    total += await materializarDescEspecialEnCodigos(codigos, Number(regla.valor));
  }
  return total;
}
