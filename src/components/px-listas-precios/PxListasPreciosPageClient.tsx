"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import FiltrosPxListasPrecios from "@/components/px-listas-precios/FiltrosPxListasPrecios";
import TablaPxListasPrecios from "@/components/px-listas-precios/TablaPxListasPrecios";
import ActPxListasButton from "@/components/px-listas-precios/ActPxListasButton";
import { PAGE_SIZE } from "@/lib/pagination";
import type { FinAnaMcCategoriaItem } from "@/lib/finAnaMcCategorias";
import type { OpcionFiltroPxVinculado } from "@/lib/pxListasCompetenciaRef";
import type { ItemPxListasPreciosTabla, ListaPrecioPxListasColumna } from "@/lib/pxListasPrecios";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";
import {
  hayFiltroActivoPxListas,
  MENSAJE_SIN_FILTRO_PX_LISTAS,
} from "@/lib/pxListasPreciosFiltros";

const BASE_PATH = GP_ROUTES.analisisPrecios.cxYPxTienda.pxListas;

interface Props {
  items: ItemPxListasPreciosTabla[];
  total: number;
  totalPaginas: number;
  listas: ListaPrecioPxListasColumna[];
  categoriasMc: FinAnaMcCategoriaItem[];
  idListaGeneral: number | null;
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  subRubros: Array<{ subRubro: string }>;
  opcionesPxVinculado: OpcionFiltroPxVinculado[];
  rol: Rol;
  q: string;
  rubro: string;
  marca: string;
  subRubro: string;
  actualizar: string;
  pxVinculado: string;
  paginaNum: number;
}

export default function PxListasPreciosPageClient({
  items,
  total,
  totalPaginas,
  listas,
  categoriasMc,
  idListaGeneral,
  marcas,
  rubros,
  subRubros,
  opcionesPxVinculado,
  rol,
  q,
  rubro,
  marca,
  subRubro,
  actualizar,
  pxVinculado,
  paginaNum,
}: Props) {
  const puedeEditar = puede(rol, PERMISOS.cxPxTienda.acceso);
  const hayFiltro = hayFiltroActivoPxListas({
    q,
    rubro,
    marca,
    subRubro,
    pxVinculado,
    actualizar,
  });
  const mensajeVacio = hayFiltro
    ? "NO HAY PRODUCTOS."
    : MENSAJE_SIN_FILTRO_PX_LISTAS;

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="Px Listas"
        filters={
          <FiltrosPxListasPrecios
            marcas={marcas.map((m) => m.marca)}
            rubros={rubros.map((r) => r.rubro)}
            subRubros={subRubros.map((s) => s.subRubro)}
            opcionesPxVinculado={opcionesPxVinculado}
            totalItems={total}
            qActual={q}
            marcaActual={marca}
            rubroActual={rubro}
            subRubroActual={subRubro}
            actualizarActual={actualizar}
            pxVinculadoActual={pxVinculado}
          />
        }
        actions={
          puedeEditar ? (
            <div className="flex shrink-0 items-center gap-2">
              <ActPxListasButton />
            </div>
          ) : undefined
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-0.5">
          <div className="contenedor-tabla-gestion flex-1 min-h-0">
            <TablaPxListasPrecios
              items={items}
              listas={listas}
              puedeEditar={puedeEditar}
              categoriasMc={categoriasMc}
              idListaGeneral={idListaGeneral}
              mensajeVacio={mensajeVacio}
            />
          </div>
          {totalPaginas > 1 ? (
            <div className="flex shrink-0 justify-end pt-2">
              <PaginacionTabla
                basePath={BASE_PATH}
                params={{ q, rubro, marca, subRubro, actualizar, pxVinculado }}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>
    </div>
  );
}
