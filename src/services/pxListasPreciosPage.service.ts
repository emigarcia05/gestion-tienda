import type { Prisma } from "@prisma/client";
import { filtroTexto } from "@/lib/busqueda";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import { PAGE_SIZE } from "@/lib/pagination";
import type { OpcionCompetenciaRefPxListas, OpcionFiltroPxVinculado } from "@/lib/pxListasCompetenciaRef";
import type {
  ItemPxListasPreciosTabla,
  ListaPrecioPxListasColumna,
} from "@/lib/pxListasPrecios";
import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import { armarCeldaPrecioPxListas } from "@/lib/pxListasPreciosCelda";
import {
  esFiltroActualizarPxListas,
  FILTRO_ACTUALIZAR_NO,
  FILTRO_ACTUALIZAR_SI,
  hayFiltroActivoPxListas,
  MIN_CARACTERES_BUSQUEDA_PX_LISTAS,
  type FiltroActualizarPxListas,
} from "@/lib/pxListasPreciosFiltros";
import { prisma } from "@/lib/prisma";
import { getPxListasPreciosPageParamsSchema } from "@/lib/validations/pxListasPrecios";
import {
  asegurarOpcionCompetenciaRefSeleccionada,
  listarOpcionesCompetenciaRefPorCodTiendas,
  listarOpcionesFiltroPxVinculado,
} from "@/services/pxListasCompetenciaRef.service";
import { listarFinAnaMcCategorias } from "@/services/finAnaMcCategorias.service";

export type PxListasPreciosPageData = {
  items: ItemPxListasPreciosTabla[];
  total: number;
  totalPaginas: number;
  listas: ListaPrecioPxListasColumna[];
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  subRubros: Array<{ subRubro: string }>;
  /** Opciones del filtro PX VINCULADO (etiqueta = prefijo/abrev. 3 letras). */
  opcionesPxVinculado: OpcionFiltroPxVinculado[];
  /** Rangos `fin_ana_mc_cat` para CATEGORÍA MARGEN (PORC. UTILIDAD de 1 - GENERAL). */
  categoriasMc: FinAnaMcCategoriaItem[];
  /** `idLista` de **1 - GENERAL**; `null` si no existe en el catálogo. */
  idListaGeneral: number | null;
};

/** Shape vacío sin Prisma (gate de permiso / Zod). */
export function emptyPxListasPreciosPageData(): PxListasPreciosPageData {
  return {
    items: [],
    total: 0,
    totalPaginas: 1,
    listas: [],
    marcas: [],
    rubros: [],
    subRubros: [],
    opcionesPxVinculado: [],
    categoriasMc: [],
    idListaGeneral: null,
  };
}

const META_ESTATICO_TTL_MS = 60_000;
const DISTINCT_SIN_Q_TTL_MS = 60_000;

type MetaEstaticoPxListas = {
  listas: ListaPrecioPxListasColumna[];
  categoriasMc: FinAnaMcCategoriaItem[];
  opcionesPxVinculado: OpcionFiltroPxVinculado[];
  idListaGeneral: number | null;
};

type DistinctFiltrosPxListas = {
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  subRubros: Array<{ subRubro: string }>;
};

let metaEstaticoCache: { at: number; data: MetaEstaticoPxListas } | null = null;
let distinctSinQCache: { at: number; data: DistinctFiltrosPxListas } | null =
  null;

function buildWhere(params: {
  q: string;
  rubro: string;
  marca: string;
  subRubro: string;
  pxVinculado: string;
  actualizar: FiltroActualizarPxListas | "";
}): Prisma.ProdTiendaWhereInput {
  const andParts: Prisma.ProdTiendaWhereInput[] = [];
  const qListado =
    params.q.trim().length >= MIN_CARACTERES_BUSQUEDA_PX_LISTAS
      ? params.q
      : "";
  const textFilter = filtroTexto(qListado, ["descripcionTienda", "codTienda"]);
  if (textFilter.AND?.length) andParts.push(textFilter);
  if (params.rubro) andParts.push({ rubro: params.rubro });
  if (params.marca) andParts.push({ marca: params.marca });
  if (params.subRubro) andParts.push({ subRubro: params.subRubro });
  if (params.pxVinculado) {
    andParts.push({ competenciaIdPxListaGeneral: params.pxVinculado });
  }
  if (params.actualizar === FILTRO_ACTUALIZAR_SI) {
    andParts.push({ preciosListaEdicion: { some: {} } });
  } else if (params.actualizar === FILTRO_ACTUALIZAR_NO) {
    andParts.push({ preciosListaEdicion: { none: {} } });
  }
  return andParts.length ? { AND: andParts } : {};
}

