/**
 * Servicio Comparación por categorías.
 * Jerarquía: Categoria → Subcategoria → Presentacion.
 * Referente competencia: `prod_comp_item_referencia` (precio vía `resolverPreciosCompetenciaMostrar`).
 * Costo objetivo (SSOT): (1) `pxMostrar` de la primera referencia competencia; (2) `costo_compra_objetivo` numérico.
 */

import { calcCostoComparacion, type DatosCostoComparacion } from "@/lib/calculos";
import { prisma } from "@/lib/prisma";
import { matchByMultiTerm } from "@/lib/busqueda";
import {
  buildMapPxVtaSugerido,
  listarCompetenciasConPxSugeridoPorCodTiendas,
  resolverPrecioCompetenciaMostrar,
  resolverPreciosCompetenciaMostrar,
} from "@/services/competenciaPxSugerido.service";
import { ensureVinculoCompetenciaParaReferencia } from "@/services/competenciaVinculo.service";

const normalizeNombreCategoria = (nombre: string): string =>
  nombre.trim().toUpperCase();

export interface ReferenciaCompetenciaPresentacion {
  id: string;
  codTienda: string;
  competenciaId: string;
  competenciaNombre: string;
  /** Abreviatura: `global_proveedores.prefijo` del proveedor del competidor. */
  competenciaAbreviatura: string;
  descripcionTienda: string | null;
  pxMostrar: number | null;
  etiqueta: string;
}

export interface OpcionReferenciaCompetencia {
  codTienda: string;
  competenciaId: string;
  competenciaNombre: string;
  descripcionTienda: string | null;
  pxMostrar: number | null;
  etiqueta: string;
}

const REF_COMP_ROW_INCLUDE = {
  referenciaCompetencia: {
    include: {
      competencia: { select: { nombre: true, proveedor: { select: { prefijo: true } } } },
      prodTienda: { select: { descripcionTienda: true } },
    },
  },
} as const;

const REFERENCIAS_COMPETENCIA_INCLUDE = {
  orderBy: [{ orden: "asc" as const }, { createdAt: "asc" as const }],
  include: REF_COMP_ROW_INCLUDE,
};

async function buildReferenciaCompetenciaFromRow(row: {
  id: string;
  refCodTienda: string;
  refCompetenciaId: string;
  referenciaCompetencia: {
    competencia: { nombre: string; proveedor: { prefijo: string | null } | null };
    prodTienda: { descripcionTienda: string | null };
  };
}): Promise<ReferenciaCompetenciaPresentacion> {
  const resuelto = await resolverPrecioCompetenciaMostrar(row.refCodTienda, row.refCompetenciaId);
  const competenciaNombre = row.referenciaCompetencia.competencia.nombre;
  const prefijo = row.referenciaCompetencia.competencia.proveedor?.prefijo?.trim();
  const competenciaAbreviatura = prefijo ? prefijo.toUpperCase() : "—";
  const descripcionTienda = row.referenciaCompetencia.prodTienda.descripcionTienda;
  const etiqueta = `${competenciaNombre} — ${descripcionTienda ?? row.refCodTienda}`;

  return {
    id: row.id,
    codTienda: row.refCodTienda,
    competenciaId: row.refCompetenciaId,
    competenciaNombre,
    competenciaAbreviatura,
    descripcionTienda,
    pxMostrar: resuelto?.pxMostrar ?? null,
    etiqueta,
  };
}

async function buildReferenciasCompetenciaPresentacion(presentacion: {
  referenciasCompetencia: Array<{
    id: string;
    refCodTienda: string;
    refCompetenciaId: string;
    referenciaCompetencia: {
      competencia: { nombre: string; proveedor: { prefijo: string | null } | null };
      prodTienda: { descripcionTienda: string | null };
    };
  }>;
}): Promise<ReferenciaCompetenciaPresentacion[]> {
  if (presentacion.referenciasCompetencia.length === 0) return [];
  return Promise.all(presentacion.referenciasCompetencia.map(buildReferenciaCompetenciaFromRow));
}

