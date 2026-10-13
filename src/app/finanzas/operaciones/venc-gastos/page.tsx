import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinanzasVencimientosGastosPageClient from "@/components/finanzas/FinanzasVencimientosGastosPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarObligacionesGastoVencidasNoMercaderia } from "@/services/finBalGastoMensualBalance.service";

export const dynamic = "force-dynamic";

export default async function FinanzasVencimientosGastosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const { proveedores, detalleLineas } = await listarObligacionesGastoVencidasNoMercaderia();

  return (
    <FinanzasVencimientosGastosPageClient
      proveedores={proveedores}
      detalleLineas={detalleLineas}
    />
  );
}