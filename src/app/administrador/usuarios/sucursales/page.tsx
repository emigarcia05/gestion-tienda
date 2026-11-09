import { redirect } from "next/navigation";
import SucursalesPageClient from "@/components/usuarios/SucursalesPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarSucursalesCatalogo } from "@/services/sucursalesCatalogo.service";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.usuarios.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const items = await listarSucursalesCatalogo();

  return (
    <div className="area-page-shell">
      <SucursalesPageClient items={items} esEditor={rol === "editor"} />
    </div>
  );
}