const getObjetivoFromPresentacion = async (p: {
  costoCompraObjetivo: unknown;
  referenciasCompetencia: Array<{
    id: string;
    refCodTienda: string;
    refCompetenciaId: string;
    referenciaCompetencia: {
      competencia: { nombre: string; proveedor: { prefijo: string | null } | null };
      prodTienda: { descripcionTienda: string | null };
    };
  }>;
}): Promise<number | null> => {
  const refs = await buildReferenciasCompetenciaPresentacion(p);
  if (refs[0]?.pxMostrar != null) return refs[0].pxMostrar;
  if (p.costoCompraObjetivo != null) return Number(p.costoCompraObjetivo);
  return null;
};

export interface CategoriaComparacionTree {
  id: string;
  nombre: string;
  subcategorias: {
    id: string;
    nombre: string;
    presentaciones: {
      id: string;
      nombre: string;
      costoCompraObjetivo: number | null;
      referenciasCompetencia: ReferenciaCompetenciaPresentacion[];
      labelCompleto: string;
    }[];
  }[];
}

export interface ProductoEnCategoria {
  id: string;
  codExt: string;
  descripcionProveedor: string;
  marca: string | null;
  /** Costo sin IVA en Comp. Categorias (incluye `dto_extra_comparacion` si aplica). */
  pxCompraFinalSinIva: number | null;
  proveedorPrefijo: string | null;
  /** DTO. EXTRA (0-99) persistido para "Comp. Por Cat." por ítem. */
  dtoExtraComparacion: number | null;
  /** Campos de lista proveedor para recalcular costo en cliente al editar DTO. EXTRA. */
  datosCosto: DatosCostoComparacion;
  /** Dif. % vs px referencia competencia (entero) persistido en Comparacion por categorías. */
  difPxRefManualComparacion: number | null;
  costoCompraObjetivo: number | null;
  diferenciaVsObjetivo: number | null; // pxCompraFinalSinIva - objetivo (negativo = bajo objetivo)
}

function mapDatosCostoComparacion(lp: {
  pxListaProveedor: unknown;
  pxDolares: boolean;
  cotizacionDolar: unknown;
  dtoProveedor: unknown;
  dtoMarca: unknown;
  dtoRubro: unknown;
  dtoCantidad: unknown;
  dtoFinanciero: unknown;
  cxTransporte: unknown;
  descEspecial: unknown;
  pxPromoFijo?: unknown;
}): DatosCostoComparacion {
  return {
    pxListaProveedor: Number(lp.pxListaProveedor),
    pxDolares: lp.pxDolares,
    cotizacionDolar: Number(lp.cotizacionDolar),
    dtoProveedor: Number(lp.dtoProveedor),
    dtoMarca: Number(lp.dtoMarca),
    dtoRubro: Number(lp.dtoRubro),
    dtoCantidad: Number(lp.dtoCantidad),
    dtoFinanciero: Number(lp.dtoFinanciero),
    cxTransporte: Number(lp.cxTransporte),
    descEspecial: Number(lp.descEspecial),
    pxPromoFijo:
      lp.pxPromoFijo != null && Number(lp.pxPromoFijo) > 0 ? Number(lp.pxPromoFijo) : null,
  };
}

/** Árbol completo Categoria → Subcategoria → Presentacion para la UI. */
export async function getArbolCategorias(): Promise<CategoriaComparacionTree[]> {
  const categorias = await prisma.categoriaComparacion.findMany({
    orderBy: { nombre: "asc" },
    include: {
      subcategorias: {
        orderBy: { nombre: "asc" },
        include: {
          presentaciones: {
            orderBy: { nombre: "asc" },
            include: {
              referenciasCompetencia: REFERENCIAS_COMPETENCIA_INCLUDE,
            },
          },
        },
      },
    },
  });

  return Promise.all(
    categorias.map(async (c) => ({
      id: c.id,
      nombre: c.nombre,
      subcategorias: await Promise.all(
        c.subcategorias.map(async (s) => ({
          id: s.id,
          nombre: s.nombre,
          presentaciones: await Promise.all(
            s.presentaciones.map(async (p) => ({
              id: p.id,
              nombre: p.nombre,
              costoCompraObjetivo: await getObjetivoFromPresentacion(p),
              referenciasCompetencia: await buildReferenciasCompetenciaPresentacion(p),
              labelCompleto: `${c.nombre} - ${s.nombre} - ${p.nombre}`,
            }))
          ),
        }))
      ),
    }))
  );
}

