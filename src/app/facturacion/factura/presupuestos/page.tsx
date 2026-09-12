import { redirect } from "next/navigation";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/** Placeholder: listado de presupuestos (aún sin datos). */
export default async function FacturaPresupuestosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.facturacion.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout title="FACTURA" subtitle="Presupuestos" contentWidth="full">
        <div className="min-h-0 flex-1" aria-hidden />
      </ClassicFilteredTableLayout>
    </div>
  );
}
