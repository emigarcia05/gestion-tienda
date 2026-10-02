import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinanzasTesoreriaMovimientosPageClient from "@/components/finanzas/FinanzasTesoreriaMovimientosPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarMovimientosTesoreria } from "@/services/tesoreriaMovimientos.service";

export const dynamic = "force-dynamic";

export default async function FinanzasTesoreriaMovimientosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const filas = await listarMovimientosTesoreria();
  return <FinanzasTesoreriaMovimientosPageClient filas={filas} />;
}
