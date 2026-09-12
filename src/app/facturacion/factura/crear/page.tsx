import { redirect } from "next/navigation";
import FacturaCrearPageClient from "@/components/facturacion/FacturaCrearPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function FacturaCrearPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  return (
    <div className="area-page-shell">
      <FacturaCrearPageClient />
    </div>
  );
}
