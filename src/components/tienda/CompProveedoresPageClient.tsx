"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import ActCxButton from "@/components/tienda/ActCxButton";
import TablaTienda from "@/components/tienda/TablaTienda";
import FiltrosTienda from "@/components/tienda/FiltrosTienda";
import { PAGE_SIZE } from "@/lib/pagination";
import type {
  ItemTiendaParaTabla,
  ProveedorOpcionFiltro,
  ProveedorTintoLts,
} from "@/actions/tienda";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";

interface Props {
  items: ItemTiendaParaTabla[];
  total: number;
  totalPaginas: number;
  proveedores: ProveedorTintoLts[];
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  proveedoresCxCompra: ProveedorOpcionFiltro[];
  rol: Rol;
  q: string;
  rubro: string;
  cxCompra: string;
  marca: string;
  proveedor: string;
  vinculado: string;
  paginaNum: number;
}

export default function CompProveedoresPageClient({
  items,
  total,
  totalPaginas,
  proveedores,
  marcas,
  rubros,
  proveedoresCxCompra,
  rol,
  q,
  rubro,
  cxCompra,
  marca,
  proveedor,
  vinculado,
  paginaNum,
}: Props) {
  const puedeEditarCxProd = puede(rol, PERMISOS.cxPxTienda.acceso);
  const filters = (
    <FiltrosTienda
      modoFiltroTercero="cxCompra"
      marcas={marcas.map((m) => m.marca)}
      rubros={rubros.map((r) => r.rubro)}
      proveedores={proveedores}
      proveedoresCxCompra={proveedoresCxCompra}
      qActual={q}
      marcaActual={marca}
      rubroActual={rubro}
      cxCompraActual={cxCompra}
      proveedorActual={proveedor}
      vinculadoActual={vinculado}
    />
  );

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="Cx Compra"
        filters={filters}
        actions={
          puedeEditarCxProd ? (
            <div className="flex shrink-0 items-center gap-2">
              <ActCxButton />
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col h-full min-h-0 gap-2">
          <div className="flex flex-col flex-1 min-h-0 gap-0.5">
          <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
            <TablaTienda
              items={items}
              rol={rol}
              puedeEditarCxProd={puedeEditarCxProd}
            />
          </div>
          {totalPaginas > 1 && (
            <div className="flex justify-end pt-2 shrink-0">
              <PaginacionTabla
                basePath={GP_ROUTES.analisisPrecios.cxYPxTienda.cxCompra}
                params={{ q, rubro, cxCompra, marca, proveedor, vinculado }}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          )}
          </div>
        </div>
      </ClassicFilteredTableLayout>
    </div>
  );
}
