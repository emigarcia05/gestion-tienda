"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Palette, Plus, Ruler, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import ActCxButton from "@/components/tienda/ActCxButton";
import FiltrosTienda from "@/components/tienda/FiltrosTienda";
import TablaTienda from "@/components/tienda/TablaTienda";
import AgregarProductoTiendaModal from "@/components/tienda/AgregarProductoTiendaModal";
import GestionarMarcasModal from "@/components/tienda/GestionarMarcasModal";
import GestionarRubrosModal from "@/components/tienda/GestionarRubrosModal";
import GestionarEstPorProdColoresModal from "@/components/estadisticas-productos/GestionarEstPorProdColoresModal";
import GestionarEstPorProdPresentacionModal from "@/components/estadisticas-productos/GestionarEstPorProdPresentacionModal";
import { listarEstPorProdUnPresentacionesAction } from "@/actions/estPorProdUnPresentacion";
import type {
  ItemTiendaParaTabla,
  ProveedorOpcionFiltro,
  ProveedorTintoLts,
} from "@/actions/tienda";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PAGE_SIZE } from "@/lib/pagination";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";
import type { EstPorProdColorItem } from "@/lib/estPorProdColores";
import type { EstPorProdPresentacionItem } from "@/lib/estPorProdPresentacion";
import type { EstPorProdUnPresentacionItem } from "@/lib/estPorProdUnPresentacion";

/** Referencias estables: los modales de estadísticas recargan al cambiar `itemsIniciales`. */
const COLORES_INICIALES: EstPorProdColorItem[] = [];
const PRESENTACIONES_INICIALES: EstPorProdPresentacionItem[] = [];

type ModalAbierto = "agregar" | "marcas" | "rubros" | "colores" | "presentacion" | null;

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
  const [modal, setModal] = useState<ModalAbierto>(null);
  const [unidades, setUnidades] = useState<EstPorProdUnPresentacionItem[]>([]);
  const puedeEditarCxProd = puede(rol, PERMISOS.cxPxTienda.acceso);

  function cerrar(open: boolean) {
    if (!open) setModal(null);
  }

  async function abrirPresentacion() {
    const res = await listarEstPorProdUnPresentacionesAction();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setUnidades(res.data);
    setModal("presentacion");
  }

  const refrescar = () => router.refresh();

  const actions = (
    <>
      {esEditor ? (
        <Button type="button" size="sm" onClick={() => setModal("agregar")}>
          <Plus className="h-4 w-4" aria-hidden />
          Agregar Item
        </Button>
      ) : null}
      {puedeEditarCxProd ? <ActCxButton /> : null}
      <Button type="button" size="sm" variant="outline" onClick={() => setModal("marcas")}>
        <Tags className="h-4 w-4" aria-hidden />
        Gestionar Marcas
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setModal("rubros")}>
        <FolderTree className="h-4 w-4" aria-hidden />
        Gestionar Rubros
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setModal("colores")}>
        <Palette className="h-4 w-4" aria-hidden />
        Gestionar Colores
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void abrirPresentacion()}>
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

      <AgregarProductoTiendaModal open={modal === "agregar"} onOpenChange={cerrar} onCreado={refrescar} />
      <GestionarMarcasModal
        open={modal === "marcas"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        onCatalogoChanged={refrescar}
      />
      <GestionarRubrosModal
        open={modal === "rubros"}
        onOpenChange={cerrar}
        esEditor={esEditor}
        onCatalogoChanged={refrescar}
      />
      <GestionarEstPorProdColoresModal
        open={modal === "colores"}
        onOpenChange={cerrar}
        itemsIniciales={COLORES_INICIALES}
        esEditor={esEditor}
      />
      <GestionarEstPorProdPresentacionModal
        open={modal === "presentacion"}
        onOpenChange={cerrar}
        itemsIniciales={PRESENTACIONES_INICIALES}
        unidades={unidades}
        esEditor={esEditor}
      />
    </div>
  );
}