/** Productos asignados a una presentación con referente de competencia. */
export async function getProductosPorPresentacion(
  presentacionId: string
): Promise<{
  productos: ProductoEnCategoria[];
  costoCompraObjetivo: number | null;
  labelCompleto: string;
  referenciasCompetencia: ReferenciaCompetenciaPresentacion[];
}> {
  const presentacion = await prisma.presentacionComparacion.findUnique({
    where: { id: presentacionId },
    include: {
      subcategoria: { include: { categoria: true } },
      referenciasCompetencia: REFERENCIAS_COMPETENCIA_INCLUDE,
      itemsComparados: {
        include: {
          listaPrecioProveedor: {
            include: {
              proveedor: { select: { prefijo: true } },
            },
          },
        },
      },
    },
  });

  if (!presentacion) {
    return {
      productos: [],
      costoCompraObjetivo: null,
      labelCompleto: "",
      referenciasCompetencia: [],
    };
  }

  const labelCompleto = `${presentacion.subcategoria.categoria.nombre} - ${presentacion.subcategoria.nombre} - ${presentacion.nombre}`;
  const referenciasCompetencia = await buildReferenciasCompetenciaPresentacion(presentacion);
  const objetivo = await getObjetivoFromPresentacion(presentacion);

  const productos: ProductoEnCategoria[] = presentacion.itemsComparados
    .map((item) => {
      const lp = item.listaPrecioProveedor;
      const dtoExtraComparacion = item.dtoExtra ?? null;
      const datosCosto = mapDatosCostoComparacion(lp);
      const pxFinal = calcCostoComparacion(datosCosto, dtoExtraComparacion);
      const dif =
        pxFinal != null && objetivo != null ? pxFinal - objetivo : null;
      return {
        id: lp.codExt,
        codExt: lp.codExt,
        descripcionProveedor: lp.descripcionProveedor,
        marca: lp.marca ?? null,
        pxCompraFinalSinIva: pxFinal,
        proveedorPrefijo: lp.proveedor?.prefijo ?? null,
        dtoExtraComparacion,
        datosCosto,
        difPxRefManualComparacion: item.difPxRefManual ?? null,
        costoCompraObjetivo: objetivo,
        diferenciaVsObjetivo: dif,
      };
    })
    .sort((a, b) => {
      const pa = a.pxCompraFinalSinIva;
      const pb = b.pxCompraFinalSinIva;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });

  return { productos, costoCompraObjetivo: objetivo, labelCompleto, referenciasCompetencia };
}

function claveOpcionReferenciaCompetencia(codTienda: string, competenciaId: string): string {
  return `${codTienda}:${competenciaId}`;
}

