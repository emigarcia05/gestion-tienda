import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarProdTiendaCategorizacion } from "@/services/estCategorizacion.service";
import { listarEstPorProdColores } from "@/services/estPorProdColores.service";
import { listarEstPorProdPresentaciones } from "@/services/estPorProdPresentacion.service";
import { listarEstPorProdTerminaciones } from "@/services/estPorProdTerminacion.service";
import { listarEstPorProdUnPresentaciones } from "@/services/estPorProdUnPresentacion.service";
import EstCategorizacionPageClient from "@/components/estadisticas-productos/EstCategorizacionPageClient";

export const dynamic = "force-dynamic";

export default async function EstCategorizacionPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.estadisticasProductos.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const esEditor = rol === "editor";
  const [
    filas,
    coloresCatalogo,
    presentacionesCatalogo,
    unidadesCatalogo,
    terminacionesCatalogo,
  ] = await Promise.all([
    listarProdTiendaCategorizacion(),
    listarEstPorProdColores(),
    listarEstPorProdPresentaciones(),
    listarEstPorProdUnPresentaciones(),
    listarEstPorProdTerminaciones(),
  ]);

  return (
    <div className="area-page-shell">
      <EstCategorizacionPageClient
        filas={filas}
        coloresCatalogo={coloresCatalogo}
        presentacionesCatalogo={presentacionesCatalogo}
        unidadesCatalogo={unidadesCatalogo}
        terminacionesCatalogo={terminacionesCatalogo}
        esEditor={esEditor}
      />
    </div>
  );
}
