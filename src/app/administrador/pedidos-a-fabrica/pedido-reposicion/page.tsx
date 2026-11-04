import { redirect } from "next/navigation";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function PedidoReposicionPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.estadisticasProductos.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  return (
    <div className="area-page-shell">
      <ClassicFilteredTableLayout title="COMPRAS CORP." subtitle="Pedido Reposición">
        <p className="text-sm text-muted-foreground">
          Pedido Reposición se va a configurar más adelante.
        </p>
      </ClassicFilteredTableLayout>
    </div>
  );
}
