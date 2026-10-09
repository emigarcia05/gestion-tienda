import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import StockMovimientosPageClient from "@/components/stock/StockMovimientosPageClient";

export const dynamic = "force-dynamic";

export default async function StockMovimientosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }
  return <StockMovimientosPageClient />;
}
