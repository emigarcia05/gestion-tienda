import { redirect } from "next/navigation";
import ConsultaTecnicaPageClient from "@/components/ventas/ConsultaTecnicaPageClient";
import { APP_ROUTES } from "@/lib/appRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { obtenerPaginaConsultaTecnica } from "@/services/consultaTecnica.service";

export const dynamic = "force-dynamic";

export default async function ConsultaTecnicaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.consultaTecnica.acceso)) redirect(APP_ROUTES.ventas.hub);

  const esEditor = rol === "editor";
  const pagina = await obtenerPaginaConsultaTecnica(!esEditor);

  return (
    <ConsultaTecnicaPageClient
      recomendaciones={pagina.recomendaciones}
      marcas={pagina.marcas}
      rubros={pagina.rubros}
      esEditor={esEditor}
    />
  );
}
