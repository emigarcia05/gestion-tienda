"use server";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";

import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { filtroTexto } from "@/lib/busqueda";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/pagination";
import type { CxProdDatosFila } from "@/lib/cxPxTienda";
import { CX_PROD_SELECCION_PROM } from "@/lib/cxPxTienda";
import { getTiendaPageParamsSchema } from "@/lib/validations/tienda";
import { prismaCuidSchema } from "@/lib/validations/common";
import { buildCxProdMapDesdeFilas } from "@/services/cxPxTiendaRows.service";
import { buildMapPrecioListaPrincipal } from "@/services/prodTiendaPrecios.service";
import {
  buildMapStockeable,
  buildMapsStockSucursalesPrincipales,
  getStockeableFromMap,
} from "@/services/prodTiendaStock.service";
import { setProductoPropioTienda } from "@/services/productoPropioTienda.service";
import {
  listarNombresCatalogoProdPropios,
  nombresCatalogoProdPropio,
  SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
  whereCatalogoProdPropio,
} from "@/services/prodPropiosCatalogos.service";
import { bultoProdTiendaValido } from "@/services/tiendaBultos.service";
import { setProductoPropioTiendaSchema } from "@/lib/validations/productoPropioTienda";
import { revalidatePath } from "next/cache";
import { esEditor } from "@/lib/sesion";
import type { ActionResult } from "@/lib/types";

const CX_PROD_FILA_VACIA: CxProdDatosFila = {
  opcionesProveedor: [],
  seleccion: CX_PROD_SELECCION_PROM,
  costoPromedio: null,
  costoMostrado: 0,
};

export type ProveedorOpcionFiltro = {
  id: string;
  nombre: string;
  prefijo: string;
};

const proveedorCxCompraSelect = {
  id: true,
  nombre: true,
  prefijo: true,
} as const;

/** Proveedores con al menos un ítem tienda que usa su fila en CX PROD. (`costo_compra_cod_ext`). */
async function listarProveedoresCxCompraOpciones(): Promise<ProveedorOpcionFiltro[]> {
  const rows = await prisma.proveedor.findMany({
    where: {
      proveedorMercaderia: true,
      listaPrecios: {
        some: { costoListaEnTiendas: { some: {} } },
      },
    },
    select: proveedorCxCompraSelect,
    orderBy: { nombre: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    prefijo: p.prefijo ?? "",
  }));
}

/** Respuesta vacía con opciones de filtros (marcas, rubros, subRubros, proveedores) para reutilizar en sinFiltros y filtro `vinculado` sin resultados. */
async function getTiendaEmptyWithOpciones() {
  const [proveedores, proveedoresCxCompra, catalogo] =
    await Promise.all([
      prisma.proveedor.findMany({
        where: { proveedorMercaderia: true },
        select: {
          id: true,
          nombre: true,
          prefijo: true,
          codigoUnico: true,
          coeficienteTintometrico: true,
        },
      }),
      listarProveedoresCxCompraOpciones(),
      listarNombresCatalogoProdPropios(),
    ]);
  return {
    items: [] as ItemTiendaParaTabla[],
    total: 0,
    proveedores: proveedores.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      prefijo: p.prefijo ?? "",
      codigoUnico: p.codigoUnico,
      coeficienteTintometrico: Number(p.coeficienteTintometrico),
    })),
    proveedoresCxCompra,
    marcas: catalogo.marcas.map((marca) => ({ marca })),
    rubros: catalogo.rubros.map((rubro) => ({ rubro })),
    subRubros: catalogo.subRubros.map((subRubro) => ({ subRubro })),
    totalPaginas: 0,
  };
}

/** Tipo de ítem que espera la tabla /tienda (mapeado desde ProdTienda). */
export interface ItemTiendaParaTabla {
  id: string;
  codItem: string;
  descripcion: string;
  rubro: string | null;
  subRubro: string | null;
  marca: string | null;
  proveedorDux: string | null;  // prefijo de proveedores o texto proveedor
  codigoExterno: string | null;
  costo: number;
  porcIva: number;
  precioLista: number;
  precioMayorista: number;
  stockGuaymallen: number;
  stockMaipu: number;
  /** Derivado de DUX: ambos depósitos informan `ctd_disponible` no nulo. */
  stockeable: boolean;
  habilitado: boolean;
  _count: { productos: number };
  /** Costo producto (columna CX PROD. en Cx Compra). */
  cxProd: CxProdDatosFila;
  /** Producto propio TiendaColor (sin vínculos a lista proveedor). */
  esProductoPropio: boolean;
  /** Unidades por bulto (`prod_propios.bulto`); `null` = vacío. */
  bulto: number | null;
  idRubro: string | null;
  idSubRubro: string | null;
  idMarca: string | null;
  idPresentacion: string | null;
  /** `prod_presentaciones.texto`. */
  presentacion: string | null;
  idColor: string | null;
  /** `prod_colores.nombre`. */
  color: string | null;
}

