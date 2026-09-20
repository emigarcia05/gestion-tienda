import { redirect } from "next/navigation";
import CobrosPorSucursalPageClient from "@/components/vtas-cobros/CobrosPorSucursalPageClient";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarVistaCobrosPorSucursal } from "@/services/cobrosPorSucursal.service";

export const dynamic = "force-dynamic";

export default async function VtasCobrosPorSucursalPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const vista = await listarVistaCobrosPorSucursal();

  return (
    <CobrosPorSucursalPageClient
      filas={vista.filas}
      sucursales={vista.sucursales}
      cajas={vista.cajas}
      esEditor={rol === "editor"}
    />
  );
}