function tokensBusquedaReferenciaCompetencia(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

type OpcionBaseReferenciaCompetencia = {
  codTienda: string;
  competenciaId: string;
  competenciaNombre: string;
  descripcionTienda: string | null;
};

const MAX_BUSQUEDA_REFERENCIA_DB = 300;
const MAX_PRODUCTOS_BUSQUEDA_REFERENCIA = 40;

async function listarCodTiendasComparacionPorTexto(
  q: string,
  maxProductos: number
): Promise<string[]> {
  const tokens = tokensBusquedaReferenciaCompetencia(q);
  if (tokens.length === 0) return [];

  const rows = await prisma.prodTienda.findMany({
    where: {
      compararCompetencia: true,
      AND: tokens.map((token) => ({
        OR: [
          { codTienda: { contains: token, mode: "insensitive" as const } },
          { descripcionTienda: { contains: token, mode: "insensitive" as const } },
        ],
      })),
    },
    take: Math.max(maxProductos, MAX_BUSQUEDA_REFERENCIA_DB),
    orderBy: [{ descripcionTienda: "asc" }, { codTienda: "asc" }],
    select: { codTienda: true, descripcionTienda: true },
  });

  return rows
    .filter((row) => matchByMultiTerm([row.descripcionTienda, row.codTienda], q))
    .slice(0, maxProductos)
    .map((row) => row.codTienda);
}

async function armarOpcionesReferenciaPorCodTiendas(
  codTiendas: string[],
  competenciaId?: string
): Promise<OpcionBaseReferenciaCompetencia[]> {
  if (codTiendas.length === 0) return [];

  const filtroCompetenciaVinculo = competenciaId ? { competenciaId } : {};

  const [preciosRows, sugeridoRows, descripcionesTienda] = await Promise.all([
    prisma.prodPrecioCompetencia.findMany({
      where: {
        codTienda: { in: codTiendas },
        prodTienda: { compararCompetencia: true },
        ...filtroCompetenciaVinculo,
      },
      orderBy: [{ prodTienda: { descripcionTienda: "asc" } }, { competencia: { nombre: "asc" } }],
      select: {
        codTienda: true,
        competenciaId: true,
        competencia: { select: { nombre: true } },
        prodTienda: { select: { descripcionTienda: true } },
      },
    }),
    listarCompetenciasConPxSugeridoPorCodTiendas(codTiendas, competenciaId),
    prisma.prodTienda.findMany({
      where: { codTienda: { in: codTiendas } },
      select: { codTienda: true, descripcionTienda: true },
    }),
  ]);

  const descripcionPorCod = new Map(
    descripcionesTienda.map((row) => [row.codTienda, row.descripcionTienda])
  );

  const opcionesMap = new Map<string, OpcionBaseReferenciaCompetencia>();

  for (const row of preciosRows) {
    opcionesMap.set(claveOpcionReferenciaCompetencia(row.codTienda, row.competenciaId), {
      codTienda: row.codTienda,
      competenciaId: row.competenciaId,
      competenciaNombre: row.competencia.nombre,
      descripcionTienda: row.prodTienda.descripcionTienda,
    });
  }

  for (const row of sugeridoRows) {
    const key = claveOpcionReferenciaCompetencia(row.codTienda, row.competenciaId);
    if (opcionesMap.has(key)) continue;
    opcionesMap.set(key, {
      codTienda: row.codTienda,
      competenciaId: row.competenciaId,
      competenciaNombre: row.competenciaNombre,
      descripcionTienda: descripcionPorCod.get(row.codTienda) ?? null,
    });
  }

  return [...opcionesMap.values()];
}

function ordenarOpcionesReferenciaBase(
  opciones: OpcionBaseReferenciaCompetencia[]
): OpcionBaseReferenciaCompetencia[] {
  return [...opciones].sort((a, b) => {
    const cmpDesc = (a.descripcionTienda ?? a.codTienda).localeCompare(
      b.descripcionTienda ?? b.codTienda,
      "es"
    );
    if (cmpDesc !== 0) return cmpDesc;
    return a.competenciaNombre.localeCompare(b.competenciaNombre, "es");
  });
}

async function resolverOpcionesReferenciaConPrecio(
  opciones: OpcionBaseReferenciaCompetencia[]
): Promise<OpcionReferenciaCompetencia[]> {
  if (opciones.length === 0) return [];

  const codTiendas = [...new Set(opciones.map((o) => o.codTienda))];
  const competenciaIds = [...new Set(opciones.map((o) => o.competenciaId))];

  const [competencias, listaConSugerido, sugeridosDirectos] = await Promise.all([
    prisma.prodCompetencia.findMany({
      where: { id: { in: competenciaIds } },
      select: { id: true, idProveedor: true },
    }),
    prisma.listaPrecioProveedor.findMany({
      where: {
        codTiendaVinculo: { in: codTiendas },
        habilitado: true,
        pxVtaSugerido: { not: null, gt: 0 },
      },
      select: { idProveedor: true },
    }),
    listarCompetenciasConPxSugeridoPorCodTiendas(codTiendas),
  ]);

  const idProveedoresLista = [...new Set(listaConSugerido.map((row) => row.idProveedor))];

  const proveedorPorCompetencia = new Map(
    competencias.filter((c) => c.idProveedor).map((c) => [c.id, c.idProveedor as string])
  );
  const pxSugeridoDirectoPorOpcion = new Map(
    sugeridosDirectos.map((row) => [
      claveOpcionReferenciaCompetencia(row.codTienda, row.competenciaId),
      row.px,
    ])
  );
  for (const row of sugeridosDirectos) {
    if (!proveedorPorCompetencia.has(row.competenciaId)) {
      proveedorPorCompetencia.set(row.competenciaId, row.idProveedor);
    }
  }

  const idProveedores = [
    ...new Set([
      ...competencias
        .map((c) => c.idProveedor)
        .filter((id): id is string => Boolean(id)),
      ...idProveedoresLista,
      ...sugeridosDirectos.map((row) => row.idProveedor),
    ]),
  ];

  const [preciosMap, pxSugeridoMap] = await Promise.all([
    resolverPreciosCompetenciaMostrar(
      opciones.map((o) => ({ codTienda: o.codTienda, competenciaId: o.competenciaId }))
    ),
    buildMapPxVtaSugerido(codTiendas, idProveedores),
  ]);

  return opciones.map((o) => {
    const key = claveOpcionReferenciaCompetencia(o.codTienda, o.competenciaId);
    const resuelto = preciosMap.get(key);
    let pxMostrar = resuelto?.pxMostrar ?? null;
    if (pxMostrar == null) {
      const idProveedor = proveedorPorCompetencia.get(o.competenciaId);
      if (idProveedor) {
        pxMostrar = pxSugeridoMap.get(`${o.codTienda}:${idProveedor}`) ?? null;
      }
    }
    if (pxMostrar == null) {
      pxMostrar = pxSugeridoDirectoPorOpcion.get(key) ?? null;
    }
    return {
      codTienda: o.codTienda,
      competenciaId: o.competenciaId,
      competenciaNombre: o.competenciaNombre,
      descripcionTienda: o.descripcionTienda,
      pxMostrar,
      etiqueta: `${o.competenciaNombre} — ${o.descripcionTienda ?? o.codTienda}`,
    };
  });
}

function ordenarOpcionesReferenciaConPrecio(
  opciones: OpcionReferenciaCompetencia[]
): OpcionReferenciaCompetencia[] {
  return [...opciones].sort((a, b) => {
    const cmpDesc = (a.descripcionTienda ?? a.codTienda).localeCompare(
      b.descripcionTienda ?? b.codTienda,
      "es"
    );
    if (cmpDesc !== 0) return cmpDesc;
    return a.competenciaNombre.localeCompare(b.competenciaNombre, "es");
  });
}

async function buscarOpcionesReferenciaCompetenciaBrowse(
  take: number,
  competenciaId?: string
): Promise<OpcionBaseReferenciaCompetencia[]> {
  const fetchCap = Math.min(Math.max(take * 5, 200), 500);
  const filtroCompetenciaVinculo = competenciaId ? { competenciaId } : {};

  const preciosRows = await prisma.prodPrecioCompetencia.findMany({
    where: {
      prodTienda: { compararCompetencia: true },
      ...filtroCompetenciaVinculo,
    },
    take: fetchCap,
    orderBy: [{ prodTienda: { descripcionTienda: "asc" } }, { competencia: { nombre: "asc" } }],
    select: { codTienda: true },
  });

  const codTiendasFromVinculos = [...new Set(preciosRows.map((row) => row.codTienda))];

  const sugeridoRows = await listarCompetenciasConPxSugeridoPorCodTiendas(
    codTiendasFromVinculos.length > 0 ? codTiendasFromVinculos : [],
    competenciaId
  );

  let codTiendas = [
    ...new Set([
      ...codTiendasFromVinculos,
      ...sugeridoRows.map((row) => row.codTienda),
    ]),
  ].slice(0, Math.max(take, 40));

  if (codTiendas.length === 0) {
    const sugeridoSeed = await prisma.listaPrecioProveedor.findMany({
      where: {
        habilitado: true,
        pxVtaSugerido: { not: null, gt: 0 },
        codTiendaVinculo: { not: null },
        prodTienda: { compararCompetencia: true },
        ...(competenciaId
          ? { proveedor: { competenciasPrecios: { some: { id: competenciaId } } } }
          : { proveedor: { competenciasPrecios: { some: {} } } }),
      },
      take: fetchCap,
      orderBy: { updatedAt: "desc" },
      select: { codTiendaVinculo: true },
    });
    codTiendas = [
      ...new Set(
        sugeridoSeed
          .map((row) => row.codTiendaVinculo)
          .filter((cod): cod is string => Boolean(cod))
      ),
    ].slice(0, Math.max(take, 40));
  }

  return armarOpcionesReferenciaPorCodTiendas(codTiendas, competenciaId);
}

/** Opciones para elegir referente: catálogo Px Competencia (scrape + Px. Vta. Sugerido, igual `/cx-px-tienda`). */
export async function buscarOpcionesReferenciaCompetencia(params: {
  q?: string;
  take?: number;
  presentacionId?: string;
  competenciaId?: string;
}): Promise<OpcionReferenciaCompetencia[]> {
  const q = params.q?.trim() ?? "";
  const take = params.take ?? 100;
  const competenciaId = params.competenciaId?.trim() || undefined;

  const excluirKeys = new Set<string>();
  if (params.presentacionId) {
    const asignadas = await prisma.comparacionPresentacionRefComp.findMany({
      where: { presentacionId: params.presentacionId },
      select: { refCodTienda: true, refCompetenciaId: true },
    });
    for (const row of asignadas) {
      excluirKeys.add(claveOpcionReferenciaCompetencia(row.refCodTienda, row.refCompetenciaId));
    }
  }

  let opciones: OpcionBaseReferenciaCompetencia[];

  if (q) {
    const maxProductos = Math.min(
      MAX_PRODUCTOS_BUSQUEDA_REFERENCIA,
      Math.max(Math.ceil(take / 4), 1)
    );
    const codTiendas = await listarCodTiendasComparacionPorTexto(q, maxProductos);
    opciones = await armarOpcionesReferenciaPorCodTiendas(codTiendas, competenciaId);
    opciones = opciones.filter((o) =>
      matchByMultiTerm([o.descripcionTienda, o.codTienda], q)
    );
  } else {
    opciones = await buscarOpcionesReferenciaCompetenciaBrowse(take, competenciaId);
  }

  opciones = ordenarOpcionesReferenciaBase(
    opciones.filter(
      (o) => !excluirKeys.has(claveOpcionReferenciaCompetencia(o.codTienda, o.competenciaId))
    )
  );

  const resueltas = await resolverOpcionesReferenciaConPrecio(opciones);
  const asignables = resueltas.filter((o) => o.pxMostrar != null && o.pxMostrar > 0);

  return ordenarOpcionesReferenciaConPrecio(asignables).slice(0, take);
}

export interface CompetidorParaReferenciaModal {
  id: string;
  nombre: string;
  prefijoProveedor: string | null;
}

/** Lista competidores para el select del modal Agregar Referencia De Competencia. */
export async function listarCompetidoresParaReferencia(): Promise<CompetidorParaReferenciaModal[]> {
  const rows = await prisma.prodCompetencia.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      proveedor: { select: { prefijo: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    prefijoProveedor: r.proveedor?.prefijo ?? null,
  }));
}