export interface ProveedorTintoLts {
  id: string;
  nombre: string;
  /** Vacío si el proveedor no tiene prefijo de 3 letras. */
  prefijo: string;
  codigoUnico: string;
  coeficienteTintometrico: number;
}

export async function getProveedoresTintoLts(): Promise<ProveedorTintoLts[]> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.tintoLts)) return [];

  const proveedores = await prisma.proveedor.findMany({
    where: { proveedorMercaderia: true },
    select: {
      id: true,
      nombre: true,
      prefijo: true,
      codigoUnico: true,
      coeficienteTintometrico: true,
    },
    orderBy: { nombre: "asc" },
  });

  return proveedores.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    prefijo: p.prefijo ?? "",
    codigoUnico: p.codigoUnico,
    coeficienteTintometrico: Number(p.coeficienteTintometrico),
  }));
}

/**
 * Datos para la página /tienda desde prod_propios.
 * Mapeo: cod_tienda → codItem, descripcion_tienda → descripcion, costo_compra → costo,
 * proveedor → proveedorDux (resuelto a prefijo de proveedores cuando hay match).
 */
export async function getTiendaPageData(params: {
  q?: string;
  rubro?: string;
  subRubro?: string;
  cxCompra?: string;
  marca?: string;
  proveedor?: string;
  vinculado?: string;
  pagina?: string;
}) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.acceso)) {
    return getTiendaEmptyWithOpciones();
  }

  const parsedParams = getTiendaPageParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return getTiendaEmptyWithOpciones();
  }
  const {
    q = "",
    rubro = "",
    subRubro = "",
    cxCompra = "",
    marca = "",
    proveedor = "",
    vinculado: vinculadoRaw = "",
    pagina = "1",
  } = parsedParams.data;

  const vNorm = (vinculadoRaw ?? "").toLowerCase();
  const vinculado = vNorm === "no" || vNorm === "si" ? vNorm : "";

  const andParts: Prisma.ProdPropioWhereInput[] = [];
  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);
  if (textFilter.AND?.length) andParts.push(textFilter);
  andParts.push(...whereCatalogoProdPropio({ rubro, subRubro, marca }));
  // Filtro CX COMPRA: ítems cuyo CX PROD. apunta a una fila lista de ese proveedor (`costo_compra_cod_ext`).
  const cxCompraIdParsed = prismaCuidSchema.safeParse(cxCompra);
  if (cxCompraIdParsed.success) {
    andParts.push({
      costoListaProveedor: { idProveedor: cxCompraIdParsed.data },
    });
  }
  // Filtro PROV. VINC.: ítems con al menos un vínculo manual habilitado al proveedor seleccionado (idProveedor, CUID).
  // Tolerante con URLs legacy: si el valor no parsea como CUID, se ignora el filtro (no rompe la pantalla).
  const proveedorIdParsed = prismaCuidSchema.safeParse(proveedor);
  if (proveedorIdParsed.success) {
    andParts.push({
      listaPreciosProveedores: {
        some: { idProveedor: proveedorIdParsed.data, habilitado: true },
      },
    });
  }

  /* Filtro VINCULADO: sin vínculo vs. con vínculo; los productos propios no cuentan como «no vinculados». */
  if (vinculado === "no") {
    andParts.push({
      esProductoPropio: false,
      listaPreciosProveedores: { none: {} },
    });
  } else if (vinculado === "si") {
    andParts.push({ listaPreciosProveedores: { some: {} } });
  }

  const where: Prisma.ProdPropioWhereInput = andParts.length ? { AND: andParts } : {};

  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const skip = (paginaNum - 1) * PAGE_SIZE;

  /* Opciones de filtros: cada desplegable muestra siempre la lista completa de su dimensión (ver docs/FILTROS_DINAMICOS.md). Solo se aplica filtro de búsqueda (q) si existe. */
  const whereSoloQ: Prisma.ProdPropioWhereInput = textFilter.AND?.length ? textFilter : {};

  const [rows, total, proveedores, proveedoresCxCompra, catalogo] =
    await Promise.all([
      prisma.prodPropio.findMany({
        where,
        orderBy: [{ descripcionTienda: "asc" }],
        include: {
          _count: { select: { listaPreciosProveedores: true } },
          presentacion: { select: { texto: true } },
          color: { select: { nombre: true } },
          ...SELECT_NOMBRES_CATALOGO_PROD_PROPIO,
        },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.prodPropio.count({ where }),
      prisma.proveedor.findMany({
        where: { proveedorMercaderia: true },
        select: {
          id: true,
          nombre: true,
          prefijo: true,
          codigoUnico: true,
          coeficienteTintometrico: true,
        },
      }),
      listarProveedoresCxCompraOpciones(),
      listarNombresCatalogoProdPropios(whereSoloQ),
    ]);

  const nombreToPrefijo = new Map(
    proveedores.map((p) => [
      p.nombre.toLowerCase().trim(),
      (p.prefijo?.trim() || p.codigoUnico) as string,
    ])
  );

  const cxProdMap = await buildCxProdMapDesdeFilas(
    rows.map((r) => ({
      codTienda: r.codTienda,
      costoCompra: r.costoCompra,
      costoCompraCodExt: r.costoCompraCodExt,
    }))
  );
  const codTiendasPage = rows.map((r) => r.codTienda);
  const [pxListaMap, stockMaps, stockeableMap] = await Promise.all([
    buildMapPrecioListaPrincipal(codTiendasPage),
    buildMapsStockSucursalesPrincipales(codTiendasPage),
    buildMapStockeable(codTiendasPage),
  ]);

  const items: ItemTiendaParaTabla[] = rows.map((r) => {
    const proveedorTexto = r.proveedor?.trim() ?? null;
    const prefijo = proveedorTexto ? nombreToPrefijo.get(proveedorTexto.toLowerCase()) ?? proveedorTexto : null;
    return {
      id: r.codTienda,
      codItem: r.codTienda,
      descripcion: r.descripcionTienda ?? "",
      ...nombresCatalogoProdPropio(r),
      idRubro: r.idRubro,
      idSubRubro: r.idSubRubro,
      proveedorDux: prefijo,
      codigoExterno: null,
      costo: Number(r.costoCompra),
      porcIva: 21,
      precioLista: pxListaMap.get(r.codTienda) ?? 0,
      precioMayorista: 0,
      stockGuaymallen: stockMaps.guaymallen.get(r.codTienda) ?? 0,
      stockMaipu: stockMaps.maipu.get(r.codTienda) ?? 0,
      stockeable: getStockeableFromMap(stockeableMap, r.codTienda),
      habilitado: true,
      _count: { productos: r._count.listaPreciosProveedores },
      cxProd: cxProdMap.get(r.codTienda) ?? CX_PROD_FILA_VACIA,
      esProductoPropio: r.esProductoPropio,
      bulto: bultoProdTiendaValido(r.bulto),
      idMarca: r.idMarca,
      idPresentacion: r.idPresentacion,
      presentacion: r.presentacion?.texto ?? null,
      idColor: r.idColor,
      color: r.color?.nombre ?? null,
    };
  });

  const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

  return {
    items,
    total,
    proveedores: proveedores.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      prefijo: p.prefijo ?? "",
      codigoUnico: p.codigoUnico,
      coeficienteTintometrico: Number(p.coeficienteTintometrico),
    })),
    proveedoresCxCompra,
    marcas: catalogo.marcas.map((marca) => ({ marca })),
    rubros: catalogo.rubros.map((rubro) => ({ rubro })),
    subRubros: catalogo.subRubros.map((subRubro) => ({ subRubro })),
    totalPaginas,
  };
}

export async function setProductoPropioTiendaAction(
  raw: unknown
): Promise<ActionResult<{ esProductoPropio: boolean }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.tienda.tabla.vinculos)) {
    return { ok: false, error: "Sin permisos para gestionar vínculos." };
  }
  if (!(await esEditor())) {
    return { ok: false, error: "Sin permisos de editor." };
  }
  const parsed = setProductoPropioTiendaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos." };
  }
  try {
    const data = await setProductoPropioTienda(
      parsed.data.codTienda,
      parsed.data.esProductoPropio
    );
    revalidatePath("/tienda");
    revalidatePath(GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra);
    revalidatePath(GP_ROUTES.analisisPrecios.listaPropia.listaProductos);
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo actualizar el producto propio.";
    return { ok: false, error: msg };
  }
}


