import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getPxCompetenciaPageData } from "@/actions/pxCompetencia";
import { esFiltroPxPromedioCompetencia } from "@/lib/pxCompetenciaFiltros";
import type { FiltroPxPromedioCompetencia } from "@/lib/pxCompetenciaFiltros";
import PxCompetenciaPageClient from "@/components/px-competencia/PxCompetenciaPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    rubro?: string;
    marca?: string;
    filtroPxPromedio?: string;
    pagina?: string;
  }>;
}

export default async function PxCompetenciaPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.cxPxTienda.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const sp = await searchParams;
  const {
    q = "",
    rubro = "",
    marca = "",
    filtroPxPromedio: filtroPxPromedioRaw = "",
    pagina = "1",
  } = sp;

  const filtroPxPromedio: FiltroPxPromedioCompetencia = esFiltroPxPromedioCompetencia(
    filtroPxPromedioRaw
  )
    ? filtroPxPromedioRaw
    : "";

  const { items, total, totalPaginas, marcas, rubros, competencias } =
    await getPxCompetenciaPageData({
      q,
      rubro,
      marca,
      filtroPxPromedio,
      pagina,
    });
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);

  return (
    <PxCompetenciaPageClient
      items={items}
      total={total}
      totalPaginas={totalPaginas}
      marcas={marcas}
      rubros={rubros}
      competencias={competencias}
      rol={rol}
      q={q}
      rubro={rubro}
      marca={marca}
      filtroPxPromedio={filtroPxPromedio}
      paginaNum={paginaNum}
    />
  );
}
