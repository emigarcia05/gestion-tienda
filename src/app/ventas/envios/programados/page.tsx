import { redirect } from "next/navigation";
import EnviosPageClient from "@/components/envios/EnviosPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { listarEnviosDirecciones } from "@/services/enviosDirecciones.service";
import {
  listarEnviosFinal,
  listarSucursalesParaEnvios,
  purgarEnviosFinalAntiguosProgramados,
} from "@/services/enviosFinal.service";
import { listarClientes } from "@/services/clientes.service";

export const dynamic = "force-dynamic";

export default async function EnviosProgramadosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.envios.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  await purgarEnviosFinalAntiguosProgramados();

  const [envios, clientes, direcciones, sucursales] = await Promise.all([
    listarEnviosFinal(),
    listarClientes(),
    listarEnviosDirecciones(),
    listarSucursalesParaEnvios(),
  ]);

  return (
    <div className="area-page-shell">
      <EnviosPageClient
        envios={envios}
        clientes={clientes}
        direcciones={direcciones}
        sucursales={sucursales}
      />
    </div>
  );
}
