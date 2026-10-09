import { redirect } from "next/navigation";
import EnviosConductorPageClient from "@/components/envios/EnviosConductorPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarClientes } from "@/services/clientes.service";
import { listarEnviosDirecciones } from "@/services/enviosDirecciones.service";
import {
  listarEnviosPendientesConductor,
  listarSucursalesParaEnvios,
} from "@/services/enviosFinal.service";

export const dynamic = "force-dynamic";

export default async function EnviosConductorPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.envios.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const [envios, clientes, direcciones, sucursales] = await Promise.all([
    listarEnviosPendientesConductor(),
    listarClientes(),
    listarEnviosDirecciones(),
    listarSucursalesParaEnvios(),
  ]);

  return (
    <div className="area-page-shell">
      <EnviosConductorPageClient
        envios={envios}
        clientes={clientes}
        direcciones={direcciones}
        sucursales={sucursales}
      />
    </div>
  );
}