/** Asigna referencia Px Competencia a una presentación (`prod_comp_item_referencia`). */
export async function asignarReferenciaCompetenciaPresentacion(
  presentacionId: string,
  codTienda: string,
  competenciaId: string
): Promise<ReferenciaCompetenciaPresentacion> {
  const prodTienda = await prisma.prodTienda.findUnique({
    where: { codTienda },
    select: { compararCompetencia: true },
  });
  if (!prodTienda?.compararCompetencia) {
    throw new Error("El producto no está en el catálogo de Px Competencia.");
  }

  await ensureVinculoCompetenciaParaReferencia(codTienda, competenciaId);

  const resuelto = await resolverPrecioCompetenciaMostrar(codTienda, competenciaId);
  if (resuelto?.pxMostrar == null || resuelto.pxMostrar <= 0) {
    throw new Error("No hay precio de competencia disponible para esta referencia.");
  }

  const existente = await prisma.comparacionPresentacionRefComp.findUnique({
    where: {
      presentacionId_refCodTienda_refCompetenciaId: {
        presentacionId,
        refCodTienda: codTienda,
        refCompetenciaId: competenciaId,
      },
    },
    select: { id: true },
  });
  if (existente) {
    throw new Error("Esta referencia ya está asignada a la presentación.");
  }

  const refsPrevias = await prisma.comparacionPresentacionRefComp.count({
    where: { presentacionId },
  });

  const maxOrden = await prisma.comparacionPresentacionRefComp.aggregate({
    where: { presentacionId },
    _max: { orden: true },
  });

  const created = await prisma.comparacionPresentacionRefComp.create({
    data: {
      presentacionId,
      refCodTienda: codTienda,
      refCompetenciaId: competenciaId,
      orden: (maxOrden._max.orden ?? -1) + 1,
    },
  });

  if (refsPrevias === 0) {
    await prisma.presentacionComparacion.update({
      where: { id: presentacionId },
      data: { costoCompraObjetivo: null },
    });
  }

  const row = await prisma.comparacionPresentacionRefComp.findUniqueOrThrow({
    where: { id: created.id },
    include: REF_COMP_ROW_INCLUDE,
  });

  return buildReferenciaCompetenciaFromRow({
    id: row.id,
    refCodTienda: row.refCodTienda,
    refCompetenciaId: row.refCompetenciaId,
    referenciaCompetencia: row.referenciaCompetencia,
  });
}

