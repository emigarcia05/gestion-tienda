import { redirect } from "next/navigation";
import MarketingIdeasPageClient from "@/components/marketing/MarketingIdeasPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarMktIdeasJerarquia } from "@/services/mktPublicacionesIdeas.service";

export const dynamic = "force-dynamic";

export default async function MarketingIdeasPublicacionesPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.marketing.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const jerarquia = await listarMktIdeasJerarquia();

  return (
    <div className="area-page-shell">
      <MarketingIdeasPageClient
        jerarquia={jerarquia}
        esEditor={rol === "editor"}
      />
    </div>
  );
}
