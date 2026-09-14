import { redirect } from "next/navigation";
import FacturaCrearPageClient from "@/components/facturacion/FacturaCrearPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarPtoVentasCodArca } from "@/services/globalPtoVtas.service";
import {
  listarFacturaPtoVtasActivos,
  listarFacturasAutorizadasParaNc,
} from "@/services/facturaComprobantes.service";

export const dynamic = "force-dynamic";

export default async function FacturaCrearPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [ptoVtas, condicionesIva, originalesNc] = await Promise.all([
    listarFacturaPtoVtasActivos(),
    listarPtoVentasCodArca(),
    listarFacturasAutorizadasParaNc(),
  ]);

  return (
    <div className="area-page-shell">
      <FacturaCrearPageClient
        ptoVtas={ptoVtas}
        condicionesIva={condicionesIva}
        originalesNc={originalesNc}
      />
    </div>
  );
}
