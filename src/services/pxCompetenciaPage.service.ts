import type { Prisma } from "@prisma/client";
import { filtroTexto } from "@/lib/busqueda";
import {
  esFiltroPxPromedioCompetencia,
  filtrarItemsPxCompetenciaEnMemoria,
  requierePostProcesoPxCompetencia,
  type FiltroPxPromedioCompetencia,
} from "@/lib/pxCompetenciaFiltros";
import { PAGE_SIZE } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getPxCompetenciaPageParamsSchema } from "@/lib/validations/pxCompetencia";
import {
  listCompetencias,
  type CompetenciaParaCliente,
} from "@/services/competencia.service";
import { buildPxCompetenciaItemsDesdeFilas } from "@/services/pxCompetenciaRows.service";
import type { ItemPxCompetenciaTabla } from "@/lib/pxCompetencia";
import { buildMapPrecioListaPrincipal } from "@/services/prodTiendaPrecios.service";
import {
  listarNombresCatalogoProdPropios,
  whereCatalogoProdPropio,
} from "@/services/prodPropiosCatalogos.service";

type FilaPxCompetenciaBase = {
  codTienda: string;
  descripcion: string;
  costoCompra: number;
  pxListaTienda: number;
};

async function filasConPrecioListaPrincipal(
  rows: Array<{
    codTienda: string;
    descripcionTienda: string | null;
    costoCompra: { toString(): string };
  }>
): Promise<FilaPxCompetenciaBase[]> {
  const pxMap = await buildMapPrecioListaPrincipal(rows.map((r) => r.codTienda));
  return rows.map((r) => ({
    codTienda: r.codTienda,
    descripcion: r.descripcionTienda ?? "",
    costoCompra: Number(r.costoCompra),
    pxListaTienda: pxMap.get(r.codTienda) ?? 0,
  }));
}

function buildWherePxListas(params: {
  q: string;
  rubro: string;
  marca: string;
}): Prisma.ProdPropioWhereInput {
  const andParts: Prisma.ProdPropioWhereInput[] = [{ compararCompetencia: true }];
  const textFilter = filtroTexto(params.q, ["descripcionTienda", "codTienda"]);
  if (textFilter.AND?.length) andParts.push(textFilter);
  andParts.push(...whereCatalogoProdPropio({ rubro: params.rubro, marca: params.marca }));
  return { AND: andParts };
}

const selectBase = {
  codTienda: true,
  descripcionTienda: true,
  costoCompra: true,
} as const;

async function getPxListasPageEmpty(): Promise<{
  items: ItemPxCompetenciaTabla[];
  total: number;
  totalPaginas: number;
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  competencias: CompetenciaParaCliente[];
}> {
  const [catalogo, competencias] = await Promise.all([
    listarNombresCatalogoProdPropios({ compararCompetencia: true }),
    listCompetencias(),
  ]);
  return {
    items: [],
    total: 0,
    totalPaginas: 1,
    marcas: catalogo.marcas.map((marca) => ({ marca })),
    rubros: catalogo.rubros.map((rubro) => ({ rubro })),
    competencias,
  };
}

async function listarItemsPxListasPostProcesados(
  where: Prisma.ProdPropioWhereInput,
  opts: {
    filtroPxPromedio: FiltroPxPromedioCompetencia;
    paginaNum: number;
  }
) {
  const rows = await prisma.prodPropio.findMany({
    where,
    select: selectBase,
    orderBy: [{ descripcionTienda: "asc" }],
  });
  const filas = await filasConPrecioListaPrincipal(rows);
  const built = await buildPxCompetenciaItemsDesdeFilas(filas);
  let items = filtrarItemsPxCompetenciaEnMemoria(built.items, {
    filtroPxPromedio: opts.filtroPxPromedio,
  });
  const total = items.length;
  const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);
  const skip = (opts.paginaNum - 1) * PAGE_SIZE;
  items = items.slice(skip, skip + PAGE_SIZE);
  return { items, total, totalPaginas, competencias: built.competencias };
}

export async function getPxCompetenciaPageDataFromDb(params: {
  q?: string;
  rubro?: string;
  marca?: string;
  filtroPxPromedio?: string;
  pagina?: string;
}) {
  const parsed = getPxCompetenciaPageParamsSchema.safeParse(params);
  if (!parsed.success) {
    return getPxListasPageEmpty();
  }

  const {
    q = "",
    rubro = "",
    marca = "",
    filtroPxPromedio: filtroPxPromedioRaw = "",
    pagina = "1",
  } = parsed.data;

  const filtroPxPromedio: FiltroPxPromedioCompetencia = esFiltroPxPromedioCompetencia(
    filtroPxPromedioRaw
  )
    ? filtroPxPromedioRaw
    : "";

  const where = buildWherePxListas({ q, rubro, marca });
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const postProceso = requierePostProcesoPxCompetencia({ filtroPxPromedio });

  const textFilter = filtroTexto(q, ["descripcionTienda", "codTienda"]);
  const whereOpciones: Prisma.ProdPropioWhereInput = textFilter.AND?.length
    ? { AND: [textFilter, { compararCompetencia: true }] }
    : { compararCompetencia: true };
  const catalogo = await listarNombresCatalogoProdPropios(whereOpciones);
  const marcas = catalogo.marcas.map((m) => ({ marca: m }));
  const rubros = catalogo.rubros.map((r) => ({ rubro: r }));

  if (postProceso) {
    const { items, total, totalPaginas, competencias } =
      await listarItemsPxListasPostProcesados(where, {
        filtroPxPromedio,
        paginaNum,
      });
    return {
      items,
      total,
      totalPaginas,
      marcas,
      rubros,
      competencias,
    };
  }

  const skip = (paginaNum - 1) * PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.prodPropio.findMany({
      where,
      select: selectBase,
      orderBy: [{ descripcionTienda: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.prodPropio.count({ where }),
  ]);

  const filas = await filasConPrecioListaPrincipal(rows);
  const { items, competencias } = await buildPxCompetenciaItemsDesdeFilas(filas);
  const totalPaginas = total <= 0 ? 1 : Math.ceil(total / PAGE_SIZE);

  return { items, total, totalPaginas, marcas, rubros, competencias };
}
