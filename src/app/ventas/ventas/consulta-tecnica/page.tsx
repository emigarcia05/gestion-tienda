import { redirect } from "next/navigation";
import ConsultaTecnicaPageClient from "@/components/ventas/ConsultaTecnicaPageClient";
import { APP_ROUTES } from "@/lib/appRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import {
  listarConversacionesConsultaTecnica,
  listarMensajesConsultaTecnica,
} from "@/services/consultaTecnica.service";

export const dynamic = "force-dynamic";

export default async function ConsultaTecnicaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.consultaTecnica.acceso)) redirect(APP_ROUTES.ventas.hub);

  const conversaciones = await listarConversacionesConsultaTecnica();
  const primera = conversaciones[0] ?? null;
  const mensajes = primera
    ? await listarMensajesConsultaTecnica(primera.id)
    : { success: true as const, data: [] };
  if (!mensajes.success) redirect(APP_ROUTES.ventas.hub);

  return (
    <ConsultaTecnicaPageClient
      conversaciones={conversaciones}
      conversacionInicialId={primera?.id ?? null}
      mensajesIniciales={mensajes.data}
    />
  );
}
