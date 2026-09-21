import { redirect } from "next/navigation";
import FacturaListadoPageClient from "@/components/facturacion/FacturaListadoPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import {
  listarPresupuestosComprobantes,
  listarSucursalesFiltroFacturas,
} from "@/services/facturaComprobantesListado.service";

export const dynamic = "force-dynamic";

export default async function FacturaPresupuestosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [items, sucursales] = await Promise.all([
    listarPresupuestosComprobantes(),
    listarSucursalesFiltroFacturas(),
  ]);

  return (
    <div className="area-page-shell">
      <FacturaListadoPageClient
        items={items}
        sucursales={sucursales}
        variant="presupuestos"
      />
    </div>
  );
}
