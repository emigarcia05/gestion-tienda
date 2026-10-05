"use client";

import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Users } from "lucide-react";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import PaginacionTabla from "@/components/shared/PaginacionTabla";
import { Button } from "@/components/ui/button";
import FiltrosPxCompetencia from "@/components/px-competencia/FiltrosPxCompetencia";
import TablaPxCompetencia from "@/components/px-competencia/TablaPxCompetencia";
import AgregarProductoComparacionModal from "@/components/px-competencia/AgregarProductoComparacionModal";
import GestionCompetidoresModal from "@/components/precios-competencia/GestionCompetidoresModal";
import SincronizarCompetenciaModal from "@/components/precios-competencia/SincronizarCompetenciaModal";
import CompetenciaSyncProgresoBanner from "@/components/precios-competencia/CompetenciaSyncProgresoBanner";
import { PAGE_SIZE } from "@/lib/pagination";
import type { FiltroPxPromedioCompetencia } from "@/lib/pxCompetenciaFiltros";
import type { ItemPxCompetenciaTabla } from "@/lib/pxCompetencia";
import type { CompetenciaParaCliente } from "@/services/competencia.service";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";

const BASE_PATH = GP_ROUTES.analisisPrecios.pxCompetencia;

interface Props {
  items: ItemPxCompetenciaTabla[];
  total: number;
  totalPaginas: number;
  marcas: Array<{ marca: string }>;
  rubros: Array<{ rubro: string }>;
  competencias: CompetenciaParaCliente[];
  rol: Rol;
  q: string;
  rubro: string;
  marca: string;
  filtroPxPromedio: FiltroPxPromedioCompetencia;
  paginaNum: number;
}

export default function PxCompetenciaPageClient({
  items,
  total,
  totalPaginas,
  marcas,
  rubros,
  competencias,
  rol,
  q,
  rubro,
  marca,
  filtroPxPromedio,
  paginaNum,
}: Props) {
  const router = useRouter();
  const [gestionCompetidoresOpen, setGestionCompetidoresOpen] = useState(false);
  const [syncCompetenciaOpen, setSyncCompetenciaOpen] = useState(false);
  const [agregarProductoOpen, setAgregarProductoOpen] = useState(false);
  const puedeEditar = puede(rol, PERMISOS.cxPxTienda.acceso);
  const puedeEditarEnlaces = puede(rol, PERMISOS.competenciaPrecios.editar);
  const puedeGestionarCompetidores = puede(rol, PERMISOS.competenciaPrecios.editar);

  const headerActions = puedeGestionarCompetidores ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="default"
        className="btn-primario-gestion gap-2 shrink-0"
        onClick={() => setAgregarProductoOpen(true)}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        Prod. Comparar
      </Button>
      <Button
        type="button"
        variant="default"
        className="btn-primario-gestion gap-2 shrink-0"
        onClick={() => setGestionCompetidoresOpen(true)}
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        Gestionar Competidores
      </Button>
      <Button
        type="button"
        variant="default"
        className="btn-primario-gestion gap-2 shrink-0"
        onClick={() => setSyncCompetenciaOpen(true)}
      >
        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
        Comparar Precios Competencia
      </Button>
    </div>
  ) : undefined;

  const filters = (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      {puedeGestionarCompetidores ? <CompetenciaSyncProgresoBanner /> : null}
      <FiltrosPxCompetencia
        marcas={marcas.map((m) => m.marca)}
        rubros={rubros.map((r) => r.rubro)}
        qActual={q}
        marcaActual={marca}
        rubroActual={rubro}
        filtroPxPromedioActual={filtroPxPromedio}
      />
    </div>
  );

  return (
    <div className="area-page-shell bg-gris">
      <ClassicFilteredTableLayout
        title="Px Competencia"
        filters={filters}
        actions={headerActions}
      >
        <div className="flex flex-col h-full min-h-0 gap-0.5">
          <div className="contenedor-tabla-gestion no-scroll-x flex-1 min-h-0">
            <TablaPxCompetencia
              items={items}
              competencias={competencias}
              puedeEditar={puedeEditar}
              puedeEditarEnlaces={puedeEditarEnlaces}
              puedeQuitarComparacion={puedeGestionarCompetidores}
            />
          </div>
          {totalPaginas > 1 && (
            <div className="flex justify-end pt-2 shrink-0">
              <PaginacionTabla
                basePath={BASE_PATH}
                params={{ q, rubro, marca, filtroPxPromedio }}
                paginaActual={paginaNum}
                totalPaginas={totalPaginas}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          )}
        </div>
      </ClassicFilteredTableLayout>
      {puedeGestionarCompetidores ? (
        <>
          <AgregarProductoComparacionModal
            open={agregarProductoOpen}
            onOpenChange={setAgregarProductoOpen}
            onAgregado={() => {
              setAgregarProductoOpen(false);
              router.refresh();
            }}
          />
          <GestionCompetidoresModal
            open={gestionCompetidoresOpen}
            onOpenChange={setGestionCompetidoresOpen}
            onChanged={() => router.refresh()}
          />
          <SincronizarCompetenciaModal
            open={syncCompetenciaOpen}
            onOpenChange={setSyncCompetenciaOpen}
            onCompletado={() => router.refresh()}
          />
        </>
      ) : null}
    </div>
  );
}
