import { redirect } from "next/navigation";
import VentasMensualesPageClient from "@/components/finanzas/VentasMensualesPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarVentasMensuales } from "@/services/ventasMensuales.service";

export const dynamic = "force-dynamic";

export default async function VentasMensualesPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  return <VentasMensualesPageClient data={await listarVentasMensuales()} />;
}
