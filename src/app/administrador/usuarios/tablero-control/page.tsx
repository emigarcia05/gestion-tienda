import { redirect } from "next/navigation";
import TableroControlPageClient from "@/components/usuarios/TableroControlPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listGlobalPersonal } from "@/services/globalPersonal.service";

export const dynamic = "force-dynamic";

export default async function TableroControlPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const items = await listGlobalPersonal();

  return (
    <div className="area-page-shell">
      <TableroControlPageClient items={items} />
    </div>
  );
}
