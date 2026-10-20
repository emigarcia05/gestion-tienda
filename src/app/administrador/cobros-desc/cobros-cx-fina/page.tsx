import { redirect } from "next/navigation";
import { GP_ROUTES } from "@/lib/gestionProductosRoutes";
import FinAnaCosFinaPageClient from "@/components/finanzas/FinAnaCosFinaPageClient";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import { listarFinAnaCosFina } from "@/services/finAnaCosFina.service";
import { listarFinAnaCosFinaTerminalesMarcas } from "@/services/finAnaCosFinaTerminalMarca.service";
import { listarFinAnaCosFinaPagos } from "@/services/finAnaCosFinaPago.service";
import { listarCobrosCuotas } from "@/services/cobrosCuotas.service";

export const dynamic = "force-dynamic";

export default async function VtasCobrosCxFinCobrosPage() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    redirect(GP_ROUTES.ayudaVendedor.pxVenta.pxVtaSugerido);
  }

  const esEditor = rol === "editor";
  const [filas, marcas, pagos, cuotas] = await Promise.all([
    listarFinAnaCosFina(),
    listarFinAnaCosFinaTerminalesMarcas(),
    listarFinAnaCosFinaPagos(),
    listarCobrosCuotas(),
  ]);

  return (
    <FinAnaCosFinaPageClient
      filas={filas}
      marcas={marcas}
      pagos={pagos}
      cuotas={cuotas}
      esEditor={esEditor}
    />
  );
}
