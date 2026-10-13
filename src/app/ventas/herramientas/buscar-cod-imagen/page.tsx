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

async function loadAsistenteIaPageData() {
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

  return {
    rol,
    configBuscarCodigo,
    configDisenarColores,
    catalogo,
    catalogosDiseno: {
      modosDiseno,
      superficies,
      objetivos,
      estilos,
      combinar,
      luzNatural,
      luzArtificial,
    },
  };
}

export default async function AsistenteIaBuscarColorImagenPage() {
  const data = await loadAsistenteIaPageData();

  return (
    <AsistenteIaBuscarColorImagenPageClient
      configBuscarCodigo={data.configBuscarCodigo}
      configDisenarColores={data.configDisenarColores}
      catalogoInicial={data.catalogo}
      catalogosDiseno={data.catalogosDiseno}
      esEditor={data.rol === "editor"}
      initialVista="buscar-codigo"
    />
  );
}
