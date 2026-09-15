import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import {
  listarGlobalPtoVtas,
  listarPtoVentasCodArca,
  listarSucursalesParaPtoVtas,
} from "@/services/globalPtoVtas.service";
import PtosVtasPageClient from "@/components/vtas-cobros/PtosVtasPageClient";

export const dynamic = "force-dynamic";

export default async function VtasCobrosPtosVentaPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const [ptoVtas, sucursales, condicionesArca] = await Promise.all([
    listarGlobalPtoVtas(),
    listarSucursalesParaPtoVtas(),
    listarPtoVentasCodArca(),
  ]);

  return (
    <div className="area-page-shell bg-gris">
      <PtosVtasPageClient
        ptoVtas={ptoVtas}
        sucursales={sucursales}
        condicionesArca={condicionesArca}
        esEditor={rol === "editor"}
      />
    </div>
  );
}
