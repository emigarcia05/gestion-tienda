import { redirect } from "next/navigation";
import FacturaClientesListaPageClient from "@/components/facturacion/FacturaClientesListaPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarClientesConProyectos } from "@/services/clientes.service";
import { listarPtoVentasCodArca } from "@/services/globalPtoVtas.service";

export const dynamic = "force-dynamic";

export default async function FacturaClientesListaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [items, condicionesIva] = await Promise.all([
    listarClientesConProyectos(),
    listarPtoVentasCodArca(),
  ]);

  return (
    <div className="area-page-shell">
      <FacturaClientesListaPageClient items={items} condicionesIva={condicionesIva} />
    </div>
  );
}
