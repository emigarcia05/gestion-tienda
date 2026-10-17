import EnviosConductorPageClient from "@/components/envios/EnviosConductorPageClient";
import { listarClientes } from "@/services/clientes.service";
import { tokenEnviosConductorValido } from "@/services/enviosConductorPublico.service";
import { listarEnviosDirecciones } from "@/services/enviosDirecciones.service";
import {
  listarEnviosPendientesConductor,
  listarSucursalesParaEnvios,
} from "@/services/enviosFinal.service";

export const dynamic = "force-dynamic";

/** Link público del Conductor: sin login; el middleware encierra al visitante en esta ruta. */
export default async function EnviosConductorPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!tokenEnviosConductorValido(token)) {
    return (
      <div className="area-page-shell flex items-center justify-center">
        <p className="text-sm text-muted-foreground">El link no es válido.</p>
      </div>
    );
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
        tokenPublico={token}
      />
    </div>
  );
}
