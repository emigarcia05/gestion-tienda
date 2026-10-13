import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import {
  listarEstPorProdCeldasCargadas,
  listarSucursalesParaEstPorProd,
} from "@/services/estPorProd.service";
import EstPorProdPageClient from "@/components/estadisticas-productos/EstPorProdPageClient";

export const dynamic = "force-dynamic";

export default async function EstadisticasProductosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.estadisticasProductos.acceso)) {
    redirect(GP_ROUTES.defaultEntry);
  }

  const esEditor = rol === "editor";
  const { mes: mesActual, anio: anioActual } = mesAnioCalendarioArgentina();
  const [sucursales, celdas] = await Promise.all([
    listarSucursalesParaEstPorProd(),
    listarEstPorProdCeldasCargadas(),
  ]);

  return (
    <div className="area-page-shell">
      <EstPorProdPageClient
        sucursales={sucursales}
        celdas={celdas}
        esEditor={esEditor}
        mesActual={mesActual}
        anioActual={anioActual}
      />
    </div>
  );
}
