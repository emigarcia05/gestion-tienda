import { redirect } from "next/navigation";
import WhatsappPruebaPageClient from "@/components/whatsapp/WhatsappPruebaPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function WhatsappPruebaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.whatsappPrueba.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  return (
    <div className="area-page-shell">
      <WhatsappPruebaPageClient />
    </div>
  );
}