function whereDistinctOpciones(
  q: string,
  extra: Prisma.ProdTiendaWhereInput
): Prisma.ProdTiendaWhereInput {
  const andParts: Prisma.ProdTiendaWhereInput[] = [extra];
  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);
  if (textFilter.AND?.length) andParts.push(textFilter);
  return { AND: andParts };
}

async function listarColumnasListas(): Promise<ListaPrecioPxListasColumna[]> {
  const rows = await prisma.prodTiendaListaPrecio.findMany({
    orderBy: [{ idLista: "asc" }],
    select: { idLista: true, nombreLista: true },
  });
  return rows.map((r) => ({
    idLista: r.idLista,
    nombreLista: r.nombreLista,
  }));
}

async function cargarMetaEstaticoPxListas(): Promise<MetaEstaticoPxListas> {
  const now = Date.now();
  if (
    metaEstaticoCache &&
    now - metaEstaticoCache.at < META_ESTATICO_TTL_MS
  ) {
    return metaEstaticoCache.data;
  }
  const [listas, categoriasMc, opcionesPxVinculado] = await Promise.all([
    listarColumnasListas(),
    listarFinAnaMcCategorias(),
    listarOpcionesFiltroPxVinculado(),
  ]);
  const data: MetaEstaticoPxListas = {
    listas,
    categoriasMc,
    opcionesPxVinculado,
    idListaGeneral: encontrarIdListaGeneralPxListas(listas),
  };
  metaEstaticoCache = { at: now, data };
  return data;
}

async function listarOpcionesDistinctFiltros(
  q: string
): Promise<DistinctFiltrosPxListas> {
  const [marcasDistinct, rubrosDistinct, subRubrosDistinct] = await Promise.all([
    prisma.prodTienda.findMany({
      select: { marca: true },
      distinct: ["marca"],
      where: whereDistinctOpciones(q, { marca: { not: null } }),
      orderBy: { marca: "asc" },
    }),
    prisma.prodTienda.findMany({
      select: { rubro: true },
      distinct: ["rubro"],
      where: whereDistinctOpciones(q, { rubro: { not: null } }),
      orderBy: { rubro: "asc" },
    }),
    prisma.prodTienda.findMany({
      select: { subRubro: true },
      distinct: ["subRubro"],
      where: whereDistinctOpciones(q, { subRubro: { not: null } }),
      orderBy: { subRubro: "asc" },
    }),
  ]);

  return {
    marcas: marcasDistinct.flatMap((m) =>
      m.marca != null ? [{ marca: m.marca }] : []
    ),
    rubros: rubrosDistinct.flatMap((r) =>
      r.rubro != null ? [{ rubro: r.rubro }] : []
    ),
    subRubros: subRubrosDistinct.flatMap((s) =>
      s.subRubro != null ? [{ subRubro: s.subRubro }] : []
    ),
  };
}

async function listarOpcionesDistinctFiltrosCached(
  q: string
): Promise<DistinctFiltrosPxListas> {
  if (q) return listarOpcionesDistinctFiltros(q);
  const now = Date.now();
  if (
    distinctSinQCache &&
    now - distinctSinQCache.at < DISTINCT_SIN_Q_TTL_MS
  ) {
    return distinctSinQCache.data;
  }
  const data = await listarOpcionesDistinctFiltros("");
  distinctSinQCache = { at: now, data };
  return data;
}

async function cargarMapsPreciosYEdicion(
  codTiendas: string[],
  idListas: number[]
): Promise<{
  duxMap: Map<string, number>;
  pxEdicionMap: Map<string, number>;
}> {
  const duxMap = new Map<string, number>();
  const pxEdicionMap = new Map<string, number>();

  if (codTiendas.length === 0 || idListas.length === 0) {
    return { duxMap, pxEdicionMap };
  }

  const [duxRows, edicionRows] = await Promise.all([
    prisma.prodTiendaPrecio.findMany({
      where: { codTienda: { in: codTiendas }, idLista: { in: idListas } },
      select: { codTienda: true, idLista: true, precio: true },
    }),
    prisma.prodTiendaPrecioEdicion.findMany({
      where: { codTienda: { in: codTiendas }, idLista: { in: idListas } },
      select: { codTienda: true, idLista: true, precio: true },
    }),
  ]);

  for (const r of duxRows) {
    duxMap.set(`${r.codTienda}:${r.idLista}`, Number(r.precio));
  }
  for (const r of edicionRows) {
    pxEdicionMap.set(`${r.codTienda}:${r.idLista}`, Number(r.precio));
  }

  return { duxMap, pxEdicionMap };
}

