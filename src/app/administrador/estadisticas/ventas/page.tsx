import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import { listarSucursalesParaEstPorProd } from "@/services/estPorProd.service";
import {
  listarProductosEstVtas,
  listarVentasEstVtas,
} from "@/services/estVtas.service";
import EstVtasPageClient from "@/components/estadisticas-productos/EstVtasPageClient";

export const dynamic = "force-dynamic";

export default async function EstVtasPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.estadisticasProductos.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const { mes: mesActual, anio: anioActual } = mesAnioCalendarioArgentina();
  const [filas, ventas, sucursales] = await Promise.all([
    listarProductosEstVtas(),
    listarVentasEstVtas(),
    listarSucursalesParaEstPorProd(),
  ]);

  return (
    <div className="area-page-shell">
      <EstVtasPageClient
        filas={filas}
        ventas={ventas}
        sucursales={sucursales}
        mesActual={mesActual}
        anioActual={anioActual}
      />
    </div>
  );
}
