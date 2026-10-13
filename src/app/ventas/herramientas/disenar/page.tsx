import { redirect } from "next/navigation";
import AsistenteIaBuscarColorImagenPageClient from "@/components/asistente-ia/AsistenteIaBuscarColorImagenPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import {
  listarProdIaDisenoPromps,
  resolverConfigAsistenteIa,
} from "@/services/prodIaDisenoPromp.service";
import { listarProdIaDisenoCatalogoNombre } from "@/services/prodIaDisenoCatalogos.service";

export const dynamic = "force-dynamic";

export default async function AsistenteIaDisenarColoresPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.asistenteIa.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [
    configBuscarCodigo,
    configDisenarColores,
    catalogo,
    modosDiseno,
    superficies,
    objetivos,
    estilos,
    combinar,
    luzNatural,
    luzArtificial,
  ] = await Promise.all([
    resolverConfigAsistenteIa("buscar_codigo"),
    resolverConfigAsistenteIa("disenar_colores"),
    listarProdIaDisenoPromps(),
    listarProdIaDisenoCatalogoNombre("modo_diseno"),
    listarProdIaDisenoCatalogoNombre("sup_pintar"),
    listarProdIaDisenoCatalogoNombre("objetivo"),
    listarProdIaDisenoCatalogoNombre("estilos"),
    listarProdIaDisenoCatalogoNombre("combinar"),
    listarProdIaDisenoCatalogoNombre("luz_natural"),
    listarProdIaDisenoCatalogoNombre("luz_artificial"),
  ]);

  return (
    <AsistenteIaBuscarColorImagenPageClient
      configBuscarCodigo={configBuscarCodigo}
      configDisenarColores={configDisenarColores}
      catalogoInicial={catalogo}
      catalogosDiseno={{
        modosDiseno,
        superficies,
        objetivos,
        estilos,
        combinar,
        luzNatural,
        luzArtificial,
      }}
      esEditor={rol === "editor"}
      initialVista="disenar-colores"
    />
  );
}
