"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Palette, Plus, Ruler, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import ActCxButton from "@/components/tienda/ActCxButton";
import FiltrosTienda from "@/components/tienda/FiltrosTienda";
import TablaTienda from "@/components/tienda/TablaTienda";
import AgregarProductoTiendaModal from "@/components/tienda/AgregarProductoTiendaModal";
import GestionarCatalogosProductoTienda, {
  type CatalogoProductoTienda,
} from "@/components/tienda/GestionarCatalogosProductoTienda";
import type {
  ItemTiendaParaTabla,
  ProveedorOpcionFiltro,
  ProveedorTintoLts,
} from "@/actions/tienda";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PAGE_SIZE } from "@/lib/pagination";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";

export type FiltrosListaProductosUrl = {
  q: string;
  rubro: string;
  cxCompra: string;
  marca: string;
  proveedor: string;
  vinculado: string;
};

interface Props {
  items: ItemTiendaParaTabla[];
  total: number;
  totalPaginas: number;
  proveedores: ProveedorTintoLts[];
  marcas: string[];
  rubros: string[];
  proveedoresCxCompra: ProveedorOpcionFiltro[];
  rol: Rol;
  esEditor: boolean;
  filtros: FiltrosListaProductosUrl;
  paginaNum: number;
}

export default function ListaProductosPageClient({
  items,
  total,
  totalPaginas,
  proveedores,
  marcas,
  rubros,
  proveedoresCxCompra,
  rol,
  esEditor,
  filtros,
  paginaNum,
}: Props) {
  const router = useRouter();
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [gestionando, setGestionando] = useState<CatalogoProductoTienda | null>(null);
  const puedeEditarCxProd = puede(rol, PERMISOS.cxPxTienda.acceso);
  const cerrarGestion = useCallback(() => setGestionando(null), []);

  const refrescar = () => router.refresh();

  const actions = (
    <>
      {esEditor ? (
        <Button type="button" size="sm" onClick={() => setAgregarAbierto(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Agregar Item
        </Button>
      ) : null}
      {puedeEditarCxProd ? <ActCxButton /> : null}
      <Button type="button" size="sm" variant="outline" onClick={() => setGestionando("marcas")}>
        <Tags className="h-4 w-4" aria-hidden />
        Gestionar Marcas
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setGestionando("rubros")}>
        <FolderTree className="h-4 w-4" aria-hidden />
        Gestionar Rubros
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setGestionando("colores")}>
        <Palette className="h-4 w-4" aria-hidden />
        Gestionar Colores
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setGestionando("presentacion")}>
        <Ruler className="h-4 w-4" aria-hidden />
        Gestionar Presentación
      </Button>
    </>
  );

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="Lista Productos"
        actions={actions}
        filters={
          <FiltrosTienda
            modoFiltroTercero="cxCompra"
            marcas={marcas}
            rubros={rubros}
            proveedores={proveedores}
            proveedoresCxCompra={proveedoresCxCompra}
            qActual={filtros.q}
            marcaActual={filtros.marca}
            rubroActual={filtros.rubro}
            cxCompraActual={filtros.cxCompra}
            proveedorActual={filtros.proveedor}
            vinculadoActual={filtros.vinculado}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-0.5">
          <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
            <TablaTienda items={items} rol={rol} puedeEditarCxProd={puedeEditarCxProd} esEditor={esEditor} />
          </div>
          {totalPaginas > 1 ? (
            <div className="flex shrink-0 justify-end pt-2">
              <PaginacionTabla
                basePath={GP_ROUTES.analisisPrecios.listaPropia.listaProductos}
                params={filtros}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </ClassicFilteredTableLayout>

      <AgregarProductoTiendaModal
        open={agregarAbierto}
        onOpenChange={setAgregarAbierto}
        onCreado={refrescar}
      />
      <GestionarCatalogosProductoTienda
        abierto={gestionando}
        onClose={cerrarGestion}
        esEditor={esEditor}
        onCatalogoChanged={refrescar}
      />
    </div>
  );
}
