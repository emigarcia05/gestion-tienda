import { redirect } from "next/navigation";
import FacturaCuentaCorrientePageClient from "@/components/facturacion/FacturaCuentaCorrientePageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import {
  listarNombresMarcaDistinctProdTienda,
  listarNombresRubroDistinctProdTienda,
} from "@/services/rubrosProdTienda.service";

export const dynamic = "force-dynamic";

export default async function FacturaCuentaCorrientePage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [marcasCatalogo, rubrosCatalogo] = await Promise.all([
    listarNombresMarcaDistinctProdTienda(),
    listarNombresRubroDistinctProdTienda(),
  ]);

  return (
    <div className="area-page-shell">
      <FacturaCuentaCorrientePageClient
        marcasCatalogo={marcasCatalogo}
        rubrosCatalogo={rubrosCatalogo}
      />
    </div>
  );
}