export async function quitarReferenciaCompetenciaItem(refCompId: string): Promise<void> {
  await prisma.comparacionPresentacionRefComp.delete({
    where: { id: refCompId },
  });
}

// ─── CRUD Categorias ────────────────────────────────────────────────────────
export async function createCategoria(nombre: string) {
  return prisma.categoriaComparacion.create({
    data: { nombre: normalizeNombreCategoria(nombre) },
  });
}

export async function updateCategoria(id: string, data: { nombre?: string }) {
  const payload: { nombre?: string } = {};
  if (data.nombre !== undefined) {
    payload.nombre = normalizeNombreCategoria(data.nombre);
  }
  return prisma.categoriaComparacion.update({ where: { id }, data: payload });
}

export async function deleteCategoria(id: string) {
  return prisma.categoriaComparacion.delete({ where: { id } });
}

// ─── CRUD Subcategorias ─────────────────────────────────────────────────────
export async function createSubcategoria(categoriaId: string, nombre: string) {
  return prisma.subcategoriaComparacion.create({
    data: { categoriaId, nombre: normalizeNombreCategoria(nombre) },
  });
}

export async function updateSubcategoria(
  id: string,
  data: { nombre?: string; categoriaId?: string }
) {
  const payload: { nombre?: string; categoriaId?: string } = {};
  if (data.nombre !== undefined) {
    payload.nombre = normalizeNombreCategoria(data.nombre);
  }
  if (data.categoriaId !== undefined) {
    payload.categoriaId = data.categoriaId;
  }
  return prisma.subcategoriaComparacion.update({ where: { id }, data: payload });
}

