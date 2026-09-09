import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import VtasCobrosCobrosPageClient from "@/components/vtas-cobros/VtasCobrosCobrosPageClient";

export const dynamic = "force-dynamic";

export default async function VtasCobrosCobrosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  return <VtasCobrosCobrosPageClient />;
}
