import { redirect } from "next/navigation";
import ReposicionCorpPageClient from "@/components/reposicion-corp/ReposicionCorpPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarReposicionCorpData } from "@/services/reposicionCorp.service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    marca?: string;
    rubro?: string;
    configurado?: string;
    pagina?: string;
  }>;
}

export default async function ReposicionCorpPage({ searchParams }: Props) {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.reposicionCorp.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const sp = await searchParams;
  const q = sp.q ?? "";
  const marca = sp.marca ?? "";
  const rubro = sp.rubro ?? "";
  const configurado = sp.configurado === "si" ? "si" : "";
  const pagina = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);

  const data = await listarReposicionCorpData({
    q,
    marca,
    rubro,
    configurado,
    pagina,
  });

  return (
    <div className="area-page-shell">
      <ReposicionCorpPageClient
        items={data.items}
        total={data.total}
        totalPaginas={data.totalPaginas}
        marcas={data.marcas}
        rubros={data.rubros}
        filtros={{ q, marca, rubro, configurado }}
        paginaNum={pagina}
      />
    </div>
  );
}