export async function deleteSubcategoria(id: string) {
  return prisma.subcategoriaComparacion.delete({ where: { id } });
}

// ─── CRUD Presentaciones ────────────────────────────────────────────────────
export async function createPresentacion(
  subcategoriaId: string,
  nombre: string,
  costoCompraObjetivo?: number | null
) {
  return prisma.presentacionComparacion.create({
    data: {
      subcategoriaId,
      nombre: normalizeNombreCategoria(nombre),
      costoCompraObjetivo: costoCompraObjetivo ?? null,
    },
  });
}

export type UpdatePresentacionData = {
  nombre?: string;
  subcategoriaId?: string;
  costoCompraObjetivo?: number | null;
};

export async function updatePresentacion(id: string, data: UpdatePresentacionData) {
  const payload: UpdatePresentacionData = {};
  if (data.nombre !== undefined) {
    payload.nombre = normalizeNombreCategoria(data.nombre);
  }
  if (data.subcategoriaId !== undefined) payload.subcategoriaId = data.subcategoriaId;
  if (data.costoCompraObjetivo !== undefined) payload.costoCompraObjetivo = data.costoCompraObjetivo;

  return prisma.presentacionComparacion.update({ where: { id }, data: payload });
}

export async function deletePresentacion(id: string) {
  return prisma.presentacionComparacion.delete({ where: { id } });
}

