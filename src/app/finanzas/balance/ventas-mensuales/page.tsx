import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import { PERMISOS, puede } from "@/lib/permisos";
import { getRol } from "@/lib/sesion";
import { mesAnioCalendarioArgentina } from "@/services/finBalGastoMensualBalance.service";
import {
  listarFinBalVtas,
  listarSucursalesGeneraBalanceParaVtas,
} from "@/services/finBalVtas.service";
import FinBalVtasPageClient from "@/components/finanzas/FinBalVtasPageClient";

export const dynamic = "force-dynamic";

export default async function FinBalVtasPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const esEditor = rol === "editor";
  const { mes: mesActual, anio: anioActual } = mesAnioCalendarioArgentina();
  const [filas, sucursales] = await Promise.all([
    listarFinBalVtas(),
    listarSucursalesGeneraBalanceParaVtas(),
  ]);

  return (
    <FinBalVtasPageClient
      filas={filas}
      sucursales={sucursales}
      esEditor={esEditor}
      mesActual={mesActual}
      anioActual={anioActual}
    />
  );
}
