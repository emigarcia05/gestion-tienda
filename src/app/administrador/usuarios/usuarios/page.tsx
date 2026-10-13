import { redirect } from "next/navigation";
import UsuariosPageClient from "@/components/usuarios/UsuariosPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listGlobalPersonal } from "@/services/globalPersonal.service";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const items = await listGlobalPersonal();

  return (
    <div className="area-page-shell">
      <UsuariosPageClient items={items} esEditor={rol === "editor"} />
    </div>
  );
}