function buildItemDesdeFila(
  row: {
    codTienda: string;
    descripcionTienda: string | null;
    costoCompra: { toString(): string };
    competenciaIdPxListaGeneral: string | null;
  },
  listas: ListaPrecioPxListasColumna[],
  duxMap: Map<string, number>,
  pxEdicionMap: Map<string, number>,
  opcionesPorCod: Map<string, OpcionCompetenciaRefPxListas[]>
): ItemPxListasPreciosTabla {
  const costoCompra = Number(row.costoCompra);
  return {
    codTienda: row.codTienda,
    descripcion: row.descripcionTienda ?? "",
    costoCompra,
    competenciaIdPxListaGeneral: row.competenciaIdPxListaGeneral,
    opcionesCompetenciaRef: opcionesPorCod.get(row.codTienda) ?? [],
    preciosPorLista: listas.map((lista) => {
      const key = `${row.codTienda}:${lista.idLista}`;
      return armarCeldaPrecioPxListas({
        idLista: lista.idLista,
        costoCompra,
        pxDux: duxMap.get(key) ?? null,
        pxEdicion: pxEdicionMap.get(key) ?? null,
      });
    }),
  };
}

type FilaListadoPxListas = {
  codTienda: string;
  descripcionTienda: string | null;
  costoCompra: { toString(): string };
  competenciaIdPxListaGeneral: string | null;
};

const SELECT_FILA_LISTADO = {
  codTienda: true,
  descripcionTienda: true,
  costoCompra: true,
  competenciaIdPxListaGeneral: true,
} as const;

async function listarPaginaProdTiendaPxListas(
  where: Prisma.ProdTiendaWhereInput,
  skip: number
): Promise<{ rows: FilaListadoPxListas[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.prodTienda.findMany({
      where,
      select: SELECT_FILA_LISTADO,
      orderBy: [{ descripcionTienda: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.prodTienda.count({ where }),
  ]);
  return { rows, total };
}

async function enriquecerItemsPxListas(
  rows: FilaListadoPxListas[],
  listas: ListaPrecioPxListasColumna[],
  idListas: number[]
): Promise<ItemPxListasPreciosTabla[]> {
  const codTiendas = rows.map((r) => r.codTienda);
  const extraCompetenciaIds = [
    ...new Set(
      rows
        .map((r) => r.competenciaIdPxListaGeneral)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const [{ duxMap, pxEdicionMap }, opcionesPorCod] = await Promise.all([
    cargarMapsPreciosYEdicion(codTiendas, idListas),
    listarOpcionesCompetenciaRefPorCodTiendas(codTiendas, extraCompetenciaIds),
  ]);
  await asegurarOpcionCompetenciaRefSeleccionada(opcionesPorCod, rows);
  return rows.map((row) =>
    buildItemDesdeFila(row, listas, duxMap, pxEdicionMap, opcionesPorCod)
  );
}

export async function getPxListasPreciosPageDataFromDb(params: {
  q?: string;
  rubro?: string;
  marca?: string;
  subRubro?: string;
  actualizar?: string;
  pxVinculado?: string;
  pagina?: string;
}): Promise<PxListasPreciosPageData> {
  const parsed = getPxListasPreciosPageParamsSchema.safeParse(params);
  if (!parsed.success) {
    return emptyPxListasPreciosPageData();
  }

  const {
    q = "",
    rubro = "",
    marca = "",
    subRubro = "",
    actualizar: actualizarRaw = "",
    pxVinculado = "",
    pagina = "1",
  } = parsed.data;

  const actualizar: FiltroActualizarPxListas | "" = esFiltroActualizarPxListas(
    actualizarRaw
  )
    ? actualizarRaw
    : "";

  const qDistinct =
    q.trim().length >= MIN_CARACTERES_BUSQUEDA_PX_LISTAS ? q : "";
  const listarItems = hayFiltroActivoPxListas({
    q,
    rubro,
    marca,
    subRubro,
    pxVinculado,
    actualizar,
  });

  const where = buildWhere({
    q,
    rubro,
    marca,
    subRubro,
    pxVinculado,
    actualizar,
  });
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const skip = (paginaNum - 1) * PAGE_SIZE;

  const [metaEstatico, distincts, listado] = await Promise.all([
    cargarMetaEstaticoPxListas(),
    listarOpcionesDistinctFiltrosCached(qDistinct),
    listarItems
      ? listarPaginaProdTiendaPxListas(where, skip)
      : Promise.resolve({ rows: [] as FilaListadoPxListas[], total: 0 }),
  ]);

  const items: ItemPxListasPreciosTabla[] = listarItems
    ? await enriquecerItemsPxListas(
        listado.rows,
        metaEstatico.listas,
        metaEstatico.listas.map((l) => l.idLista)
      )
    : [];

  const total = listado.total;
  const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

  return {
    items,
    total,
    totalPaginas,
    listas: metaEstatico.listas,
    marcas: distincts.marcas,
    rubros: distincts.rubros,
    subRubros: distincts.subRubros,
    opcionesPxVinculado: metaEstatico.opcionesPxVinculado,
    categoriasMc: metaEstatico.categoriasMc,
    idListaGeneral: metaEstatico.idListaGeneral,
  };
}