/** Asignar productos (`cod_ext`) a una presentación (`prod_comp_item_comparados`). */
export async function asignarProductosAPresentacion(
  presentacionId: string,
  codigosExtProductos: string[]
): Promise<{ count: number }> {
  if (codigosExtProductos.length === 0) return { count: 0 };

  const existentes = await prisma.listaPrecioProveedor.findMany({
    where: { codExt: { in: codigosExtProductos } },
    select: { codExt: true },
  });
  const codigosValidos = existentes.map((row) => row.codExt);
  if (codigosValidos.length === 0) return { count: 0 };

  await prisma.$transaction([
    prisma.comparacionItem.deleteMany({
      where: { listaPrecioProveedorCodExt: { in: codigosValidos } },
    }),
    prisma.comparacionItem.createMany({
      data: codigosValidos.map((codExt) => ({
        presentacionId,
        listaPrecioProveedorCodExt: codExt,
      })),
    }),
  ]);

  return { count: codigosValidos.length };
}

/** Quitar productos de la comparación por presentación (borra filas en `prod_comp_item_comparados`). */
export async function quitarAsignacionPresentacion(codigosExtProductos: string[]): Promise<{ count: number }> {
  if (codigosExtProductos.length === 0) return { count: 0 };
  const result = await prisma.comparacionItem.deleteMany({
    where: { listaPrecioProveedorCodExt: { in: codigosExtProductos } },
  });
  return { count: result.count };
}

type ComparacionItemPatch = {
  dtoExtra?: number | null;
  difPxRefManual?: number | null;
};

/** Actualiza DTO. EXTRA / DIF % REF. MAN. en la fila de membresía (`prod_comp_item_comparados`). */
async function upsertComparacionItemParcial(
  listaPrecioProveedorCodExt: string,
  patch: ComparacionItemPatch
): Promise<void> {
  const existing = await prisma.comparacionItem.findFirst({
    where: { listaPrecioProveedorCodExt },
    select: { id: true, dtoExtra: true, difPxRefManual: true },
  });

  if (!existing) {
    throw new Error("El producto no está asignado a una presentación de comparación.");
  }

  const dtoExtra =
    patch.dtoExtra !== undefined ? patch.dtoExtra : (existing.dtoExtra ?? null);
  const difPxRefManual =
    patch.difPxRefManual !== undefined
      ? patch.difPxRefManual
      : (existing.difPxRefManual ?? null);

  await prisma.comparacionItem.update({
    where: { id: existing.id },
    data: { dtoExtra, difPxRefManual },
  });
}

/** Persistir DTO. EXTRA para "Comp. Por Cat." por ítem (ListaPrecioProveedor). */
export async function actualizarDtoExtraComparacionItem(
  listaPrecioProveedorCodExt: string,
  dtoExtra: number | null
): Promise<void> {
  await upsertComparacionItemParcial(listaPrecioProveedorCodExt, { dtoExtra });
}

/** Persistir dif. % vs px referencia (entero con signo) por ítem en Comparacion. */
export async function actualizarDifPxRefManualComparacionItem(
  listaPrecioProveedorCodExt: string,
  difPxRefManual: number | null
): Promise<void> {
  await upsertComparacionItemParcial(listaPrecioProveedorCodExt, { difPxRefManual });
}
